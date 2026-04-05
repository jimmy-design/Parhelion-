import asyncio
from database.mongodb import client, db

async def check_collections():
    # List all collections in the database
    collections = await db.list_collection_names()
    print("Available collections:")
    for collection in collections:
        print(f"  - {collection}")
    
    # Check if loyaltycustomers collection exists
    if "loyaltycustomers" in collections:
        print("\nFound loyaltycustomers collection")
        # Check a sample document from loyaltycustomers
        sample_doc = await db["loyaltycustomers"].find_one()
        if sample_doc:
            print("Sample document from loyaltycustomers:")
            for key, value in sample_doc.items():
                print(f"  {key}: {value}")
        else:
            print("loyaltycustomers collection is empty")
    else:
        print("\nloyaltycustomers collection not found")
        
    # Check loyalty_customers collection
    if "loyalty_customers" in collections:
        print("\nFound loyalty_customers collection")
        # Check a sample document from loyalty_customers
        sample_doc = await db["loyalty_customers"].find_one()
        if sample_doc:
            print("Sample document from loyalty_customers:")
            for key, value in sample_doc.items():
                print(f"  {key}: {value}")
        else:
            print("loyalty_customers collection is empty")

if __name__ == "__main__":
    asyncio.run(check_collections())