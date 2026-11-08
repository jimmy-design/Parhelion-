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


def live_receipt(receipt):
    used_tenders = []
    for tender in receipt.get("Tenders", []) or []:
        code = str(tender.get("code") or tender.get("Code") or "").strip()
        if code and code not in used_tenders:
            used_tenders.append(code)
    timestamp = receipt.get("sdateTime")
    if isinstance(timestamp, datetime):
        timestamp = (timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp).astimezone(EAT).isoformat()
    return {
        "id": str(receipt.get("_id", receipt.get("TransactionID", ""))),
        "receipt": str(receipt.get("TransactionID", "")),
        "batch": str(receipt.get("BatchNumber") or receipt.get("BatchID") or "—"),
        "time": timestamp or "—",
        "tax": round(number(receipt.get("SalesTax")), 2),
        "total": round(number(receipt.get("Total")), 2),
        "tender_mix": ", ".join(used_tenders) or "—",
        "cashier": str(receipt.get("CashierName") or receipt.get("CashierID") or "—"),
    }


@router.get("/live-summary")
async def live_summary(store_id: int = Query(1, ge=1), page: int = Query(1, ge=1),
                       page_size: int = Query(50, ge=1, le=250), search: str = "",
                       date_from: date = None, date_to: date = None):
    import re
    transactions = get_store_collection("transactions", store_id)
    match = {"StoreID": {"$in": [store_id, str(store_id)]}}
    if date_from is None and date_to is None:
        date_from = date_to = datetime.now(EAT).date()
    if date_from and date_to and date_from > date_to:
        raise HTTPException(400, "Start date must be on or before end date.")
    if date_from or date_to:
        boundaries = {}
        if date_from:
            boundaries["$gte"] = datetime.combine(date_from, datetime.min.time(), EAT).astimezone(timezone.utc).replace(tzinfo=None)
        if date_to:
            boundaries["$lt"] = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), EAT).astimezone(timezone.utc).replace(tzinfo=None)
        match["sdateTime"] = boundaries
    if search.strip():
        pattern = re.escape(search.strip())
        match["$expr"] = {"$or": [
            {"$regexMatch": {"input": {"$convert": {"input": f"${field}", "to": "string", "onError": "", "onNull": ""}},
                             "regex": pattern, "options": "i"}}
            for field in ("TransactionID", "BatchNumber", "BatchID", "CashierID", "CashierName")
        ]}
    totals = await transactions.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "count": {"$sum": 1},
                    "sales": {"$sum": {"$convert": {"input": "$Total", "to": "double", "onError": 0, "onNull": 0}}},
                    "tax": {"$sum": {"$convert": {"input": "$SalesTax", "to": "double", "onError": 0, "onNull": 0}}}}},
    ]).to_list(length=1)
    summary = totals[0] if totals else {"count": 0, "sales": 0, "tax": 0}
    count = summary["count"]
    page = min(page, max(1, math.ceil(count / page_size)))
    receipts = await transactions.find(match).sort([("sdateTime", -1), ("_id", -1)]).skip((page - 1) * page_size).limit(page_size).to_list(length=page_size)
    return {"live": [live_receipt(r) for r in receipts], "total": count, "page": page,
            "summary": {"sales": round(number(summary["sales"]), 2), "tax": round(number(summary["tax"]), 2)},
            "date_from": str(date_from) if date_from else None, "date_to": str(date_to) if date_to else None,
            "store_id": store_id, "timezone": "Africa/Nairobi"}


@router.get("/business")
async def business_report(date_from: date, date_to: date, store_id: int = Query(1, ge=1), product_details: bool = False):
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
    if product_details:
        inventory = get_store_collection("item", store_id)
        if await inventory.count_documents({}) > 100000:
            raise HTTPException(400, "Too many inventory items for this report.")
        items = await inventory.find({}, {"_id": 0, "ItemLookupCode": 1, "ItemID": 1, "Description": 1, "quantity": 1, "Quantity": 1, "StockAvailable": 1}).to_list(length=100001)
        result = product_reports(current, lines, items, date_from, date_to)
    else:
        result = analyze(current, lines, date_from, date_to)
    result.update(previous=summarize(previous), date_from=str(date_from), date_to=str(date_to),
                  store_id=store_id, timezone="Africa/Nairobi", generated_at=datetime.now(timezone.utc).isoformat())
    return result


def product_reports(receipts, lines, items, start, end):
    """Product measures use net item sales; missing historical costs stay unknown."""
    result = analyze(receipts, lines, start, end)
    products = {}
    for item in items:
        code = str(item.get("ItemLookupCode") or item.get("ItemID") or "Unknown")
        products[code] = {"name": code, "description": str(item.get("Description") or code),
                          "stock": number(item.get("quantity", item.get("Quantity", item.get("StockAvailable")))),
                          "sales": 0, "units": 0, "cost": 0, "missing_cost": 0, "sold_units": 0}
    by_id = {(str(r.get("StoreID", "")), str(r.get("TransactionID"))): r for r in receipts}
    monthly = {}
    for line in lines:
        receipt = by_id.get((str(line.get("StoreID", "")), str(line.get("TransactionID"))))
        if not receipt:
            continue
        code = str(line.get("ItemLookupCode") or line.get("ItemID") or "Unknown")
        product = products.setdefault(code, {"name": code, "description": str(line.get("Description") or code),
                                             "stock": None, "sales": 0, "units": 0, "cost": 0, "missing_cost": 0, "sold_units": 0})
        quantity, price, cost = (number(line.get(k)) for k in ("Quantity", "Price", "Cost"))
        product["sales"] += quantity * price
        product["units"] += quantity
        product["sold_units"] += max(0, quantity)
        if cost > 0:
            product["cost"] += cost * quantity
        else:
            product["missing_cost"] += 1
        stamp = receipt["sdateTime"]
        local = (stamp.replace(tzinfo=timezone.utc) if stamp.tzinfo is None else stamp).astimezone(EAT)
        month = local.strftime("%Y-%m")
        key = (code, month)
        row = monthly.setdefault(key, {"name": code, "description": product["description"], "month": month, "sales": 0, "units": 0})
        row["sales"] += quantity * price
        row["units"] += quantity
    days = (end - start).days + 1
    rows = list(products.values())
    for row in rows:
        row["profit"] = row["sales"] - row["cost"] if not row["missing_cost"] else None
        row["margin"] = 100 * row["profit"] / row["sales"] if row["profit"] is not None and row["sales"] else None
        row["cost_status"] = "Missing historical cost" if row["missing_cost"] else "Recorded costs"
        row["forecast_units"] = max(0, row["units"]) / days * 30
        row["daily_units"] = max(0, row["units"]) / days
        row["days_cover"] = row["stock"] / row["daily_units"] if row["stock"] is not None and row["daily_units"] > 0 else None
        # Historical average stock is not recorded, so conventional turnover cannot be calculated.
        row["turnover"] = None
    def clean(source):
        return [{k: round(v, 2) if isinstance(v, (int, float)) else v for k, v in row.items()} for row in source]
    result["product_reports"] = {
        "top": clean(sorted(rows, key=lambda r: (-r["units"], r["name"]))[:100]),
        "bottom": clean(sorted(rows, key=lambda r: (r["units"], r["name"]))[:100]),
        "categories": result["categories"], "profitability": clean(rows),
        "dead": clean([r for r in rows if r["stock"] is not None and r["stock"] > 0 and r["sold_units"] == 0]),
        "stock": clean(rows), "daily": result["daily"],
        "monthly": clean(sorted(monthly.values(), key=lambda r: (r["name"], r["month"]))),
        "forecast": clean(rows), "turnover": clean(rows), "hourly": result["hourly"],
    }
    return result


@router.get("/product-performance")
async def product_performance(date_from: date, date_to: date, store_id: int = Query(1, ge=1), report: str = "top"):
    # Reuse the validated period, receipt limits and store isolation of the business report.
    result = await business_report(date_from, date_to, store_id, product_details=report != "branches")
    if report == "branches":
        from main import list_erp_branches
        branch_rows = []
        for branch in await list_erp_branches():
            branch_data = result if branch.store_id == store_id else await business_report(date_from, date_to, branch.store_id)
            branch_rows.append({"name": branch.name, "sales": branch_data["summary"]["sales"], "receipts": branch_data["summary"]["receipts"]})
        result["product_reports"] = {"branches": sorted(branch_rows, key=lambda r: -r["sales"])}
        return result
    return result
