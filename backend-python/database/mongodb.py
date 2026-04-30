# database/mongodb.py
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "database1")
MONGO_BRANCH_SOURCE_DB = os.getenv("MONGO_BRANCH_SOURCE_DB", "database1").strip() or "database1"
MONGO_BRANCH_DB_TEMPLATE = os.getenv("MONGO_BRANCH_DB_TEMPLATE", "").strip()
MONGO_BRANCH_DATABASES = os.getenv("MONGO_BRANCH_DATABASES", "").strip()
MONGO_BRANCH_COLLECTION = os.getenv("MONGO_BRANCH_COLLECTION", "branch").strip() or "branch"
MONGO_BRANCH_COLLECTION_CANDIDATES = os.getenv(
    "MONGO_BRANCH_COLLECTION_CANDIDATES",
    "branch,branches,store,stores",
).strip()

client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]
branch_db = client[MONGO_BRANCH_SOURCE_DB]


def _parse_store_id(value, default=0):
    if value is None:
        return int(default)

    text = str(value).strip()
    if not text:
        return int(default)

    try:
        return int(text)
    except (TypeError, ValueError):
        return int(default)


def _parse_branch_database_overrides(raw_value: str):
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        parsed = None

    overrides = {}
    if isinstance(parsed, dict):
        for raw_store_id, raw_database_name in parsed.items():
            store_id = _parse_store_id(raw_store_id, default=-1)
            database_name = str(raw_database_name or "").strip()
            if store_id >= 0 and database_name:
                overrides[store_id] = database_name
        return overrides

    for segment in raw_value.split(","):
        store_mapping = str(segment or "").strip()
        if not store_mapping or ":" not in store_mapping:
            continue

        raw_store_id, raw_database_name = store_mapping.split(":", 1)
        store_id = _parse_store_id(raw_store_id, default=-1)
        database_name = str(raw_database_name or "").strip()
        if store_id >= 0 and database_name:
            overrides[store_id] = database_name

    return overrides


BRANCH_DATABASE_OVERRIDES = _parse_branch_database_overrides(MONGO_BRANCH_DATABASES)
BRANCH_COLLECTION_CANDIDATES = tuple(
    dict.fromkeys(
        [
            MONGO_BRANCH_COLLECTION,
            *[
                candidate.strip()
                for candidate in MONGO_BRANCH_COLLECTION_CANDIDATES.split(",")
                if candidate.strip()
            ],
        ]
    )
)


def get_store_database_name(store_id=0, default_database_name: str = MONGO_DB) -> str:
    fallback_database_name = str(default_database_name or MONGO_DB or "database1").strip()
    normalized_store_id = _parse_store_id(store_id, default=0)

    override_database_name = BRANCH_DATABASE_OVERRIDES.get(normalized_store_id)
    if override_database_name:
        return override_database_name

    if normalized_store_id <= 0:
        return fallback_database_name

    if MONGO_BRANCH_DB_TEMPLATE:
        try:
            return MONGO_BRANCH_DB_TEMPLATE.format(store_id=normalized_store_id)
        except (IndexError, KeyError, ValueError):
            pass

    if "{store_id}" in fallback_database_name:
        try:
            return fallback_database_name.format(store_id=normalized_store_id)
        except (IndexError, KeyError, ValueError):
            pass

    suffix_match = re.match(r"^(.*?)(\d+)$", fallback_database_name)
    if suffix_match:
        prefix = suffix_match.group(1)
        return f"{prefix}{normalized_store_id}"

    if normalized_store_id == 1:
        return fallback_database_name

    return f"{fallback_database_name}_{normalized_store_id}"


def get_store_database(store_id=0):
    return client[get_store_database_name(store_id)]


def get_store_collection(collection_name: str, store_id=0):
    return get_store_database(store_id)[collection_name]

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
adjustment_collection = db["adjustments"]
register_collection = db["register"]
branch_collection = branch_db[MONGO_BRANCH_COLLECTION]


async def ensure_collection_exists(collection_name: str, database=None):
    target_db = database if database is not None else db
    existing_collections = await target_db.list_collection_names()
    if collection_name not in existing_collections:
        await target_db.create_collection(collection_name)


async def ensure_register_collection_exists(database=None):
    target_db = database if database is not None else db
    await ensure_collection_exists("register", target_db)
    await target_db["register"].create_index(
        [("RegID", 1), ("ID", 1), ("Number", 1), ("StoreID", 1)],
        unique=True,
        name="register_primary_key",
    )
