# test_tender_descriptions.py
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from database.mongodb import tender_collection

async def test_tender_descriptions():
    """Test that tender codes are properly converted to full descriptions"""
    print("Testing tender code to description conversion...")
    
    # Test some common tender codes
    test_codes = ["CS", "CC", "CN", "SA", "VO"]
    
    for code in test_codes:
        try:
            tender = await tender_collection.find_one({"Code": code})
            if tender:
                print(f"Code: {code} -> Description: {tender.get('Description', 'Not found')}")
            else:
                print(f"Code: {code} -> Not found in database")
        except Exception as e:
            print(f"Error fetching tender {code}: {e}")
    
    # Test the specific case mentioned in the issue
    print("\nTesting specific case (CS should show as CASH, not CS)...")
    cs_tender = await tender_collection.find_one({"Code": "CS"})
    if cs_tender:
        print(f"CS code description: {cs_tender.get('Description', 'Not found')}")
    else:
        print("CS code not found in database")

if __name__ == "__main__":
    asyncio.run(test_tender_descriptions())