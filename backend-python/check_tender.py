import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from database.mongodb import tender_collection

async def check_tender_collection():
    try:
        # Get first tender document
        tender = await tender_collection.find_one()
        print("Sample tender document:")
        print(tender)
        
        # Get all tenders
        tenders = await tender_collection.find().to_list(100)
        print(f"\nTotal tenders found: {len(tenders)}")
        for i, t in enumerate(tenders[:5]):  # Show first 5
            print(f"Tender {i+1}: {t}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_tender_collection())