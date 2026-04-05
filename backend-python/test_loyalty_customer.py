import asyncio
from database.mongodb import loyalty_customers_collection

async def test_customer_lookup():
    # Try to find any customers in the database
    cursor = loyalty_customers_collection.find({})
    customers = await cursor.to_list(length=10)
    
    if customers:
        print(f"Found {len(customers)} customers in the database:")
        for customer in customers:
            print(f"  - Name: {customer.get('Fullname', 'N/A')}")
            print(f"    Mobile: {customer.get('Mobile', 'N/A')}")
            print(f"    ID Number: {customer.get('Idnumber', 'N/A')}")
            print(f"    Card Number: {customer.get('Loyaltyno', 'N/A')}")
            print()
    else:
        print("No customers found in the database")

# Run the test
if __name__ == "__main__":
    asyncio.run(test_customer_lookup())