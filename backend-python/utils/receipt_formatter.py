# utils/receipt_formatter.py
from datetime import datetime
from typing import List, Dict

def format_currency(v: float) -> str:
    return f"{v:,.2f}"

def generate_plain_receipt(transaction_id: int,
                           items: List[Dict],
                           tenders: List[Dict],
                           subtotal: float,
                           tax: float,
                           total: float,
                           cashier_id: int = None,
                           store_id: int = None,
                           comment: str = "") -> str:
    """
    Returns a plain-text receipt suitable for printing on thermal printers.
    """
    lines = []
    # header
    lines.append("           EASTLEIGH MATTRESSES")
    lines.append("        Mattress & Furniture Store")
    lines.append("         Phone: 0700 000 000")
    lines.append("")
    lines.append(f"Transaction: {transaction_id}")
    lines.append(f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    if cashier_id:
        lines.append(f"Cashier: {cashier_id}")
    if store_id:
        lines.append(f"Register: {store_id}")
    lines.append("-" * 48)

    # items
    lines.append(f"{'Item':30}{'QTY':>6}{'Price':>6}{'Total':>12}")
    lines.append("-" * 48)
    for it in items:
        desc = (it.get("description") or it.get("Description") or it.get("ItemID") )[:30]
        qty = int(it.get("quantity", it.get("Quantity", 1)))
        price = float(it.get("price", it.get("Price", 0.0)))
        line_total = price * qty
        lines.append(f"{desc:30}{qty:>6}{format_currency(price):>7}{format_currency(line_total):>12}")

    lines.append("-" * 48)
    lines.append(f"{'Subtotal':36}{format_currency(subtotal):>12}")
    lines.append(f"{'Tax':36}{format_currency(tax):>12}")
    lines.append(f"{'Total':36}{format_currency(total):>12}")
    lines.append("-" * 48)

    # tenders
    if tenders:
        lines.append("Payment Method:")
        for t in tenders:
            code = t.get("code") or t.get("Code") or t.get("Description") or ""
            amount = float(t.get("amount", t.get("Amount", 0.0)))
            lines.append(f"  {code:32}{format_currency(amount):>12}")

        total_tendered = sum(float(t.get("amount", t.get("Amount", 0.0))) for t in tenders)
        change = total_tendered - total
        lines.append(f"{'Tendered':36}{format_currency(total_tendered):>12}")
        lines.append(f"{'Change':36}{format_currency(change):>12}")

    lines.append("-" * 48)
    
    # Loyalty Information (placeholder for when loyalty system is implemented)
    lines.append("Loyalty Points Earned: 0")
    lines.append("Loyalty Points Balance: 0")
    lines.append("")
    lines.append("Thank you for shopping with us!")
    lines.append("")
    # cut line (some printers recognize paper cut commands; you can add them in printer.py)
    return "\n".join(lines)
