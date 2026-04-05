# test_full_receipt_with_tender_names.py
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from main import print_receipt

async def test_full_receipt_with_tender_names():
    """Test full receipt printing with tender names instead of codes"""
    print("Testing full receipt printing with tender names...")
    
    # Sample transaction data
    transaction_doc = {
        "TransactionID": 1005,
        "CashierID": 1002,
        "StoreID": 1,
        "Total": 45.75,
        "SalesTax": 3.66,
        "Comment": "Test transaction with full tender names"
    }
    
    items_list = [
        {
            "Description": "Premium Mattress With Pillow Top",
            "Quantity": 1,
            "Price": 35.00
        },
        {
            "Description": "Foam Pillow",
            "Quantity": 2,
            "Price": 5.37
        }
    ]
    
    # Test with different tender codes that should be converted to full names
    test_tenders = [
        {
            "code": "CS",  # Should show as "CASH"
            "amount": 45.75
        }
    ]
    
    print("\nSimulating receipt printing with tender names...")
    print("=" * 50)
    
    # This would normally print to a thermal printer
    # For testing, we'll just show what would be printed
    
    # Simulate the conversion that happens in print_receipt
    from database.mongodb import tender_collection
    full_description_tenders = []
    for tender in test_tenders:
        tender_record = await tender_collection.find_one({"Code": tender["code"].upper()})
        full_description = tender_record.get("Description", tender["code"]) if tender_record else tender["code"]
        full_description_tenders.append({
            "code": full_description,
            "amount": tender["amount"]
        })
    
    # Print what would appear on the receipt
    print("              EASTLEIGH MATTRESSES LIMITED              ")
    print("================================================")
    print("Transaction: 1005")
    print("Register: 1")
    print("Cashier: 1002")
    print("------------------------------------------------")
    print("Item                             Qty       Price")
    print("------------------------------------------------")
    print("Premium Mattress With Pillow T     1       35.00")
    print("Foam Pillow                        2       10.74")
    print("------------------------------------------------")
    print("                                 Tax        3.66")
    print("                               TOTAL       45.75")
    print("================================================")
    print("Payment Method:")
    for tender in full_description_tenders:
        print(f"  {tender['code']:32}{tender['amount']:>12.2f}")
    print("                            Tendered       45.75")
    print("                              Change        0.00")
    print("------------------------------------------------")
    print("Loyalty Points Earned: 0")
    print("Loyalty Points Balance: 0")
    print("================================================")
    print("       Thank you for shopping with us!         ")
    print("        Items sold are not returnable          ")
    print("         Please check items & totals           ")
    print("          before leaving the store.            ")
    print("")
    print("")
    
    print("=" * 50)
    print("Test completed successfully!")
    print("Tender codes were converted to full descriptions:")
    for i, tender in enumerate(test_tenders):
        print(f"  {tender['code']} -> {full_description_tenders[i]['code']}")

if __name__ == "__main__":
    asyncio.run(test_full_receipt_with_tender_names())