# database/mongodb.py
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "database1")

client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]

item_collection = db["item"]
tender_collection = db["tender"]
transaction_collection = db["transactions"]
mpesa_transaction_collection = db["mpesa_transactions"]
# If you prefer a separate collection for items, create one:
transaction_items_collection = db["transaction_items"]

# Loyalty system collections
loyalty_customers_collection = db["loyaltycustomers"]
loyalty_transactions_collection = db["loyalty_transactions"]
cashier_collection = db["cashier"]
supplier_collection = db["supplier"]
categories_collection = db["categories"]
configuration_collection = db["configurations"]
purchase_order_collection = db["purchaseorder"]
purchase_order_entries_collection = db["purchaseorderentries"]
price_change_collection = db["pricechanges"]
