"""Read-only transaction intelligence. All date boundaries use East Africa time."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import math
from fastapi import APIRouter, HTTPException, Query
from database.mongodb import get_store_collection

router = APIRouter(prefix="/erp/reports", tags=["Business reports"])
EAT = timezone(timedelta(hours=3))


def number(value):
    try:
        result = float(value or 0)
        return result if math.isfinite(result) else 0.0
    except (ValueError, TypeError):
        return 0.0


def summarize(receipts):
    sales = sum(number(r.get("Total")) for r in receipts)
    return {"sales": round(sales, 2), "receipts": len(receipts),
            "average_basket": round(sales / len(receipts), 2) if receipts else 0,
            "tax": round(sum(number(r.get("SalesTax")) for r in receipts), 2)}


def analyze(receipts, lines, start, end):
    def bucket():
        return {"sales": 0, "units": 0, "receipts": 0}
    daily, hours, cashiers, tenders = (defaultdict(bucket) for _ in range(4))
    products, categories = defaultdict(bucket), defaultdict(bucket)
    by_id = {}
    duplicates = 0
    for receipt in receipts:
        key = (str(receipt.get("StoreID", "")), str(receipt.get("TransactionID")))
        if key in by_id:
            duplicates += 1
        by_id[key] = receipt
        timestamp = receipt["sdateTime"]
        local = timestamp.replace(tzinfo=timezone.utc).astimezone(EAT) if timestamp.tzinfo is None else timestamp.astimezone(EAT)
        for group, name in [(daily, local.date().isoformat()), (hours, f"{local.hour:02d}:00"), (cashiers, str(receipt.get("CashierID", "Unknown")))]:
            group[name]["sales"] += number(receipt.get("Total"))
            group[name]["receipts"] += 1
        for tender in receipt.get("Tenders", []) or []:
            name = str(tender.get("code", "Unknown"))
            tenders[name]["sales"] += number(tender.get("amount"))
            tenders[name]["receipts"] += 1
    missing_cost = 0
    covered_sales = known_cost = line_sales = units = returns = discounts = 0
    matched = set()
    for line in lines:
        key = (str(line.get("StoreID", "")), str(line.get("TransactionID")))
        if key not in by_id:
            continue
        matched.add(key)
        quantity, price, cost = (number(line.get(k)) for k in ("Quantity", "Price", "Cost"))
        revenue = quantity * price
        line_sales += revenue
        units += quantity
        if quantity < 0:
            returns += abs(revenue)
        full_price = number(line.get("FullPrice"))
        discounts += max(0, full_price - price) * max(0, quantity) if full_price > 0 else 0
        if cost > 0:
            covered_sales += revenue
            known_cost += cost * quantity
        else:
            missing_cost += 1
        code = str(line.get("ItemLookupCode") or line.get("ItemID") or "Unknown")
        product = products[code]
        product["description"] = str(line.get("Description") or code)
        product["sales"] += revenue
        product["units"] += quantity
        category = str(line.get("CategoryName") or line.get("CategoryID") or "Unclassified")
        categories[category]["sales"] += revenue
        categories[category]["units"] += quantity
    cursor = start
    while cursor <= end:
        daily[cursor.isoformat()]
        cursor += timedelta(days=1)
    for hour in range(24):
        hours[f"{hour:02d}:00"]
    def rows(group, chronological=False):
        result = [{"name": name, **{k: round(v, 2) if isinstance(v, (float, int)) else v for k, v in values.items()}} for name, values in group.items()]
        return sorted(result, key=lambda r: r["name"] if chronological else -r["sales"])
    summary = summarize(receipts)
    summary.update(units=round(units, 3), item_sales=round(line_sales, 2),
                   reconciliation_gap=round(summary["sales"] - line_sales, 2),
                   returned_item_value=round(returns, 2), recorded_discounts=round(discounts, 2),
                   covered_item_sales=round(covered_sales, 2), recorded_cost=round(known_cost, 2),
                   missing_cost_lines=missing_cost, matched_lines=len(lines),
                   receipts_without_items=len(by_id) - len(matched), duplicate_receipt_ids=duplicates)
    return {"summary": summary, "daily": rows(daily, True), "hourly": rows(hours, True),
            "products": rows(products), "categories": rows(categories), "cashiers": rows(cashiers), "tenders": rows(tenders)}


@router.get("/business")
async def business_report(date_from: date, date_to: date, store_id: int = Query(1, ge=1)):
    days = (date_to - date_from).days + 1
    if not 1 <= days <= 366:
        raise HTTPException(400, "Choose a date range of 1 to 366 days.")
    start = datetime.combine(date_from, datetime.min.time(), EAT).astimezone(timezone.utc).replace(tzinfo=None)
    end = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), EAT).astimezone(timezone.utc).replace(tzinfo=None)
    transactions = get_store_collection("transactions", store_id)
    match = {"sdateTime": {"$gte": start - timedelta(days=days), "$lt": end},
             "StoreID": {"$in": [store_id, str(store_id)]}, "Status": {"$in": [1, "1"]}}
    # Refuse oversized requests instead of silently truncating financial reports.
    if await transactions.count_documents(match) > 100000:
        raise HTTPException(400, "Too many receipts. Choose a shorter period.")
    receipts = await transactions.find(match, {"_id": 0}).to_list(length=100001)
    current = [r for r in receipts if r["sdateTime"].replace(tzinfo=None) >= start]
    previous = [r for r in receipts if r["sdateTime"].replace(tzinfo=None) < start]
    lines = []
    ids = list({r.get("TransactionID") for r in current if r.get("TransactionID") is not None})
    for offset in range(0, len(ids), 1000):
        query = {"TransactionID": {"$in": ids[offset:offset + 1000]}, "StoreID": {"$in": [store_id, str(store_id)]}}
        async for line in get_store_collection("transaction_items", store_id).find(query, {"_id": 0}):
            lines.append(line)
            if len(lines) > 500000:
                raise HTTPException(400, "Too many item lines. Choose a shorter period.")
    result = analyze(current, lines, date_from, date_to)
    result.update(previous=summarize(previous), date_from=str(date_from), date_to=str(date_to),
                  store_id=store_id, timezone="Africa/Nairobi", generated_at=datetime.now(timezone.utc).isoformat())
    return result
