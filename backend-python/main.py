# main.py
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from bson import ObjectId
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import date, datetime, timedelta, timezone
import logging
import os
import re
try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python 3.8 fallback
    ZoneInfo = None

from database.mongodb import (
    db,
    branch_db,
    item_collection,
    tender_collection,
    transaction_collection,
    transaction_items_collection,
    loyalty_customers_collection,
    loyalty_transactions_collection,
    cashier_collection,
    supplier_collection,
    categories_collection,
    configuration_collection,
    purchase_order_collection,
    purchase_order_entries_collection,
    price_change_collection,
    adjustment_collection,
    branch_collection,
    BRANCH_COLLECTION_CANDIDATES,
    ensure_collection_exists,
    ensure_register_collection_exists,
    get_store_collection,
    get_store_database_name,
)
from utils.printer import POSPrinter
from utils.receipt_formatter import generate_plain_receipt
from models import Item, Tender, TransactionData, LoyaltyCustomer, LoyaltyTransaction
  # For printing receipts

# =====================
# LOGGING CONFIG
# =====================
logging.basicConfig(
    filename="pos_backend.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

app = FastAPI(title="POS Backend API", version="1.0.2")


@app.on_event("startup")
async def ensure_required_mongo_collections():
    await ensure_collection_exists("adjustments")
    await ensure_register_collection_exists()


class ERPItemCreate(BaseModel):
    code: str
    description: str
    alias: str
    category: str = ""
    category_id: int = 0
    price: float = 0.0
    cost: float = 0.0
    sale_price: Optional[float] = None
    markup_percent: float = 0.0
    bin_location: str = ""
    stock: int = 0
    reorder_level: float = 0.0
    taxable: bool = False
    consignment: bool = False


class ERPItemUpdate(ERPItemCreate):
    pass


class ERPItemReorderLevelUpdate(BaseModel):
    reorder_level: float = 0.0


class ERPItemOut(BaseModel):
    id: str
    alias: str
    lookup_code: str
    description: str
    price: float
    cost: float
    sale_price: float
    stock_available: int
    category: str
    category_id: int = 0
    bin_location: str
    stock: int
    reorder_level: float
    markup_percent: float
    taxable: bool
    consignment: bool
    price_a: float = 0.0
    price_b: float = 0.0
    price_c: float = 0.0
    lower_bound: float = 0.0
    upper_bound: float = 0.0
    sale_start_date: Optional[datetime] = None
    sale_end_date: Optional[datetime] = None
    supplier_id: int = 0


class ERPDashboardSummaryOut(BaseModel):
    total_sales: float = 0.0
    total_baskets: int = 0


class ERPDashboardDailySalesPointOut(BaseModel):
    date: str
    label: str
    sales: float = 0.0


class ERPDashboardDailySalesOut(BaseModel):
    date_from: date
    date_to: date
    total_sales: float = 0.0
    points: List[ERPDashboardDailySalesPointOut] = []


class ERPDashboardCategorySalesCategoryOut(BaseModel):
    category: str
    sales: float = 0.0


class ERPDashboardCategorySalesOut(BaseModel):
    date_from: date
    date_to: date
    total_sales: float = 0.0
    categories: List[ERPDashboardCategorySalesCategoryOut] = []


class ERPUserCreate(BaseModel):
    number: str
    password: str
    name: Optional[str] = ""
    user_role: str = "Cashier"
    email_address: Optional[str] = ""
    telephone: Optional[str] = ""
    store_id: int = 1
    floor_limit: float = 0
    drop_limit: float = 0
    priviledges: int = 0
    enabled: bool = True


class ERPUserOut(BaseModel):
    id: int
    number: str
    name: str
    user_role: str
    email_address: str
    telephone: str
    floor_limit: float
    drop_limit: float
    enabled: bool
    status: str
    store_id: int
    last_updated: datetime
    has_fingerprint: bool = False
    fingerprint_updated_at: Optional[datetime] = None


class ERPUserUpdate(BaseModel):
    number: str
    password: Optional[str] = None
    name: Optional[str] = ""
    user_role: str = "Cashier"
    email_address: Optional[str] = ""
    telephone: Optional[str] = ""
    floor_limit: float = 0
    drop_limit: float = 0
    enabled: bool = True


class ERPBranchOut(BaseModel):
    store_id: int
    code: str
    name: str
    region: str = ""
    address1: str = ""
    city: str = ""
    phone_number: str = ""
    parent_store_id: int = 0
    database_name: str
    last_updated: Optional[datetime] = None


class ERPCategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = 0
    parent: Optional[str] = ""
    status: str = "Active"


class ERPCategoryOut(BaseModel):
    id: int
    code: str
    name: str
    parent: str
    items: int = 0
    status: str
    last_updated: datetime


class AuthConfigurationOut(BaseModel):
    biometrics: bool
    biometrics_value: int
    fingerprint_match_threshold: int
    enrolled_fingerprint_users: int
    biometrics_bootstrap_required: bool


class PasswordLoginRequest(BaseModel):
    number: str
    password: str


class FingerprintEnrollmentRequest(BaseModel):
    template_base64: str
    template_format: str = "STANDARDPRO"
    image_quality: Optional[int] = None
    nfiq: Optional[int] = None
    device_model: Optional[str] = ""
    device_serial: Optional[str] = ""


class FingerprintAuthCandidate(BaseModel):
    id: int
    number: str
    name: str
    user_role: str
    store_id: int
    template_base64: str
    template_format: str
    fingerprint_updated_at: Optional[datetime] = None


class ERPSupplierCreate(BaseModel):
    code: Optional[str] = ""
    supplier_name: str
    contact_name: Optional[str] = ""
    phone_number: Optional[str] = ""
    fax_number: Optional[str] = ""
    email_address: Optional[str] = ""
    web_page_address: Optional[str] = ""
    address1: Optional[str] = ""
    address2: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    country: Optional[str] = ""
    zip: Optional[str] = ""
    account_number: Optional[str] = ""
    tax_number: Optional[str] = ""
    currency_id: int = 0
    terms: Optional[str] = ""
    withhold: bool = False
    grn_approval: bool = False
    advance_pay: bool = False
    approved: bool = False
    po_blocked: bool = False
    pay_blocked: bool = False
    garage: bool = False
    approved_by: Optional[str] = ""
    approved_time: Optional[str] = None
    blocked_notes: Optional[str] = "<none>"
    blocked_time: Optional[str] = None
    blocked_by: Optional[str] = ""
    custom_text_1: Optional[str] = ""
    custom_text_2: Optional[str] = ""
    custom_text_3: Optional[str] = ""
    custom_text_4: Optional[str] = ""
    custom_text_5: Optional[str] = ""
    custom_number_1: float = 0
    custom_number_2: float = 0
    custom_number_3: float = 0
    custom_number_4: float = 0
    custom_number_5: float = 0
    custom_date_1: Optional[str] = None
    custom_date_2: Optional[str] = None
    custom_date_3: Optional[str] = None
    custom_date_4: Optional[str] = None
    custom_date_5: Optional[str] = None
    notes: Optional[str] = ""
    type_of_goods: Optional[str] = ""
    supplying: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ERPSupplierUpdate(ERPSupplierCreate):
    pass


class ERPSupplierOut(BaseModel):
    id: int
    code: str
    supplier_name: str
    contact_name: str
    phone_number: str
    fax_number: str
    email_address: str
    web_page_address: str
    address1: str
    address2: str
    city: str
    state: str
    country: str
    zip: str
    account_number: str
    tax_number: str
    currency_id: int
    terms: str
    withhold: bool
    grn_approval: bool
    advance_pay: bool
    approved: bool
    po_blocked: bool
    pay_blocked: bool
    garage: bool
    approved_by: str
    approved_time: Optional[datetime]
    blocked_notes: str
    blocked_time: Optional[datetime]
    blocked_by: str
    custom_text_1: str
    custom_text_2: str
    custom_text_3: str
    custom_text_4: str
    custom_text_5: str
    custom_number_1: float
    custom_number_2: float
    custom_number_3: float
    custom_number_4: float
    custom_number_5: float
    custom_date_1: Optional[datetime]
    custom_date_2: Optional[datetime]
    custom_date_3: Optional[datetime]
    custom_date_4: Optional[datetime]
    custom_date_5: Optional[datetime]
    notes: str
    type_of_goods: str
    supplying: int
    last_updated: datetime
    start_date: Optional[datetime]
    end_date: Optional[datetime]


class ERPPurchaseOrderEntryCreate(BaseModel):
    item_id: Optional[int] = None
    item_lookup_code: Optional[str] = ""
    item_description: Optional[str] = ""
    quantity_ordered: float
    price: Optional[float] = None
    costed_price: Optional[float] = None
    tax_rate: Optional[float] = None


class ERPPurchaseOrderCreate(BaseModel):
    po_title: str
    po_type: int = 1
    store_id: int = 1
    p_status: int = 0
    po_number: Optional[str] = ""
    p_to: str
    ship_to: str
    requisioner: str
    ship_via: str = ""
    fob_point: str = ""
    terms: str = ""
    tax_rate: float = 0
    shipping: float = 0
    freight: str = ""
    required_date: Optional[str] = None
    confirming_to: str = ""
    remarks: str = ""
    supplier_id: int
    currency_id: int = 1
    exchange_rate: float = 1
    user_id: int = 1
    inventory_location: int = 1
    is_placed: bool = False
    date_placed: Optional[str] = None
    batch_number: Optional[int] = None
    pay_ref: Optional[int] = None
    entries: List[ERPPurchaseOrderEntryCreate]


class ERPPurchaseOrderEntryOut(BaseModel):
    id: int
    purchase_order_id: int
    store_id: int
    item_id: int
    item_lookup_code: str
    item_description: str
    quantity_ordered: float
    quantity_received: float
    quantity_received_to_date: float
    price: float
    costed_price: float
    tax_rate: float
    order_number: str
    last_updated: datetime


class ERPPurchaseOrderOut(BaseModel):
    id: int
    purchase_order_id: int
    po_number: str
    po_title: str
    po_type: int
    store_id: int
    p_status: int
    status_label: str
    date_created: datetime
    required_date: Optional[datetime]
    supplier_id: int
    supplier_name: str
    p_to: str
    ship_to: str
    requisioner: str
    ship_via: str
    fob_point: str
    terms: str
    tax_rate: float
    shipping: float
    freight: str
    confirming_to: str
    remarks: str
    currency_id: int
    exchange_rate: float
    user_id: int
    inventory_location: int
    is_placed: bool
    date_placed: Optional[datetime]
    batch_number: int
    pay_ref: int
    po_is_cancelled: bool
    picked: bool
    items_count: int
    total_amount: float
    last_updated: datetime
    entries: List[ERPPurchaseOrderEntryOut] = []


class ERPPriceBand(BaseModel):
    default: float = 0.0
    A: float = 0.0
    B: float = 0.0
    C: float = 0.0
    sale: float = 0.0
    cost: float = 0.0
    lowerBound: float = 0.0
    upperBound: float = 0.0


class ERPPriceChangeItemCreate(BaseModel):
    id: Optional[int] = 0
    item_lookup_code: str
    description: str = ""
    quantity: float = 0.0
    sale_start: Optional[str] = None
    sale_end: Optional[str] = None
    time_based: bool = False
    loyalty_based: bool = False
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    price: ERPPriceBand
    old_price: Optional[ERPPriceBand] = None


class ERPPriceChangeCreate(BaseModel):
    effect_date: Optional[str] = None
    type: int = 0
    description: str
    store_id: int = 0
    purchase_order_id: Optional[int] = None
    status: str = "Open"
    user: str = ""
    vendor: str = ""
    credit_note: bool = False
    credit_note_user: Optional[str] = None
    gl_posted: bool = False
    remarks: str = ""
    flash_price: bool = False
    route_id: int = 0
    viewed: bool = False
    items: List[ERPPriceChangeItemCreate]


class ERPPriceChangeUpdate(ERPPriceChangeCreate):
    pass


class ERPPriceChangeAction(BaseModel):
    user: str = ""
    remarks: str = ""


class ERPPriceChangeItemOut(BaseModel):
    id: int
    item_lookup_code: str
    description: str
    last_updated: datetime
    price: ERPPriceBand
    old_price: ERPPriceBand
    quantity: float = 0.0
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    time_based: bool = False
    loyalty_based: bool = False
    time_start: Optional[str] = None
    time_end: Optional[str] = None


class ERPPriceChangeHistoryRow(BaseModel):
    barcode: str = ""
    code: str = ""
    item_lookup_code: str
    effect_date: Optional[datetime] = None
    price: float = 0.0
    cost: float = 0.0
    sale_price: float = 0.0
    user: str = ""


class ERPPriceChangeOut(BaseModel):
    id: int
    time: datetime
    effect_date: Optional[datetime] = None
    type: int = 0
    description: str
    store_id: int = 0
    total_items: int = 0
    purchase_order_id: Optional[int] = None
    status: str = "Open"
    user: str = ""
    vendor: str = ""
    credit_note: bool = False
    credit_note_user: Optional[str] = None
    gl_posted: bool = False
    remarks: str = ""
    flash_price: bool = False
    route_id: int = 0
    viewed: bool = False
    applied_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    last_updated: datetime
    items: List[ERPPriceChangeItemOut] = []


class ERPAdjustmentCreate(BaseModel):
    item: str
    sku: Optional[str] = ""
    quantity: float
    reason: str = "Bin correction"
    location: Optional[str] = "Warehouse A"
    note: Optional[str] = ""
    effective_date: Optional[str] = None
    requested_by: Optional[str] = ""
    approved_by: Optional[str] = ""
    status: str = "Pending"
    impact: Optional[str] = ""
    store_id: int = 1


class ERPAdjustmentOut(BaseModel):
    id: str
    adjustment_id: int
    item: str
    sku: str
    quantity: float
    reason: str
    raisedBy: str
    status: str
    location: str
    requestedAt: datetime
    approvedBy: str = ""
    note: str = ""
    impact: str = ""
    storeId: int = 1
    effectiveDate: Optional[datetime] = None
    lastUpdated: datetime


PRICE_CHANGE_STATUSES = {"Draft", "Open", "Approved", "Applied", "Cancelled"}
PRICE_CHANGE_SYNC_INTERVAL_SECONDS = 5
_erp_branch_collection_name_cache: Optional[str] = None
_last_price_change_sync_at: Optional[datetime] = None
PRICE_CHANGE_NUMBER_EPSILON = 0.0001
ADJUSTMENT_STATUSES = {"Pending", "Approved", "Posted"}


def get_price_change_business_timezone():
    configured_timezone = str(os.getenv("PRICE_CHANGE_TIMEZONE", "") or "").strip()
    if configured_timezone and ZoneInfo is not None:
        try:
            return ZoneInfo(configured_timezone)
        except Exception:
            logging.warning(
                "Invalid PRICE_CHANGE_TIMEZONE '%s'. Falling back to the machine local timezone.",
                configured_timezone,
            )
    elif configured_timezone:
        logging.warning(
            "PRICE_CHANGE_TIMEZONE is set but zoneinfo is unavailable. Falling back to the machine local timezone."
        )

    return datetime.now().astimezone().tzinfo or timezone.utc


PRICE_CHANGE_BUSINESS_TIMEZONE = get_price_change_business_timezone()


def parse_price_change_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value

    text = str(value or "").strip()
    if not text:
        return None

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None

    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def normalize_price_change_status(value: str) -> str:
    normalized = str(value or "").strip().title()
    return normalized if normalized in PRICE_CHANGE_STATUSES else "Open"


def normalize_price_change_day_boundary(value, boundary: str = "start") -> Optional[datetime]:
    text = str(value or "").strip()
    parsed_date = None
    if text:
        try:
            parsed_date = date.fromisoformat(text[:10])
        except ValueError:
            parsed_date = None

    if parsed_date is None:
        parsed = parse_price_change_datetime(value)
        if parsed is None:
            return None
        parsed_date = parsed.date()

    normalized = datetime.combine(
        parsed_date,
        datetime.min.time(),
        tzinfo=PRICE_CHANGE_BUSINESS_TIMEZONE,
    )
    if boundary == "end":
        normalized = normalized.replace(hour=23, minute=59, second=59, microsecond=0)
    return normalized.astimezone(timezone.utc).replace(tzinfo=None)


def parse_price_change_store_id(value, default: int = 0) -> int:
    if value is None:
        return int(default)

    text = str(value).strip()
    if not text:
        return int(default)

    try:
        return int(text)
    except (TypeError, ValueError):
        return int(default)


def format_erp_branch_name(store_id) -> str:
    normalized_store_id = parse_price_change_store_id(store_id, default=0)
    if normalized_store_id <= 0:
        return "Default Database"
    if normalized_store_id == 1:
        return "Main Store"
    return f"Branch {normalized_store_id}"


def parse_branch_primary_incremental_value(doc: dict, fallback: int = 0) -> int:
    for field_name in (
        "BranchID",
        "BranchNo",
        "BranchNumber",
        "StoreNumber",
        "StoreNo",
        "Sequence",
        "Seq",
        "PrimaryID",
    ):
        value = parse_price_change_store_id(doc.get(field_name), default=0)
        if value > 0:
            return value

    return int(fallback)


def get_branch_primary_sort_key(doc: dict):
    primary_value = parse_branch_primary_incremental_value(doc, fallback=0)
    if primary_value > 0:
        return (0, primary_value)

    raw_object_id = doc.get("_id")
    if isinstance(raw_object_id, ObjectId):
        return (1, str(raw_object_id))

    return (2, str(doc.get("StoreCode", "") or ""), str(doc.get("Name", "") or ""))


async def get_erp_branch_source_collection():
    global _erp_branch_collection_name_cache

    if _erp_branch_collection_name_cache:
        return branch_db[_erp_branch_collection_name_cache]

    collection_names = await branch_db.list_collection_names()
    collection_names_by_casefold = {
        str(collection_name).casefold(): collection_name
        for collection_name in collection_names
    }
    for candidate_name in BRANCH_COLLECTION_CANDIDATES:
        actual_collection_name = collection_names_by_casefold.get(str(candidate_name).casefold())
        if actual_collection_name:
            _erp_branch_collection_name_cache = actual_collection_name
            return branch_db[actual_collection_name]

    return branch_collection


def map_erp_branch_for_output(doc: dict, store_id: int) -> ERPBranchOut:
    branch_name = str(
        doc.get("Name")
        or doc.get("StoreName")
        or doc.get("Description")
        or format_erp_branch_name(store_id)
        or ""
    ).strip()
    branch_code = str(
        doc.get("StoreCode")
        or doc.get("Code")
        or doc.get("BranchCode")
        or f"STORE-{store_id:02d}"
    ).strip()

    return ERPBranchOut(
        store_id=store_id,
        code=branch_code,
        name=branch_name or format_erp_branch_name(store_id),
        region=str(doc.get("Region", "") or "").strip(),
        address1=str(doc.get("Address1", "") or "").strip(),
        city=str(doc.get("City", "") or "").strip(),
        phone_number=str(doc.get("PhoneNumber", doc.get("Phone", "")) or "").strip(),
        parent_store_id=parse_price_change_store_id(doc.get("ParentStoreID", 0), default=0),
        database_name=get_price_change_store_database_name(store_id),
        last_updated=parse_optional_erp_datetime(doc.get("LastUpdated")),
    )


def get_price_change_store_database_name(store_id, default: int = 0) -> str:
    normalized_store_id = parse_price_change_store_id(store_id, default=default)
    return get_store_database_name(normalized_store_id)


def get_price_change_item_collection(store_id, default: int = 0):
    normalized_store_id = parse_price_change_store_id(store_id, default=default)
    return get_store_collection("item", normalized_store_id)


async def get_price_change_target_item_collections():
    raw_store_ids = await price_change_collection.distinct("StoreID")
    collections_by_database_name = {}

    for raw_store_id in [0, 1, *raw_store_ids]:
        database_name = get_price_change_store_database_name(raw_store_id)
        if database_name in collections_by_database_name:
            continue

        collections_by_database_name[database_name] = get_price_change_item_collection(raw_store_id)

    return list(collections_by_database_name.values())


async def get_known_erp_branch_store_ids():
    branch_source_collection = await get_erp_branch_source_collection()
    branch_docs = await branch_source_collection.find({}, {"_id": 1}).to_list(2000)
    sorted_branch_docs = sorted(branch_docs, key=get_branch_primary_sort_key)
    store_ids = {index for index, _ in enumerate(sorted_branch_docs, start=1)}

    for raw_store_id in await cashier_collection.distinct("StoreID"):
        normalized_store_id = parse_price_change_store_id(raw_store_id, default=0)
        if normalized_store_id > 0:
            store_ids.add(normalized_store_id)

    for raw_store_id in await price_change_collection.distinct("StoreID"):
        normalized_store_id = parse_price_change_store_id(raw_store_id, default=0)
        if normalized_store_id > 0:
            store_ids.add(normalized_store_id)

    return sorted(store_ids)


def coerce_price_band(value: Optional[Dict[str, Any]], fallback: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
    source = value if isinstance(value, dict) else {}
    fallback_source = fallback if isinstance(fallback, dict) else {}

    def read_number(key: str, default: float = 0.0) -> float:
        candidate = source.get(key, fallback_source.get(key, default))
        try:
            return float(candidate or 0)
        except (TypeError, ValueError):
            return float(default)

    return {
        "default": read_number("default"),
        "A": read_number("A"),
        "B": read_number("B"),
        "C": read_number("C"),
        "sale": read_number("sale"),
        "cost": read_number("cost"),
        "lowerBound": read_number("lowerBound"),
        "upperBound": read_number("upperBound"),
    }


def price_change_numbers_match(left_value, right_value) -> bool:
    try:
        normalized_left = float(left_value or 0)
    except (TypeError, ValueError):
        normalized_left = 0.0

    try:
        normalized_right = float(right_value or 0)
    except (TypeError, ValueError):
        normalized_right = 0.0

    return abs(normalized_left - normalized_right) < PRICE_CHANGE_NUMBER_EPSILON


def normalize_price_change_price_band(
    next_price_band: Optional[Dict[str, Any]],
    old_price_band: Optional[Dict[str, Any]] = None,
    *,
    sale_start: Optional[datetime] = None,
    sale_end: Optional[datetime] = None,
    time_based: bool = False,
    loyalty_based: bool = False,
) -> Dict[str, float]:
    normalized_band = coerce_price_band(next_price_band, fallback=old_price_band)
    previous_band = coerce_price_band(old_price_band)

    has_sale_schedule = bool(
        sale_start is not None
        or sale_end is not None
        or time_based
        or loyalty_based
    )
    sale_was_explicitly_changed = not price_change_numbers_match(
        normalized_band["sale"],
        previous_band["sale"],
    )
    price_a_was_explicitly_changed = not price_change_numbers_match(
        normalized_band["A"],
        previous_band["A"],
    )

    if not has_sale_schedule and not sale_was_explicitly_changed:
        normalized_band["sale"] = float(normalized_band["default"] or 0)

    if not price_a_was_explicitly_changed:
        normalized_band["A"] = float(normalized_band["sale"] or normalized_band["default"] or 0)

    return normalized_band


def build_item_price_band(doc: dict) -> Dict[str, float]:
    price = float(doc.get("Price", 0) or 0)
    sale_price = float(doc.get("SalePrice", doc.get("PriceA", price)) or 0)
    cost = float(doc.get("Cost", doc.get("LastCost", 0)) or 0)
    return {
        "default": price,
        "A": float(doc.get("PriceA", sale_price) or 0),
        "B": float(doc.get("PriceB", 0) or 0),
        "C": float(doc.get("PriceC", 0) or 0),
        "sale": sale_price,
        "cost": cost,
        "lowerBound": float(doc.get("PriceLowerBound", 0) or 0),
        "upperBound": float(doc.get("PriceUpperBound", 0) or 0),
    }


def get_item_effective_sale_price(doc: dict, now: Optional[datetime] = None) -> float:
    current_time = now or datetime.utcnow()
    default_price = float(doc.get("Price", 0) or 0)
    sale_price = float(doc.get("SalePrice", default_price) or 0)
    sale_start = parse_price_change_datetime(doc.get("SaleStartDate"))
    sale_end = parse_price_change_datetime(doc.get("SaleEndDate"))

    if sale_price <= 0:
        return default_price

    if sale_start and current_time < sale_start:
        return default_price

    if sale_end and current_time > sale_end:
        return default_price

    if sale_price != default_price:
        return sale_price

    return default_price


def map_price_change_item_for_erp(doc: dict) -> ERPPriceChangeItemOut:
    return ERPPriceChangeItemOut(
        id=int(doc.get("ID", 0) or 0),
        item_lookup_code=str(doc.get("ItemLookupCode", "") or ""),
        description=str(doc.get("Description", "") or ""),
        last_updated=parse_erp_datetime(doc.get("LastUpdated")),
        price=ERPPriceBand(**coerce_price_band(doc.get("Price"))),
        old_price=ERPPriceBand(**coerce_price_band(doc.get("OldPrice"))),
        quantity=float(doc.get("Quantity", 0) or 0),
        sale_start=parse_price_change_datetime(doc.get("SaleStart")),
        sale_end=parse_price_change_datetime(doc.get("SaleEnd")),
        time_based=bool(doc.get("TimeBased", False)),
        loyalty_based=bool(doc.get("LoyaltyBased", False)),
        time_start=str(doc.get("TimeStart", "") or ""),
        time_end=str(doc.get("TimeEnd", "") or ""),
    )


def map_price_change_for_erp(doc: dict) -> ERPPriceChangeOut:
    items = [map_price_change_item_for_erp(item) for item in doc.get("Items", []) if isinstance(item, dict)]
    return ERPPriceChangeOut(
        id=int(doc.get("ID", 0) or 0),
        time=parse_erp_datetime(doc.get("Time")),
        effect_date=parse_price_change_datetime(doc.get("EffectDate")),
        type=int(doc.get("Type", 0) or 0),
        description=str(doc.get("Description", "") or ""),
        store_id=parse_price_change_store_id(doc.get("StoreID"), default=0),
        total_items=int(doc.get("TotalItems", len(items)) or 0),
        purchase_order_id=int(doc.get("PurchaseOrderID", 0) or 0) or None,
        status=normalize_price_change_status(doc.get("Status", "Open")),
        user=str(doc.get("User", "") or ""),
        vendor=str(doc.get("Vendor", "") or ""),
        credit_note=bool(doc.get("CreditNote", False)),
        credit_note_user=str(doc.get("CreditNoteUser", "") or "") or None,
        gl_posted=bool(doc.get("GLPosted", False)),
        remarks=str(doc.get("Remarks", "") or ""),
        flash_price=bool(doc.get("FlashPrice", False)),
        route_id=int(doc.get("RouteID", 0) or 0),
        viewed=bool(doc.get("Viewed", False)),
        applied_at=parse_price_change_datetime(doc.get("AppliedAt")),
        approved_at=parse_price_change_datetime(doc.get("ApprovedAt")),
        last_updated=parse_erp_datetime(doc.get("LastUpdated")),
        items=items,
    )


def map_price_change_history_row(
    change_doc: dict,
    item_doc: dict,
    source_item: Optional[dict] = None,
) -> ERPPriceChangeHistoryRow:
    price_band = coerce_price_band(item_doc.get("Price"))

    return ERPPriceChangeHistoryRow(
        barcode=str(
            (source_item or {}).get(
                "Alias",
                (source_item or {}).get("alias", (source_item or {}).get("Barcode", "")),
            )
            or ""
        ),
        code=str(
            (source_item or {}).get(
                "ItemID",
                (source_item or {}).get("ID", item_doc.get("ID", "")),
            )
            or ""
        ),
        item_lookup_code=str(item_doc.get("ItemLookupCode", "") or ""),
        effect_date=parse_price_change_datetime(change_doc.get("EffectDate")),
        price=float(price_band.get("default", 0) or 0),
        cost=float(price_band.get("cost", 0) or 0),
        sale_price=float(price_band.get("sale", 0) or 0),
        user=str(change_doc.get("User", "") or ""),
    )


def map_item_for_erp(doc: dict) -> ERPItemOut:
    item_id = doc.get("ItemID", doc.get("ID", ""))
    price = float(doc.get("Price", 0) or 0)
    cost = float(doc.get("Cost", doc.get("LastCost", 0)) or 0)
    sale_price = get_item_effective_sale_price(doc)
    reorder_level = float(doc.get("ReorderPoint", 0) or 0)
    stock_available = get_item_stock_quantity(doc)
    alias = str(doc.get("Alias", doc.get("alias", "")))
    raw_category_id = doc.get("CategoryID", doc.get("DepartmentID", 0))
    try:
        category_id = int(raw_category_id or 0)
    except (TypeError, ValueError):
        category_id = 0
    raw_category_name = normalize_category_name(doc.get("Category", ""))
    display_category_name = "" if is_numeric_category_name(raw_category_name) else raw_category_name

    return ERPItemOut(
        id=str(item_id) if item_id is not None else "",
        alias=alias,
        lookup_code=str(doc.get("ItemLookupCode", "")),
        description=str(doc.get("Description", "")),
        price=price,
        cost=cost,
        sale_price=sale_price,
        stock_available=stock_available,
        category=display_category_name,
        category_id=category_id,
        bin_location=str(doc.get("BinLocation", "")),
        stock=stock_available,
        reorder_level=reorder_level,
        markup_percent=float(doc.get("MarkupPercent", 0) or 0),
        taxable=bool(doc.get("Taxable", False)),
        consignment=bool(doc.get("Consignment", False)),
        price_a=float(doc.get("PriceA", sale_price) or 0),
        price_b=float(doc.get("PriceB", 0) or 0),
        price_c=float(doc.get("PriceC", 0) or 0),
        lower_bound=float(doc.get("PriceLowerBound", 0) or 0),
        upper_bound=float(doc.get("PriceUpperBound", 0) or 0),
        sale_start_date=parse_price_change_datetime(doc.get("SaleStartDate")),
        sale_end_date=parse_price_change_datetime(doc.get("SaleEndDate")),
        supplier_id=int(doc.get("SupplierID", 0) or 0),
    )


def normalize_category_name(value) -> str:
    return str(value or "").strip()


def is_numeric_category_name(value) -> bool:
    normalized = normalize_category_name(value)
    return bool(normalized) and normalized.isdigit()


def coerce_category_identity(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def normalize_category_status(value) -> str:
    normalized = str(value or "").strip().lower()
    return "Inactive" if normalized in {"inactive", "draft", "disabled", "archived", "0", "false"} else "Active"


def map_category_status_to_storage(status: str) -> str:
    return "draft" if normalize_category_status(status) == "Inactive" else "published"


def parse_category_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return datetime.utcnow()

        try:
            return datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError:
            return datetime.utcnow()

    return datetime.utcnow()


def get_category_identity(doc: dict) -> int:
    return int(doc.get("ID", doc.get("order", 0)) or 0)


def get_category_parent_identity(doc: dict) -> int:
    return int(doc.get("parent_id", doc.get("ParentID", 0)) or 0)


def map_category_for_erp(doc: dict, item_count: int = 0, parent_name: str = "") -> ERPCategoryOut:
    return ERPCategoryOut(
        id=get_category_identity(doc),
        code=str(doc.get("slug", doc.get("Code", "")) or ""),
        name=normalize_category_name(doc.get("name", doc.get("Name", ""))),
        parent=normalize_category_name(parent_name or doc.get("parent", doc.get("Parent", ""))),
        items=int(item_count or 0),
        status=normalize_category_status(doc.get("status", doc.get("Status", "Active"))),
        last_updated=parse_category_datetime(
            doc.get("updated_at") or doc.get("LastUpdated") or doc.get("created_at")
        ),
    )


async def find_category_by_identity(category_id: int):
    if int(category_id or 0) <= 0:
        return None

    return await categories_collection.find_one(
        {
            "$or": [
                {"ID": int(category_id)},
                {"order": int(category_id)},
            ]
        }
    )


def resolve_linked_category_name(category_doc: Optional[dict]) -> str:
    if not category_doc:
        return ""

    resolved_name = normalize_category_name(category_doc.get("name", category_doc.get("Name", "")))
    return resolved_name or ""


def resolve_item_dashboard_category_name(
    item_doc: dict,
    categories_by_id: dict,
    categories_by_name: dict,
    uncategorized_label: str = "Uncategorized",
) -> str:
    category_doc = None
    category_id = coerce_category_identity(item_doc.get("CategoryID", 0))
    department_id = coerce_category_identity(item_doc.get("DepartmentID", 0))
    category_value = normalize_category_name(item_doc.get("Category", ""))

    if category_id > 0:
        category_doc = categories_by_id.get(category_id)

    if not category_doc and department_id > 0:
        category_doc = categories_by_id.get(department_id)

    if not category_doc and category_value:
        if category_value.isdigit():
            category_doc = categories_by_id.get(int(category_value))
            resolved_name = resolve_linked_category_name(category_doc)
            if resolved_name:
                return resolved_name
            return uncategorized_label
        else:
            category_doc = categories_by_name.get(category_value.casefold())
            if not category_doc:
                return category_value

    resolved_name = resolve_linked_category_name(category_doc)
    if resolved_name:
        return resolved_name

    if category_value and not is_numeric_category_name(category_value):
        return category_value

    return uncategorized_label


async def resolve_item_category_selection(category_name: str = "", category_id: int = 0):
    normalized_name = normalize_category_name(category_name)
    resolved_id = int(category_id or 0)
    resolved_doc = None

    if resolved_id > 0:
        resolved_doc = await find_category_by_identity(resolved_id)
        if not resolved_doc:
            raise HTTPException(status_code=400, detail="Selected category was not found")
    elif normalized_name:
        resolved_doc = await categories_collection.find_one(
            {
                "$or": [
                    {
                        "name": {
                            "$regex": f"^{re.escape(normalized_name)}$",
                            "$options": "i",
                        }
                    },
                    {
                        "Name": {
                            "$regex": f"^{re.escape(normalized_name)}$",
                            "$options": "i",
                        }
                    },
                ]
            }
        )

    if resolved_doc:
        resolved_id = get_category_identity(resolved_doc)
        normalized_name = normalize_category_name(
            resolved_doc.get("name", resolved_doc.get("Name", normalized_name))
        )

    if not normalized_name:
        raise HTTPException(status_code=400, detail="Category is required")

    return resolved_id, normalized_name


def get_item_stock_quantity(doc: dict) -> int:
    return int(doc.get("quantity", doc.get("Quantity", doc.get("StockAvailable", 0))) or 0)


async def find_erp_item_by_lookup_or_id(lookup_code: str, store_id: Optional[int] = None):
    normalized = str(lookup_code or "").strip()
    if not normalized:
        return None

    target_item_collection = get_price_change_item_collection(store_id)

    item = await target_item_collection.find_one(
        {
            "$or": [
                {"ItemLookupCode": normalized},
                {"Alias": normalized},
                {"alias": normalized},
                {"Barcode": normalized},
            ]
        }
    )
    if item:
        return item

    if normalized.isdigit():
        numeric_value = int(normalized)

        item = await target_item_collection.find_one(
            {"$or": [{"ItemLookupCode": numeric_value}, {"ItemID": numeric_value}]}
        )
        if item:
            return item

    escaped_lookup = re.escape(normalized)
    item = await target_item_collection.find_one(
        {
            "$or": [
                {"ItemLookupCode": {"$regex": f"^{escaped_lookup}$", "$options": "i"}},
                {"Alias": {"$regex": f"^{escaped_lookup}$", "$options": "i"}},
                {"alias": {"$regex": f"^{escaped_lookup}$", "$options": "i"}},
                {"Barcode": {"$regex": f"^{escaped_lookup}$", "$options": "i"}},
            ]
        }
    )
    if item:
        return item

    return None


def parse_config_int(value, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if value is None:
        return default

    text = str(value).strip()
    if not text:
        return default

    lowered = text.lower()
    if lowered in {"true", "yes", "on"}:
        return 1
    if lowered in {"false", "no", "off"}:
        return 0

    try:
        return int(float(text))
    except ValueError:
        return default


def get_cashier_fingerprint_template(doc: dict) -> str:
    for field_name in (
        "FingerprintTemplate",
        "FingerprintTemplateBase64",
        "BiometricTemplate",
        "FingerprintData",
    ):
        value = doc.get(field_name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def get_cashier_fingerprint_format(doc: dict) -> str:
    for field_name in (
        "FingerprintTemplateFormat",
        "BiometricTemplateFormat",
        "FingerprintFormat",
    ):
        value = doc.get(field_name)
        if isinstance(value, str) and value.strip():
            return value.strip().upper()
    return "STANDARDPRO"


def get_cashier_fingerprint_updated_at(doc: dict) -> Optional[datetime]:
    return parse_optional_erp_datetime(
        doc.get("FingerprintUpdatedAt") or doc.get("BiometricUpdatedAt")
    )


async def get_configuration_value(field_name: str, default=0):
    field_regex = {"$regex": f"^{re.escape(field_name)}$", "$options": "i"}
    row = await configuration_collection.find_one({"FieldName": field_regex})
    if row:
        return row.get("FieldValue", default)

    document = await configuration_collection.find_one(
        {field_name: {"$exists": True}},
        sort=[("ID", -1)],
    )
    if document:
        return document.get(field_name, default)

    return default


async def get_biometrics_enabled() -> bool:
    return parse_config_int(await get_configuration_value("Biometrics", 0), default=0) == 1


async def get_fingerprint_match_threshold() -> int:
    threshold = parse_config_int(
        await get_configuration_value("FingerprintMatchThreshold", 100),
        default=100,
    )
    return threshold if threshold > 0 else 100


async def count_enrolled_fingerprint_users() -> int:
    users = await cashier_collection.find({"Enabled": True}).to_list(1000)
    return sum(1 for user in users if get_cashier_fingerprint_template(user))


async def find_cashier_by_number(number: str):
    normalized = str(number or "").strip()
    if not normalized:
        return None

    return await cashier_collection.find_one(
        {
            "Number": {
                "$regex": f"^{re.escape(normalized)}$",
                "$options": "i",
            }
        }
    )


def map_cashier_for_erp(doc: dict) -> ERPUserOut:
    enabled = bool(doc.get("Enabled", True))
    fingerprint_template = get_cashier_fingerprint_template(doc)
    return ERPUserOut(
        id=int(doc.get("ID", 0) or 0),
        number=str(doc.get("Number", "") or ""),
        name=str(doc.get("Name", "") or ""),
        user_role=str(doc.get("UserRole", "") or ""),
        email_address=str(doc.get("EmailAddress", "") or ""),
        telephone=str(doc.get("Telephone", "") or ""),
        floor_limit=float(doc.get("FloorLimit", 0) or 0),
        drop_limit=float(doc.get("DropLimit", 0) or 0),
        enabled=enabled,
        status="Active" if enabled else "Disabled",
        store_id=int(doc.get("StoreID", 1) or 1),
        last_updated=doc.get("LastUpdated") or datetime.utcnow(),
        has_fingerprint=bool(fingerprint_template),
        fingerprint_updated_at=get_cashier_fingerprint_updated_at(doc),
    )


def parse_erp_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.utcnow()
    return datetime.utcnow()


def parse_optional_erp_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def normalize_adjustment_status(value: str) -> str:
    normalized = str(value or "").strip().title()
    return normalized if normalized in ADJUSTMENT_STATUSES else "Pending"


def build_adjustment_reference(adjustment_id: int) -> str:
    return f"ADJ-{int(adjustment_id or 0):04d}"


def build_adjustment_impact(reason: str, quantity: float, location: str = "") -> str:
    normalized_reason = str(reason or "").strip().lower()
    normalized_location = str(location or "").strip()
    location_suffix = f" in {normalized_location}" if normalized_location else ""

    if float(quantity or 0) > 0:
        return f"Pending intake confirmation before the added stock is released to available inventory{location_suffix}."

    if "damage" in normalized_reason:
        return f"Pending write-down approval before damaged units are posted out of stock{location_suffix}."

    if "return" in normalized_reason:
        return f"Pending quality review before the returned stock movement is finalized{location_suffix}."

    return f"Pending supervisor confirmation before the stock movement is posted{location_suffix}."


def map_adjustment_for_erp(doc: dict) -> ERPAdjustmentOut:
    adjustment_id = int(doc.get("AdjustmentID", 0) or 0)
    return ERPAdjustmentOut(
        id=str(doc.get("Reference") or build_adjustment_reference(adjustment_id)),
        adjustment_id=adjustment_id,
        item=str(doc.get("Item", "") or ""),
        sku=str(doc.get("SKU", "") or ""),
        quantity=float(doc.get("Quantity", 0) or 0),
        reason=str(doc.get("Reason", "") or ""),
        raisedBy=str(doc.get("RequestedBy", doc.get("RaisedBy", "")) or ""),
        status=normalize_adjustment_status(doc.get("Status", "Pending")),
        location=str(doc.get("Location", "") or ""),
        requestedAt=parse_erp_datetime(doc.get("RequestedAt")),
        approvedBy=str(doc.get("ApprovedBy", "") or ""),
        note=str(doc.get("Note", "") or ""),
        impact=str(doc.get("Impact", "") or ""),
        storeId=parse_price_change_store_id(doc.get("StoreID"), default=1),
        effectiveDate=parse_optional_erp_datetime(doc.get("EffectiveDate")),
        lastUpdated=parse_erp_datetime(doc.get("LastUpdated")),
    )


def build_price_change_item_doc(
    payload: ERPPriceChangeItemCreate,
    source_item: Optional[dict] = None,
    existing_price_change_item: Optional[dict] = None,
    now: Optional[datetime] = None,
) -> dict:
    current_time = now or datetime.utcnow()
    source_price_band = build_item_price_band(source_item or {})
    old_price_band = coerce_price_band(
        (
            payload.old_price.dict()
            if payload.old_price is not None
            else (existing_price_change_item or {}).get("OldPrice")
        ),
        fallback=source_price_band,
    )
    comparison_price_band = coerce_price_band(
        (existing_price_change_item or {}).get("Price"),
        fallback=old_price_band,
    )
    sale_start = normalize_price_change_day_boundary(payload.sale_start, boundary="start")
    sale_end = normalize_price_change_day_boundary(payload.sale_end, boundary="end")
    next_price_band = normalize_price_change_price_band(
        payload.price.dict(),
        comparison_price_band,
        sale_start=sale_start,
        sale_end=sale_end,
        time_based=bool(payload.time_based),
        loyalty_based=bool(payload.loyalty_based),
    )
    item_identity = int(payload.id or (source_item or {}).get("ItemID", 0) or 0)

    return {
        "ID": item_identity,
        "ItemLookupCode": str(payload.item_lookup_code or "").strip(),
        "Description": str(
            payload.description
            or (source_item or {}).get("Description", "")
            or ""
        ).strip(),
        "LastUpdated": current_time,
        "Price": next_price_band,
        "OldPrice": coerce_price_band(old_price_band),
        "Quantity": float(payload.quantity or 0),
        "SaleStart": sale_start,
        "SaleEnd": sale_end,
        "TimeBased": bool(payload.time_based),
        "LoyaltyBased": bool(payload.loyalty_based),
        "TimeStart": str(payload.time_start or "").strip(),
        "TimeEnd": str(payload.time_end or "").strip(),
    }


def build_price_change_doc(
    price_change_id: int,
    payload: ERPPriceChangeCreate,
    item_docs: List[dict],
    now: Optional[datetime] = None,
    existing_doc: Optional[dict] = None,
) -> dict:
    current_time = now or datetime.utcnow()
    normalized_status = normalize_price_change_status(payload.status)
    existing_approved_at = parse_price_change_datetime((existing_doc or {}).get("ApprovedAt"))
    existing_applied_at = parse_price_change_datetime((existing_doc or {}).get("AppliedAt"))

    return {
        "ID": int(price_change_id),
        "Time": parse_price_change_datetime((existing_doc or {}).get("Time")) or current_time,
        "EffectDate": parse_price_change_datetime(payload.effect_date),
        "Type": int(payload.type or 0),
        "Description": payload.description.strip(),
        "StoreID": parse_price_change_store_id(payload.store_id, default=0),
        "TotalItems": len(item_docs),
        "PurchaseOrderID": int(payload.purchase_order_id or 0),
        "Status": normalized_status,
        "User": str(payload.user or "").strip(),
        "Vendor": str(payload.vendor or "").strip(),
        "CreditNote": bool(payload.credit_note),
        "CreditNoteUser": str(payload.credit_note_user or "").strip(),
        "GLPosted": bool(payload.gl_posted),
        "Remarks": str(payload.remarks or "").strip(),
        "FlashPrice": bool(payload.flash_price),
        "RouteID": int(payload.route_id or 0),
        "Viewed": bool(payload.viewed),
        "Items": item_docs,
        "LastUpdated": current_time,
        "ApprovedAt": (
            existing_approved_at
            if normalized_status == "Applied"
            else (existing_approved_at or current_time)
            if normalized_status == "Approved"
            else None
        ),
        "AppliedAt": existing_applied_at if normalized_status == "Applied" else None,
    }


async def apply_price_change_document(price_change_doc: dict, applied_at: Optional[datetime] = None):
    current_time = applied_at or datetime.utcnow()
    current_doc = price_change_doc
    applied_lookup_codes = []
    target_store_id = parse_price_change_store_id(current_doc.get("StoreID"), default=0)
    target_item_collection = get_price_change_item_collection(target_store_id)

    for item_doc in current_doc.get("Items", []):
        lookup_code = str(item_doc.get("ItemLookupCode", "") or "").strip()
        if not lookup_code:
            continue

        existing_item = await find_erp_item_by_lookup_or_id(
            lookup_code,
            store_id=target_store_id,
        )
        if not existing_item:
            continue

        old_price_band = coerce_price_band(
            item_doc.get("OldPrice"),
            fallback=build_item_price_band(existing_item),
        )
        raw_next_price_band = coerce_price_band(
            item_doc.get("Price"),
            fallback=old_price_band,
        )
        sale_start = parse_price_change_datetime(item_doc.get("SaleStart"))
        sale_end = parse_price_change_datetime(item_doc.get("SaleEnd"))
        price_a_was_explicitly_changed = not price_change_numbers_match(
            raw_next_price_band["A"],
            old_price_band["A"],
        )
        next_price_band = normalize_price_change_price_band(
            raw_next_price_band,
            old_price_band,
            sale_start=sale_start,
            sale_end=sale_end,
            time_based=bool(item_doc.get("TimeBased", False)),
            loyalty_based=bool(item_doc.get("LoyaltyBased", False)),
        )
        default_price = float(next_price_band["default"] or 0)
        sale_price = float(next_price_band["sale"] or default_price)
        price_a = float(next_price_band["A"] or sale_price)

        if sale_end and sale_end < current_time:
            sale_start = None
            sale_end = None
            sale_price = default_price
            if not price_a_was_explicitly_changed:
                price_a = default_price

        update_fields = {
            "Price": default_price,
            "PriceA": price_a,
            "PriceB": float(next_price_band["B"] or 0),
            "PriceC": float(next_price_band["C"] or 0),
            "SalePrice": sale_price,
            "SaleStartDate": sale_start,
            "SaleEndDate": sale_end,
            "Cost": float(next_price_band["cost"] or 0),
            "LastCost": float(next_price_band["cost"] or 0),
            "PriceLowerBound": float(next_price_band["lowerBound"] or 0),
            "PriceUpperBound": float(next_price_band["upperBound"] or 0),
            "LastUpdated": current_time,
        }

        await target_item_collection.update_one(
            {"_id": existing_item["_id"]},
            {"$set": update_fields},
        )
        applied_lookup_codes.append(lookup_code)

    await price_change_collection.update_one(
        {"_id": current_doc["_id"]},
        {
            "$set": {
                "Status": "Applied",
                "AppliedAt": current_time,
                "Viewed": True,
                "LastUpdated": current_time,
            }
        },
    )
    updated_doc = await price_change_collection.find_one({"_id": current_doc["_id"]})
    return updated_doc, applied_lookup_codes


async def clear_expired_sale_prices(now: Optional[datetime] = None):
    current_time = now or datetime.utcnow()
    target_item_collections = await get_price_change_target_item_collections()

    for target_item_collection in target_item_collections:
        sale_items = await target_item_collection.find(
            {"SaleEndDate": {"$ne": None}},
            {
                "_id": 1,
                "Price": 1,
                "PriceA": 1,
                "SalePrice": 1,
                "SaleStartDate": 1,
                "SaleEndDate": 1,
            },
        ).to_list(5000)

        for item_doc in sale_items:
            sale_end = parse_price_change_datetime(item_doc.get("SaleEndDate"))
            if not sale_end or sale_end > current_time:
                continue

            default_price = float(item_doc.get("Price", 0) or 0)
            current_sale_price = float(item_doc.get("SalePrice", default_price) or default_price)
            current_price_a = float(item_doc.get("PriceA", current_sale_price) or current_sale_price)
            reset_fields = {
                "SalePrice": default_price,
                "SaleStartDate": None,
                "SaleEndDate": None,
                "LastUpdated": current_time,
            }

            # If PriceA was mirroring the sale price, bring it back to the base price too.
            if abs(current_price_a - current_sale_price) < 0.0001:
                reset_fields["PriceA"] = default_price

            await target_item_collection.update_one(
                {"_id": item_doc["_id"]},
                {
                    "$set": reset_fields
                },
            )


async def apply_due_approved_price_changes(now: Optional[datetime] = None):
    current_time = now or datetime.utcnow()
    approved_changes = await price_change_collection.find(
        {"Status": "Approved"}
    ).sort("EffectDate", 1).to_list(500)

    for change_doc in approved_changes:
        effect_date = parse_price_change_datetime(change_doc.get("EffectDate"))
        if effect_date and effect_date > current_time:
            continue
        await apply_price_change_document(change_doc, applied_at=current_time)


async def ensure_price_change_updates_synced(force: bool = False):
    global _last_price_change_sync_at

    now = datetime.utcnow()
    if (
        not force
        and _last_price_change_sync_at is not None
        and (now - _last_price_change_sync_at).total_seconds() < PRICE_CHANGE_SYNC_INTERVAL_SECONDS
    ):
        return

    await apply_due_approved_price_changes(now)
    await clear_expired_sale_prices(now)
    _last_price_change_sync_at = now


def map_supplier_for_erp(doc: dict) -> ERPSupplierOut:
    contact_block = doc.get("Contact") if isinstance(doc.get("Contact"), dict) else {}
    address_block = doc.get("Address") if isinstance(doc.get("Address"), dict) else {}
    account_block = doc.get("Account") if isinstance(doc.get("Account"), dict) else {}
    flags_block = doc.get("Flags") if isinstance(doc.get("Flags"), dict) else {}
    approval_block = doc.get("Approval") if isinstance(doc.get("Approval"), dict) else {}
    blocking_block = doc.get("Blocking") if isinstance(doc.get("Blocking"), dict) else {}
    custom_text_block = doc.get("CustomText") if isinstance(doc.get("CustomText"), dict) else {}
    custom_number_block = doc.get("CustomNumber") if isinstance(doc.get("CustomNumber"), dict) else {}
    custom_date_block = doc.get("CustomDate") if isinstance(doc.get("CustomDate"), dict) else {}
    dates_block = doc.get("Dates") if isinstance(doc.get("Dates"), dict) else {}

    return ERPSupplierOut(
        id=int(doc.get("ID", 0) or 0),
        code=str(doc.get("Code", doc.get("SupplierID", "")) or ""),
        supplier_name=str(doc.get("SupplierName", doc.get("Company", "")) or ""),
        contact_name=str(contact_block.get("ContactName", doc.get("Contact", "")) or ""),
        phone_number=str(contact_block.get("PhoneNumber", doc.get("Phone", "")) or ""),
        fax_number=str(contact_block.get("FaxNumber", "") or ""),
        email_address=str(contact_block.get("EmailAddress", "") or ""),
        web_page_address=str(contact_block.get("WebPageAddress", "") or ""),
        address1=str(address_block.get("Address1", "") or ""),
        address2=str(address_block.get("Address2", "") or ""),
        city=str(address_block.get("City", "") or ""),
        state=str(address_block.get("State", "") or ""),
        country=str(address_block.get("Country", "") or ""),
        zip=str(address_block.get("Zip", "") or ""),
        account_number=str(account_block.get("AccountNumber", "") or ""),
        tax_number=str(account_block.get("TaxNumber", "") or ""),
        currency_id=int(account_block.get("CurrencyID", 0) or 0),
        terms=str(account_block.get("Terms", doc.get("Terms", "")) or ""),
        withhold=bool(flags_block.get("Withhold", False)),
        grn_approval=bool(flags_block.get("GRNApproval", False)),
        advance_pay=bool(flags_block.get("AdvancePay", False)),
        approved=bool(flags_block.get("Approved", False)),
        po_blocked=bool(flags_block.get("POBlocked", False)),
        pay_blocked=bool(flags_block.get("PayBlocked", False)),
        garage=bool(flags_block.get("Garage", False)),
        approved_by=str(approval_block.get("ApprovedBy", "") or ""),
        approved_time=parse_optional_erp_datetime(approval_block.get("ApprovedTime")),
        blocked_notes=str(blocking_block.get("BlockedNotes", "") or ""),
        blocked_time=parse_optional_erp_datetime(blocking_block.get("BlockedTime")),
        blocked_by=str(blocking_block.get("BlockedBy", "") or ""),
        custom_text_1=str(custom_text_block.get("1", "") or ""),
        custom_text_2=str(custom_text_block.get("2", "") or ""),
        custom_text_3=str(custom_text_block.get("3", "") or ""),
        custom_text_4=str(custom_text_block.get("4", "") or ""),
        custom_text_5=str(custom_text_block.get("5", "") or ""),
        custom_number_1=float(custom_number_block.get("1", 0) or 0),
        custom_number_2=float(custom_number_block.get("2", 0) or 0),
        custom_number_3=float(custom_number_block.get("3", 0) or 0),
        custom_number_4=float(custom_number_block.get("4", 0) or 0),
        custom_number_5=float(custom_number_block.get("5", 0) or 0),
        custom_date_1=parse_optional_erp_datetime(custom_date_block.get("1")),
        custom_date_2=parse_optional_erp_datetime(custom_date_block.get("2")),
        custom_date_3=parse_optional_erp_datetime(custom_date_block.get("3")),
        custom_date_4=parse_optional_erp_datetime(custom_date_block.get("4")),
        custom_date_5=parse_optional_erp_datetime(custom_date_block.get("5")),
        notes=str(doc.get("Notes", "") or ""),
        type_of_goods=str(doc.get("TypeofGoods", "") or ""),
        supplying=int(doc.get("Supplying", 0) or 0),
        last_updated=parse_erp_datetime(dates_block.get("LastUpdated") or doc.get("LastUpdated")),
        start_date=parse_optional_erp_datetime(dates_block.get("sDate")),
        end_date=parse_optional_erp_datetime(dates_block.get("eDate")),
    )


def build_supplier_doc(supplier_id: int, payload: ERPSupplierCreate, code: str) -> dict:
    return {
        "ID": supplier_id,
        "SupplierName": payload.supplier_name.strip(),
        "Code": code,
        "Contact": {
            "ContactName": payload.contact_name.strip() if payload.contact_name else "",
            "PhoneNumber": payload.phone_number.strip() if payload.phone_number else "",
            "FaxNumber": payload.fax_number.strip() if payload.fax_number else "",
            "EmailAddress": payload.email_address.strip() if payload.email_address else "",
            "WebPageAddress": payload.web_page_address.strip() if payload.web_page_address else "",
        },
        "Address": {
            "Address1": payload.address1.strip() if payload.address1 else "",
            "Address2": payload.address2.strip() if payload.address2 else "",
            "City": payload.city.strip() if payload.city else "",
            "State": payload.state.strip() if payload.state else "",
            "Country": payload.country.strip() if payload.country else "",
            "Zip": payload.zip.strip() if payload.zip else "",
        },
        "Account": {
            "AccountNumber": payload.account_number.strip() if payload.account_number else "",
            "TaxNumber": payload.tax_number.strip() if payload.tax_number else "",
            "CurrencyID": int(payload.currency_id or 0),
            "Terms": payload.terms.strip() if payload.terms else "",
        },
        "Flags": {
            "Withhold": bool(payload.withhold),
            "GRNApproval": bool(payload.grn_approval),
            "AdvancePay": bool(payload.advance_pay),
            "Approved": bool(payload.approved),
            "POBlocked": bool(payload.po_blocked),
            "PayBlocked": bool(payload.pay_blocked),
            "Garage": bool(payload.garage),
        },
        "Approval": {
            "ApprovedBy": payload.approved_by.strip() if payload.approved_by else "",
            "ApprovedTime": parse_optional_erp_datetime(payload.approved_time),
        },
        "Blocking": {
            "BlockedNotes": payload.blocked_notes.strip() if payload.blocked_notes else "<none>",
            "BlockedTime": parse_optional_erp_datetime(payload.blocked_time),
            "BlockedBy": payload.blocked_by.strip() if payload.blocked_by else "",
        },
        "CustomText": {
            "1": payload.custom_text_1.strip() if payload.custom_text_1 else "",
            "2": payload.custom_text_2.strip() if payload.custom_text_2 else "",
            "3": payload.custom_text_3.strip() if payload.custom_text_3 else "",
            "4": payload.custom_text_4.strip() if payload.custom_text_4 else "",
            "5": payload.custom_text_5.strip() if payload.custom_text_5 else "",
        },
        "CustomNumber": {
            "1": float(payload.custom_number_1 or 0),
            "2": float(payload.custom_number_2 or 0),
            "3": float(payload.custom_number_3 or 0),
            "4": float(payload.custom_number_4 or 0),
            "5": float(payload.custom_number_5 or 0),
        },
        "CustomDate": {
            "1": parse_optional_erp_datetime(payload.custom_date_1),
            "2": parse_optional_erp_datetime(payload.custom_date_2),
            "3": parse_optional_erp_datetime(payload.custom_date_3),
            "4": parse_optional_erp_datetime(payload.custom_date_4),
            "5": parse_optional_erp_datetime(payload.custom_date_5),
        },
        "Notes": payload.notes.strip() if payload.notes else "",
        "TypeofGoods": payload.type_of_goods.strip() if payload.type_of_goods else "",
        "Supplying": int(payload.supplying or 0),
        "Dates": {
            "LastUpdated": datetime.utcnow(),
            "sDate": parse_optional_erp_datetime(payload.start_date),
            "eDate": parse_optional_erp_datetime(payload.end_date),
        },
    }


def get_purchase_order_status_label(doc: dict) -> str:
    if bool(doc.get("POisCancelled", False)):
        return "Cancelled"

    status_value = int(doc.get("PStatus", 0) or 0)
    if status_value == 3:
        return "Closed"
    if status_value == 2:
        return "Part Received"
    if status_value == 1:
        return "Submitted"
    if bool(doc.get("IsPlaced", False)):
        return "Placed"
    return "Draft"


def map_purchase_order_entry_for_erp(doc: dict) -> ERPPurchaseOrderEntryOut:
    return ERPPurchaseOrderEntryOut(
        id=int(doc.get("ID", 0) or 0),
        purchase_order_id=int(doc.get("PurchaseOrderID", 0) or 0),
        store_id=int(doc.get("StoreID", 1) or 1),
        item_id=int(doc.get("ItemID", 0) or 0),
        item_lookup_code=str(doc.get("ItemLookupCode", "") or ""),
        item_description=str(doc.get("ItemDescription", "") or ""),
        quantity_ordered=float(doc.get("QuantityOrdered", 0) or 0),
        quantity_received=float(doc.get("QuantityReceived", 0) or 0),
        quantity_received_to_date=float(doc.get("QuantityReceivedToDate", 0) or 0),
        price=float(doc.get("Price", 0) or 0),
        costed_price=float(doc.get("CostedPrice", doc.get("Price", 0)) or 0),
        tax_rate=float(doc.get("TaxRate", 0) or 0),
        order_number=str(doc.get("OrderNumber", "") or ""),
        last_updated=parse_erp_datetime(doc.get("LastUpdated")),
    )


def map_purchase_order_for_erp(
    doc: dict,
    entries: List[dict],
    supplier_name: str = "",
) -> ERPPurchaseOrderOut:
    mapped_entries = [map_purchase_order_entry_for_erp(entry) for entry in entries]
    subtotal = sum(float(entry.costed_price) * float(entry.quantity_ordered) for entry in mapped_entries)
    shipping = float(doc.get("Shipping", 0) or 0)

    return ERPPurchaseOrderOut(
        id=int(doc.get("ID", 0) or 0),
        purchase_order_id=int(doc.get("WorkSheetID", doc.get("ID", 0)) or 0),
        po_number=str(doc.get("PONumber", "") or ""),
        po_title=str(doc.get("POTitle", "") or ""),
        po_type=int(doc.get("POType", 1) or 1),
        store_id=int(doc.get("StoreID", 1) or 1),
        p_status=int(doc.get("PStatus", 0) or 0),
        status_label=get_purchase_order_status_label(doc),
        date_created=parse_erp_datetime(doc.get("DateCreated")),
        required_date=parse_optional_erp_datetime(doc.get("RequiredDate")),
        supplier_id=int(doc.get("SupplierID", 0) or 0),
        supplier_name=supplier_name,
        p_to=str(doc.get("PTo", "") or ""),
        ship_to=str(doc.get("ShipTo", "") or ""),
        requisioner=str(doc.get("Requisioner", "") or ""),
        ship_via=str(doc.get("ShipVia", "") or ""),
        fob_point=str(doc.get("FOBPoint", "") or ""),
        terms=str(doc.get("Terms", "") or ""),
        tax_rate=float(doc.get("TaxRate", 0) or 0),
        shipping=shipping,
        freight=str(doc.get("Freight", "") or ""),
        confirming_to=str(doc.get("ConfirmingTo", "") or ""),
        remarks=str(doc.get("Remarks", "") or ""),
        currency_id=int(doc.get("CurrencyID", 1) or 1),
        exchange_rate=float(doc.get("ExchangeRate", 1) or 1),
        user_id=int(doc.get("UserID", 1) or 1),
        inventory_location=int(doc.get("InventoryLocation", 1) or 1),
        is_placed=bool(doc.get("IsPlaced", False)),
        date_placed=parse_optional_erp_datetime(doc.get("DatePlaced")),
        batch_number=int(doc.get("BatchNumber", 0) or 0),
        pay_ref=int(doc.get("PayRef", 0) or 0),
        po_is_cancelled=bool(doc.get("POisCancelled", False)),
        picked=bool(doc.get("Picked", False)),
        items_count=len(mapped_entries),
        total_amount=subtotal + shipping,
        last_updated=parse_erp_datetime(doc.get("LastUpdated")),
        entries=mapped_entries,
    )


async def build_purchase_order_entries_lookup(purchase_order_ids: List[int]) -> dict:
    ids = sorted({int(value) for value in purchase_order_ids if int(value or 0) > 0})
    if not ids:
        return {}

    entries = await purchase_order_entries_collection.find(
        {"PurchaseOrderID": {"$in": ids}}
    ).sort("ID", 1).to_list(10000)

    grouped_entries = {}
    for entry in entries:
        purchase_order_id = int(entry.get("PurchaseOrderID", 0) or 0)
        grouped_entries.setdefault(purchase_order_id, []).append(entry)
    return grouped_entries


async def build_supplier_name_lookup(supplier_ids: List[int]) -> dict:
    ids = sorted({int(value) for value in supplier_ids if int(value or 0) > 0})
    if not ids:
        return {}

    suppliers = await supplier_collection.find({"ID": {"$in": ids}}).to_list(len(ids))
    return {
        int(supplier.get("ID", 0) or 0): str(
            supplier.get("SupplierName", supplier.get("Company", "")) or ""
        )
        for supplier in suppliers
    }

# =====================
# CORS
# =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network_requests(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response(status_code=200)
    else:
        response = await call_next(request)

    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"

    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"

    return response

# =====================
# ROUTES
# =====================
@app.get("/")
async def read_root():
    return {"status": "POS Backend is running"}


@app.get("/erp/branches", response_model=List[ERPBranchOut])
async def list_erp_branches():
    branch_source_collection = await get_erp_branch_source_collection()
    branch_docs = await branch_source_collection.find(
        {},
        {
            "_id": 1,
            "BranchID": 1,
            "BranchNo": 1,
            "BranchNumber": 1,
            "StoreNumber": 1,
            "StoreNo": 1,
            "Sequence": 1,
            "Seq": 1,
            "PrimaryID": 1,
            "Name": 1,
            "StoreCode": 1,
            "Region": 1,
            "Address1": 1,
            "City": 1,
            "PhoneNumber": 1,
            "ParentStoreID": 1,
            "LastUpdated": 1,
        },
    ).to_list(2000)
    sorted_branch_docs = sorted(branch_docs, key=get_branch_primary_sort_key)

    branch_records = [
        map_erp_branch_for_output(doc, store_id=index)
        for index, doc in enumerate(sorted_branch_docs, start=1)
    ]
    if branch_records:
        return branch_records

    fallback_store_ids = await get_known_erp_branch_store_ids()
    return [
        ERPBranchOut(
            store_id=store_id,
            code=f"STORE-{store_id:02d}",
            name=format_erp_branch_name(store_id),
            database_name=get_price_change_store_database_name(store_id),
        )
        for store_id in fallback_store_ids
    ]


@app.get("/item/{code}")
async def get_item(code: str):
    """Fetch item details from DB."""
    await ensure_price_change_updates_synced()
    item = await find_erp_item_by_lookup_or_id(code)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    stock_available = get_item_stock_quantity(item)
    selling_price = get_item_effective_sale_price(item)
    return {
        "code": item.get("ItemLookupCode", ""),
        "description": item.get("Description", ""),
        "price": selling_price,
        "taxable": item.get("Taxable", False),
        "quantity": stock_available,
        "stock_available": stock_available,
        "stock": stock_available,
    }


@app.get("/erp/items", response_model=List[ERPItemOut])
async def list_erp_items(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
    store_id: Optional[int] = Query(default=None),
):
    await ensure_price_change_updates_synced()
    query = {}
    if search:
        query = {
            "$or": [
                {"ItemLookupCode": {"$regex": search, "$options": "i"}},
                {"Description": {"$regex": search, "$options": "i"}},
                {"Alias": {"$regex": search, "$options": "i"}},
                {"alias": {"$regex": search, "$options": "i"}},
                {"BinLocation": {"$regex": search, "$options": "i"}},
            ]
        }

    target_item_collection = get_price_change_item_collection(store_id)
    items = await target_item_collection.find(query).sort("Description", 1).to_list(limit)
    return [map_item_for_erp(item) for item in items]


@app.get("/erp/items/by-lookup/{lookup_code}", response_model=ERPItemOut)
async def get_erp_item_by_lookup(
    lookup_code: str,
    store_id: Optional[int] = Query(default=None),
):
    await ensure_price_change_updates_synced()
    item = await find_erp_item_by_lookup_or_id(lookup_code, store_id=store_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return map_item_for_erp(item)

@app.get("/erp/categories", response_model=List[ERPCategoryOut])
async def list_erp_categories(search: Optional[str] = Query(default="")):
    category_docs = await categories_collection.find({}).to_list(length=500)
    merged_categories = {}
    category_name_by_identity = {}
    categories_by_id = {}
    categories_by_name = {}

    for doc in category_docs:
        name = normalize_category_name(doc.get("name", doc.get("Name", "")))
        if not name:
            continue
        identity = get_category_identity(doc)
        if identity <= 0 or is_numeric_category_name(name):
            continue
        if identity > 0:
            category_name_by_identity[identity] = name
            categories_by_id[identity] = doc
        categories_by_name[name.casefold()] = doc

    item_counts = {}
    async for item_doc in item_collection.find(
        {},
        {
            "_id": 0,
            "Category": 1,
            "CategoryID": 1,
            "DepartmentID": 1,
        },
    ):
        resolved_name = resolve_item_dashboard_category_name(
            item_doc,
            categories_by_id=categories_by_id,
            categories_by_name=categories_by_name,
            uncategorized_label="",
        )
        if not resolved_name:
            continue
        item_counts[resolved_name] = int(item_counts.get(resolved_name, 0) or 0) + 1

    for doc in category_docs:
        name = normalize_category_name(doc.get("name", doc.get("Name", "")))
        if not name:
            continue
        identity = get_category_identity(doc)
        if identity <= 0 or is_numeric_category_name(name):
            continue
        key = name.casefold()
        raw_parent_id = doc.get("parent_id", 0)
        try:
            parent_id = int(raw_parent_id or 0)
        except (TypeError, ValueError):
            parent_id = 0
        parent_name = category_name_by_identity.get(parent_id, "")
        merged_categories[key] = map_category_for_erp(
            doc,
            item_count=item_counts.get(name, 0),
            parent_name=parent_name,
        )

    categories = list(merged_categories.values())
    search_value = str(search or "").strip().lower()
    if search_value:
        categories = [
            category
            for category in categories
            if search_value in category.name.lower()
            or search_value in category.code.lower()
            or search_value in category.parent.lower()
            or search_value in category.status.lower()
        ]

    return sorted(categories, key=lambda category: (category.name or "").lower())


@app.post("/erp/categories", response_model=ERPCategoryOut, status_code=201)
async def create_erp_category(payload: ERPCategoryCreate):
    name = normalize_category_name(payload.name)
    requested_parent_id = int(payload.parent_id or 0)
    parent = normalize_category_name(payload.parent)
    status = normalize_category_status(payload.status)

    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")

    existing = await categories_collection.find_one(
        {
            "$or": [
                {
                    "name": {
                        "$regex": f"^{re.escape(name)}$",
                        "$options": "i",
                    }
                },
                {
                    "Name": {
                        "$regex": f"^{re.escape(name)}$",
                        "$options": "i",
                    }
                },
            ]
        }
    )
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")

    parent_doc = None
    parent_name = ""
    if requested_parent_id > 0:
        parent_doc = await find_category_by_identity(requested_parent_id)
        if not parent_doc:
            raise HTTPException(status_code=400, detail="Selected parent category was not found")
        parent_name = normalize_category_name(parent_doc.get("name", parent_doc.get("Name", "")))
    elif parent:
        parent_doc = await categories_collection.find_one(
            {
                "$or": [
                    {
                        "name": {
                            "$regex": f"^{re.escape(parent)}$",
                            "$options": "i",
                        }
                    },
                    {
                        "Name": {
                            "$regex": f"^{re.escape(parent)}$",
                            "$options": "i",
                        }
                    },
                ]
            }
        )
        if not parent_doc:
            raise HTTPException(status_code=400, detail="Selected parent category was not found")
        parent_name = normalize_category_name(parent_doc.get("name", parent_doc.get("Name", "")))

    last_category = await categories_collection.find_one({}, sort=[("order", -1), ("ID", -1)])
    next_id = get_category_identity(last_category or {}) + 1
    now = datetime.utcnow()

    category_doc = {
        "name": name,
        "description": "",
        "icon": "",
        "author_id": 1,
        "author_type": "",
        "is_default": False,
        "is_featured": False,
        "order": next_id,
        "parent_id": get_category_identity(parent_doc or {}),
        "status": map_category_status_to_storage(status),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await categories_collection.insert_one(category_doc)
    return map_category_for_erp(category_doc, item_count=0, parent_name=parent_name)


@app.put("/erp/categories/{category_id}", response_model=ERPCategoryOut)
async def update_erp_category(category_id: int, payload: ERPCategoryCreate):
    existing_category = await find_category_by_identity(category_id)
    if not existing_category:
        raise HTTPException(status_code=404, detail="Category not found")

    name = normalize_category_name(payload.name)
    requested_parent_id = int(payload.parent_id or 0)
    parent = normalize_category_name(payload.parent)
    status = normalize_category_status(payload.status)

    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")

    duplicate_category = await categories_collection.find_one(
        {
            "$and": [
                {
                    "$or": [
                        {
                            "name": {
                                "$regex": f"^{re.escape(name)}$",
                                "$options": "i",
                            }
                        },
                        {
                            "Name": {
                                "$regex": f"^{re.escape(name)}$",
                                "$options": "i",
                            }
                        },
                    ]
                },
                {
                    "$nor": [
                        {"ID": int(category_id)},
                        {"order": int(category_id)},
                    ]
                },
            ]
        }
    )
    if duplicate_category:
        raise HTTPException(status_code=409, detail="Category already exists")

    parent_doc = None
    parent_name = ""
    existing_identity = get_category_identity(existing_category)
    if requested_parent_id > 0:
        if requested_parent_id == existing_identity:
            raise HTTPException(status_code=400, detail="A category cannot be its own parent")
        parent_doc = await find_category_by_identity(requested_parent_id)
        if not parent_doc:
            raise HTTPException(status_code=400, detail="Selected parent category was not found")
        parent_name = normalize_category_name(parent_doc.get("name", parent_doc.get("Name", "")))
    elif parent:
        parent_doc = await categories_collection.find_one(
            {
                "$or": [
                    {
                        "name": {
                            "$regex": f"^{re.escape(parent)}$",
                            "$options": "i",
                        }
                    },
                    {
                        "Name": {
                            "$regex": f"^{re.escape(parent)}$",
                            "$options": "i",
                        }
                    },
                ]
            }
        )
        if not parent_doc:
            raise HTTPException(status_code=400, detail="Selected parent category was not found")
        if get_category_identity(parent_doc) == existing_identity:
            raise HTTPException(status_code=400, detail="A category cannot be its own parent")
        parent_name = normalize_category_name(parent_doc.get("name", parent_doc.get("Name", "")))

    update_doc = {
        "name": name,
        "status": map_category_status_to_storage(status),
        "parent_id": get_category_identity(parent_doc or {}),
        "updated_at": datetime.utcnow().isoformat(),
    }

    await categories_collection.update_one(
        {
            "$or": [
                {"ID": existing_identity},
                {"order": existing_identity},
            ]
        },
        {"$set": update_doc},
    )

    updated_category = {**existing_category, **update_doc}
    return map_category_for_erp(updated_category, item_count=0, parent_name=parent_name)


@app.post("/erp/items", response_model=ERPItemOut, status_code=201)
async def create_erp_item(payload: ERPItemCreate):
    code = payload.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Item code is required")
    alias = payload.alias.strip()
    if not alias:
        raise HTTPException(status_code=400, detail="Alias (barcode) is required")
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    resolved_category_id, resolved_category_name = await resolve_item_category_selection(
        payload.category,
        payload.category_id,
    )

    if payload.price < 0 or payload.cost < 0 or payload.stock < 0 or payload.reorder_level < 0:
        raise HTTPException(status_code=400, detail="Price, cost, stock, and reorder level must be non-negative")

    computed_sale_price = (
        float(payload.sale_price)
        if payload.sale_price is not None
        else float(payload.cost) * (1 + (float(payload.markup_percent) / 100))
    )
    if computed_sale_price == 0:
        computed_sale_price = float(payload.price)
    if computed_sale_price < payload.cost:
        raise HTTPException(status_code=400, detail="Sale price cannot be below cost")

    existing = await item_collection.find_one({"ItemLookupCode": code})
    if existing:
        raise HTTPException(status_code=409, detail="Item code already exists")
    existing_alias = await item_collection.find_one({"$or": [{"Alias": alias}, {"alias": alias}]})
    if existing_alias:
        raise HTTPException(status_code=409, detail="Alias (barcode) already exists")

    last_item = await item_collection.find_one(
        {"ItemID": {"$type": "number"}},
        sort=[("ItemID", -1)]
    )
    next_item_id = int(last_item.get("ItemID", 0)) + 1 if last_item else 1

    item_doc = {
        "ItemID": next_item_id,
        "ItemLookupCode": code,
        "Alias": alias,
        "alias": alias,
        "Barcode": alias,
        "Description": description,
        "Category": resolved_category_name,
        "CategoryID": resolved_category_id,
        "DepartmentID": 0,
        "BinLocation": payload.bin_location.strip(),
        "Price": float(payload.price),
        "Cost": float(payload.cost),
        "SalePrice": computed_sale_price,
        "MarkupPercent": float(payload.markup_percent),
        "quantity": int(payload.stock),
        "ReorderPoint": float(payload.reorder_level),
        "Taxable": bool(payload.taxable),
        "Consignment": bool(payload.consignment),
        "DateCreated": datetime.utcnow(),
        "LastUpdated": datetime.utcnow(),
        "Inactive": False,
        "StoreID": 1,
    }
    await item_collection.insert_one(item_doc)
    return map_item_for_erp(item_doc)


@app.put("/erp/items/{lookup_code}", response_model=ERPItemOut)
async def update_erp_item(lookup_code: str, payload: ERPItemUpdate):
    code = payload.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Item code is required")
    alias = payload.alias.strip()
    if not alias:
        raise HTTPException(status_code=400, detail="Alias (barcode) is required")
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    resolved_category_id, resolved_category_name = await resolve_item_category_selection(
        payload.category,
        payload.category_id,
    )

    if payload.price < 0 or payload.cost < 0 or payload.stock < 0 or payload.reorder_level < 0:
        raise HTTPException(status_code=400, detail="Price, cost, stock, and reorder level must be non-negative")

    computed_sale_price = (
        float(payload.sale_price)
        if payload.sale_price is not None
        else float(payload.cost) * (1 + (float(payload.markup_percent) / 100))
    )
    if computed_sale_price == 0:
        computed_sale_price = float(payload.price)
    if computed_sale_price < payload.cost:
        raise HTTPException(status_code=400, detail="Sale price cannot be below cost")

    existing = await find_erp_item_by_lookup_or_id(lookup_code)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    code_owner = await item_collection.find_one(
        {"ItemLookupCode": code, "_id": {"$ne": existing["_id"]}}
    )
    if code_owner:
        raise HTTPException(status_code=409, detail="Item code already exists")

    alias_owner = await item_collection.find_one(
        {
            "$or": [{"Alias": alias}, {"alias": alias}],
            "_id": {"$ne": existing["_id"]},
        }
    )
    if alias_owner:
        raise HTTPException(status_code=409, detail="Alias (barcode) already exists")

    update_fields = {
        "ItemLookupCode": code,
        "Alias": alias,
        "alias": alias,
        "Barcode": alias,
        "Description": description,
        "Category": resolved_category_name,
        "CategoryID": resolved_category_id,
        "BinLocation": payload.bin_location.strip(),
        "Price": float(payload.price),
        "Cost": float(payload.cost),
        "SalePrice": computed_sale_price,
        "MarkupPercent": float(payload.markup_percent),
        "quantity": int(payload.stock),
        "ReorderPoint": float(payload.reorder_level),
        "Taxable": bool(payload.taxable),
        "Consignment": bool(payload.consignment),
        "LastUpdated": datetime.utcnow(),
    }

    await item_collection.update_one(
        {"_id": existing["_id"]},
        {"$set": update_fields}
    )
    updated = await item_collection.find_one({"_id": existing["_id"]})
    return map_item_for_erp(updated)


@app.patch("/erp/items/{lookup_code}/reorder-level", response_model=ERPItemOut)
async def update_erp_item_reorder_level(lookup_code: str, payload: ERPItemReorderLevelUpdate):
    if payload.reorder_level < 0:
        raise HTTPException(status_code=400, detail="Reorder level must be non-negative")

    existing = await find_erp_item_by_lookup_or_id(lookup_code)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    await item_collection.update_one(
        {"_id": existing["_id"]},
        {
            "$set": {
                "ReorderPoint": float(payload.reorder_level),
                "LastUpdated": datetime.utcnow(),
            }
        },
    )
    updated = await item_collection.find_one({"_id": existing["_id"]})
    return map_item_for_erp(updated)


@app.delete("/erp/items/{lookup_code}")
async def delete_erp_item(lookup_code: str):
    existing = await find_erp_item_by_lookup_or_id(lookup_code)
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    result = await item_collection.delete_one({"_id": existing["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item removed successfully", "lookup_code": lookup_code}


# Supplier endpoints read and write the live `supplier` collection schema.
@app.get("/erp/suppliers", response_model=List[ERPSupplierOut])
async def list_erp_suppliers(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
):
    query = {}
    if search:
        query = {
            "$or": [
                {"Code": {"$regex": search, "$options": "i"}},
                {"SupplierID": {"$regex": search, "$options": "i"}},
                {"SupplierName": {"$regex": search, "$options": "i"}},
                {"Company": {"$regex": search, "$options": "i"}},
                {"Contact.ContactName": {"$regex": search, "$options": "i"}},
                {"Contact.PhoneNumber": {"$regex": search, "$options": "i"}},
                {"Contact.EmailAddress": {"$regex": search, "$options": "i"}},
                {"Contact.WebPageAddress": {"$regex": search, "$options": "i"}},
                {"Address.Address1": {"$regex": search, "$options": "i"}},
                {"Address.City": {"$regex": search, "$options": "i"}},
                {"Address.Country": {"$regex": search, "$options": "i"}},
                {"Account.AccountNumber": {"$regex": search, "$options": "i"}},
                {"Account.TaxNumber": {"$regex": search, "$options": "i"}},
                {"Account.Terms": {"$regex": search, "$options": "i"}},
                {"Notes": {"$regex": search, "$options": "i"}},
                {"TypeofGoods": {"$regex": search, "$options": "i"}},
            ]
        }

    suppliers = await supplier_collection.find(query).sort("SupplierName", 1).to_list(limit)
    return [map_supplier_for_erp(supplier) for supplier in suppliers]


@app.post("/erp/suppliers", response_model=ERPSupplierOut, status_code=201)
async def create_erp_supplier(payload: ERPSupplierCreate):
    supplier_name = payload.supplier_name.strip()
    code = payload.code.strip() if payload.code else ""

    if not supplier_name:
        raise HTTPException(status_code=400, detail="Supplier name is required")

    last_supplier = await supplier_collection.find_one(
        {"ID": {"$type": "number"}},
        sort=[("ID", -1)]
    )
    next_id = int(last_supplier.get("ID", 0)) + 1 if last_supplier else 1

    if not code:
        code = f"SUP{next_id:03d}"

    existing_supplier = await supplier_collection.find_one(
        {
            "$or": [
                {"Code": code},
                {"SupplierID": code},
            ]
        }
    )
    if existing_supplier:
        raise HTTPException(status_code=409, detail="Supplier code already exists")

    supplier_doc = build_supplier_doc(next_id, payload, code)

    await supplier_collection.insert_one(supplier_doc)
    return map_supplier_for_erp(supplier_doc)


@app.put("/erp/suppliers/{supplier_id}", response_model=ERPSupplierOut)
async def update_erp_supplier(supplier_id: int, payload: ERPSupplierUpdate):
    existing = await supplier_collection.find_one({"ID": int(supplier_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Supplier not found")

    supplier_name = payload.supplier_name.strip()
    if not supplier_name:
        raise HTTPException(status_code=400, detail="Supplier name is required")

    current_code = str(existing.get("Code", existing.get("SupplierID", "")) or "").strip()
    code = payload.code.strip() if payload.code else current_code
    if not code:
        code = f"SUP{int(supplier_id):03d}"

    code_owner = await supplier_collection.find_one(
        {
            "$or": [
                {"Code": code},
                {"SupplierID": code},
            ],
            "ID": {"$ne": int(supplier_id)},
        }
    )
    if code_owner:
        raise HTTPException(status_code=409, detail="Supplier code already exists")

    supplier_doc = build_supplier_doc(int(supplier_id), payload, code)
    await supplier_collection.update_one({"_id": existing["_id"]}, {"$set": supplier_doc})
    updated = await supplier_collection.find_one({"_id": existing["_id"]})
    return map_supplier_for_erp(updated)


@app.get("/erp/purchase-orders", response_model=List[ERPPurchaseOrderOut])
async def list_erp_purchase_orders(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
):
    query = {}
    if search:
        supplier_matches = await supplier_collection.find(
            {
                "$or": [
                    {"SupplierName": {"$regex": search, "$options": "i"}},
                    {"Company": {"$regex": search, "$options": "i"}},
                    {"Code": {"$regex": search, "$options": "i"}},
                    {"SupplierID": {"$regex": search, "$options": "i"}},
                ]
            }
        ).to_list(200)
        matching_supplier_ids = [
            int(supplier.get("ID", 0) or 0)
            for supplier in supplier_matches
            if int(supplier.get("ID", 0) or 0) > 0
        ]
        query = {
            "$or": [
                {"PONumber": {"$regex": search, "$options": "i"}},
                {"POTitle": {"$regex": search, "$options": "i"}},
                {"PTo": {"$regex": search, "$options": "i"}},
                {"ShipTo": {"$regex": search, "$options": "i"}},
                {"Requisioner": {"$regex": search, "$options": "i"}},
                {"Remarks": {"$regex": search, "$options": "i"}},
                {"ConfirmingTo": {"$regex": search, "$options": "i"}},
                {"SupplierID": {"$in": matching_supplier_ids}},
            ]
        }

    purchase_orders = await purchase_order_collection.find(query).sort("DateCreated", -1).to_list(limit)
    if not purchase_orders:
        return []

    purchase_order_ids = [
        int(doc.get("WorkSheetID", doc.get("ID", 0)) or 0)
        for doc in purchase_orders
    ]
    supplier_ids = [int(doc.get("SupplierID", 0) or 0) for doc in purchase_orders]
    entries_lookup = await build_purchase_order_entries_lookup(purchase_order_ids)
    supplier_lookup = await build_supplier_name_lookup(supplier_ids)

    return [
        map_purchase_order_for_erp(
            doc,
            entries_lookup.get(int(doc.get("WorkSheetID", doc.get("ID", 0)) or 0), []),
            supplier_lookup.get(int(doc.get("SupplierID", 0) or 0), ""),
        )
        for doc in purchase_orders
    ]


@app.post("/erp/purchase-orders", response_model=ERPPurchaseOrderOut, status_code=201)
async def create_erp_purchase_order(payload: ERPPurchaseOrderCreate):
    po_title = payload.po_title.strip()
    p_to = payload.p_to.strip()
    ship_to = payload.ship_to.strip()
    requisioner = payload.requisioner.strip()

    if not po_title:
        raise HTTPException(status_code=400, detail="PO title is required")
    if not p_to:
        raise HTTPException(status_code=400, detail="Purchase order destination is required")
    if not ship_to:
        raise HTTPException(status_code=400, detail="Ship to location is required")
    if not requisioner:
        raise HTTPException(status_code=400, detail="Requisioner is required")
    if int(payload.supplier_id or 0) <= 0:
        raise HTTPException(status_code=400, detail="Supplier is required")
    if not payload.entries:
        raise HTTPException(status_code=400, detail="Add at least one item to the purchase order")
    if float(payload.shipping or 0) < 0:
        raise HTTPException(status_code=400, detail="Shipping cannot be negative")
    if float(payload.exchange_rate or 0) <= 0:
        raise HTTPException(status_code=400, detail="Exchange rate must be greater than zero")

    supplier = await supplier_collection.find_one({"ID": int(payload.supplier_id)})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    last_purchase_order = await purchase_order_collection.find_one(
        {"ID": {"$type": "number"}},
        sort=[("ID", -1)],
    )
    next_po_id = int(last_purchase_order.get("ID", 0)) + 1 if last_purchase_order else 1

    last_purchase_order_link = await purchase_order_collection.find_one(
        {"WorkSheetID": {"$type": "number"}},
        sort=[("WorkSheetID", -1)],
    )
    next_purchase_order_id = (
        int(last_purchase_order_link.get("WorkSheetID", 1000)) + 1
        if last_purchase_order_link
        else 1001
    )

    po_number = payload.po_number.strip() if payload.po_number else ""
    if not po_number:
        po_number = f"PO-{next_po_id:04d}"

    existing_number = await purchase_order_collection.find_one({"PONumber": po_number})
    if existing_number:
        raise HTTPException(status_code=409, detail="Purchase order number already exists")

    last_entry = await purchase_order_entries_collection.find_one(
        {"ID": {"$type": "number"}},
        sort=[("ID", -1)],
    )
    next_entry_id = int(last_entry.get("ID", 0)) + 1 if last_entry else 1

    now = datetime.utcnow()
    entry_docs = []
    for entry in payload.entries:
        item_lookup_code_input = str(entry.item_lookup_code or "").strip()
        item_id_value = int(entry.item_id or 0) if entry.item_id is not None else 0

        if item_id_value <= 0 and not item_lookup_code_input:
            raise HTTPException(status_code=400, detail="Every purchase order line must have an item")
        if float(entry.quantity_ordered or 0) <= 0:
            raise HTTPException(status_code=400, detail="Ordered quantity must be greater than zero")

        item_doc = None
        if item_id_value > 0:
            item_doc = await item_collection.find_one({"ItemID": item_id_value})
        if not item_doc and item_lookup_code_input:
            item_doc = await item_collection.find_one({"ItemLookupCode": item_lookup_code_input})
        if not item_doc:
            identifier = item_lookup_code_input or str(item_id_value)
            raise HTTPException(status_code=404, detail=f"Item {identifier} was not found")

        item_id = int(item_doc.get("ItemID") or entry.item_id or 0)
        item_lookup_code = str(item_doc.get("ItemLookupCode", entry.item_lookup_code or "") or "")
        item_description = (
            entry.item_description.strip()
            if entry.item_description and entry.item_description.strip()
            else str(item_doc.get("Description", "") or "")
        )
        line_price = float(
            item_doc.get(
                "Price",
                entry.price if entry.price is not None else 0,
            )
            or 0
        )
        costed_price = float(
            item_doc.get(
                "Cost",
                item_doc.get(
                    "LastCost",
                    entry.costed_price if entry.costed_price is not None else line_price,
                ),
            )
            or line_price
        )
        line_tax_rate = float(
            entry.tax_rate
            if entry.tax_rate is not None
            else (payload.tax_rate or 0)
        )

        if line_price < 0 or costed_price < 0:
            raise HTTPException(status_code=400, detail="Item price or cost cannot be negative")

        entry_docs.append(
            {
                "ID": next_entry_id,
                "PurchaseOrderID": next_purchase_order_id,
                "StoreID": int(payload.store_id or 1),
                "ItemID": item_id,
                "ItemLookupCode": item_lookup_code,
                "ItemDescription": item_description,
                "QuantityOrdered": float(entry.quantity_ordered or 0),
                "QuantityReceived": 0,
                "QuantityReceivedToDate": 0,
                "Price": line_price,
                "CostedPrice": costed_price,
                "TaxRate": line_tax_rate,
                "OrderNumber": po_number,
                "InventoryOfflineID": 0,
                "LastUpdated": now,
            }
        )
        next_entry_id += 1

    batch_number = int(payload.batch_number) if payload.batch_number is not None else 5000 + next_po_id
    pay_ref = int(payload.pay_ref) if payload.pay_ref is not None else 90000 + next_po_id
    required_date = parse_optional_erp_datetime(payload.required_date)
    date_placed = (
        parse_optional_erp_datetime(payload.date_placed) or now
        if bool(payload.is_placed)
        else None
    )

    purchase_order_doc = {
        "ID": next_po_id,
        "LastUpdated": now,
        "POTitle": po_title,
        "POType": int(payload.po_type or 1),
        "StoreID": int(payload.store_id or 1),
        "WorkSheetID": next_purchase_order_id,
        "PONumber": po_number,
        "PStatus": int(payload.p_status or 0),
        "DateCreated": now,
        "PTo": p_to,
        "ShipTo": ship_to,
        "Requisioner": requisioner,
        "ShipVia": payload.ship_via.strip() if payload.ship_via else "",
        "FOBPoint": payload.fob_point.strip() if payload.fob_point else "",
        "Terms": payload.terms.strip() if payload.terms else "",
        "TaxRate": float(payload.tax_rate or 0),
        "Shipping": float(payload.shipping or 0),
        "Freight": payload.freight.strip() if payload.freight else "",
        "RequiredDate": required_date,
        "ConfirmingTo": payload.confirming_to.strip() if payload.confirming_to else "",
        "Remarks": payload.remarks.strip() if payload.remarks else "",
        "SupplierID": int(payload.supplier_id),
        "OtherStoreID": 0,
        "CurrencyID": int(payload.currency_id or 1),
        "ExchangeRate": float(payload.exchange_rate or 1),
        "UserID": int(payload.user_id or 1),
        "UserID2": None,
        "OtherPOID": None,
        "OldSupplierID": None,
        "InventoryLocation": int(payload.inventory_location or 1),
        "IsPlaced": bool(payload.is_placed),
        "DatePlaced": date_placed,
        "BatchNumber": batch_number,
        "PayRef": pay_ref,
        "POisCancelled": False,
        "POCancelledby": None,
        "POCancelledOn": None,
        "POAmendedby": None,
        "POAmendedon": None,
        "Picked": False,
    }

    await purchase_order_collection.insert_one(purchase_order_doc)
    await purchase_order_entries_collection.insert_many(entry_docs)

    supplier_name = str(supplier.get("SupplierName", supplier.get("Company", "")) or "")
    return map_purchase_order_for_erp(purchase_order_doc, entry_docs, supplier_name)


@app.get("/erp/price-changes", response_model=List[ERPPriceChangeOut])
async def list_erp_price_changes(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
):
    await ensure_price_change_updates_synced(force=True)

    query = {}
    if search:
        regex = {"$regex": search, "$options": "i"}
        query = {
            "$or": [
                {"Description": regex},
                {"Vendor": regex},
                {"Status": regex},
                {"User": regex},
                {"Remarks": regex},
                {"Items": {"$elemMatch": {"ItemLookupCode": regex}}},
                {"Items": {"$elemMatch": {"Description": regex}}},
            ]
        }

    changes = await price_change_collection.find(query).sort(
        [("Time", -1), ("ID", -1)]
    ).to_list(limit)
    return [map_price_change_for_erp(change) for change in changes]


@app.get("/erp/adjustments", response_model=List[ERPAdjustmentOut])
async def list_erp_adjustments(
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
):
    query = {}
    if search:
        regex = {"$regex": search, "$options": "i"}
        query = {
            "$or": [
                {"Reference": regex},
                {"Reason": regex},
                {"Item": regex},
                {"SKU": regex},
                {"RequestedBy": regex},
                {"Status": regex},
                {"Location": regex},
                {"Note": regex},
                {"ApprovedBy": regex},
            ]
        }

    adjustments = await adjustment_collection.find(query).sort(
        [("RequestedAt", -1), ("AdjustmentID", -1)]
    ).to_list(limit)
    return [map_adjustment_for_erp(adjustment) for adjustment in adjustments]


@app.post("/erp/adjustments", response_model=ERPAdjustmentOut, status_code=201)
async def create_erp_adjustment(payload: ERPAdjustmentCreate):
    item = str(payload.item or "").strip()
    if not item:
        raise HTTPException(status_code=400, detail="Item description is required")

    try:
        quantity = float(payload.quantity or 0)
    except (TypeError, ValueError):
        quantity = 0.0
    if abs(quantity) <= 0:
        raise HTTPException(status_code=400, detail="Adjustment quantity must be greater than zero")

    now = datetime.utcnow()
    last_adjustment = await adjustment_collection.find_one(
        {"AdjustmentID": {"$type": "number"}},
        sort=[("AdjustmentID", -1)],
    )
    next_id = int(last_adjustment.get("AdjustmentID", 0) or 0) + 1 if last_adjustment else 1

    normalized_reason = str(payload.reason or "").strip() or "Bin correction"
    normalized_location = str(payload.location or "").strip() or "Warehouse A"
    normalized_status = normalize_adjustment_status(payload.status)
    requested_by = str(payload.requested_by or "").strip()
    approved_by = str(payload.approved_by or "").strip()
    effective_date = parse_optional_erp_datetime(payload.effective_date)
    impact = str(payload.impact or "").strip() or build_adjustment_impact(
        normalized_reason,
        quantity,
        normalized_location,
    )

    adjustment_doc = {
        "AdjustmentID": next_id,
        "Reference": build_adjustment_reference(next_id),
        "Item": item,
        "SKU": str(payload.sku or "").strip(),
        "Quantity": quantity,
        "Reason": normalized_reason,
        "RequestedBy": requested_by,
        "Status": normalized_status,
        "Location": normalized_location,
        "RequestedAt": now,
        "ApprovedBy": approved_by,
        "Note": str(payload.note or "").strip(),
        "Impact": impact,
        "StoreID": parse_price_change_store_id(payload.store_id, default=1),
        "EffectiveDate": effective_date,
        "LastUpdated": now,
    }

    await adjustment_collection.insert_one(adjustment_doc)
    created = await adjustment_collection.find_one({"AdjustmentID": next_id})
    return map_adjustment_for_erp(created)


@app.post("/erp/adjustments/{adjustment_reference}/approve", response_model=ERPAdjustmentOut)
async def approve_erp_adjustment(adjustment_reference: str, request: Request):
    normalized_reference = str(adjustment_reference or "").strip()
    if not normalized_reference:
        raise HTTPException(status_code=400, detail="Adjustment reference is required")

    reference_query = {"Reference": normalized_reference}
    if normalized_reference.isdigit():
        reference_query = {
            "$or": [
                {"Reference": normalized_reference},
                {"AdjustmentID": int(normalized_reference)},
            ]
        }

    adjustment_doc = await adjustment_collection.find_one(reference_query)
    if not adjustment_doc:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    current_status = normalize_adjustment_status(adjustment_doc.get("Status", "Pending"))
    if current_status != "Pending":
        raise HTTPException(status_code=400, detail=f"Adjustment is already {current_status.lower()}")

    quantity = float(adjustment_doc.get("Quantity", 0) or 0)
    if abs(quantity) <= 0:
        raise HTTPException(status_code=400, detail="Adjustment quantity must be greater than zero")

    store_id = parse_price_change_store_id(adjustment_doc.get("StoreID", 1), default=1)
    sku = str(adjustment_doc.get("SKU", "") or "").strip()
    if not sku:
        raise HTTPException(status_code=400, detail="Adjustment needs a lookup code before approval")

    target_item_collection = get_price_change_item_collection(store_id)
    item_doc = await find_erp_item_by_lookup_or_id(sku, store_id)
    if not item_doc:
        raise HTTPException(status_code=404, detail=f"Item {sku} was not found")

    now = datetime.utcnow()
    approved_by = str(request.headers.get("x-erp-user", "") or "").strip()
    if not approved_by:
        approved_by = str(adjustment_doc.get("RequestedBy", "") or "").strip()

    await target_item_collection.update_one(
        {"_id": item_doc["_id"]},
        {
            "$inc": {"quantity": quantity},
            "$set": {"LastUpdated": now},
        },
    )

    await adjustment_collection.update_one(
        {"_id": adjustment_doc["_id"]},
        {
            "$set": {
                "Status": "Posted",
                "ApprovedBy": approved_by,
                "ApprovedAt": now,
                "LastUpdated": now,
                "Impact": f"Approved and posted {quantity:+g} units to item {sku}.",
            }
        },
    )

    updated = await adjustment_collection.find_one({"_id": adjustment_doc["_id"]})
    return map_adjustment_for_erp(updated)


@app.get("/erp/price-changes/history/{lookup_code}", response_model=List[ERPPriceChangeHistoryRow])
async def list_erp_price_change_history(
    lookup_code: str,
    store_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    await ensure_price_change_updates_synced(force=True)

    normalized_lookup = str(lookup_code or "").strip()
    if not normalized_lookup:
        return []

    source_item = await find_erp_item_by_lookup_or_id(normalized_lookup, store_id=store_id)
    if source_item:
        normalized_lookup = str(source_item.get("ItemLookupCode", normalized_lookup) or "").strip()

    if not normalized_lookup:
        return []

    query = {
        "Items": {
            "$elemMatch": {
                "ItemLookupCode": {
                    "$regex": f"^{re.escape(normalized_lookup)}$",
                    "$options": "i",
                }
            }
        }
    }
    if store_id is not None:
        query["StoreID"] = parse_price_change_store_id(store_id, default=0)

    change_docs = await price_change_collection.find(query).sort(
        [("EffectDate", -1), ("Time", -1), ("ID", -1)]
    ).to_list(limit)

    history_rows = []
    for change_doc in change_docs:
        for item_doc in change_doc.get("Items", []):
            if not isinstance(item_doc, dict):
                continue

            item_lookup_code = str(item_doc.get("ItemLookupCode", "") or "").strip()
            if item_lookup_code.casefold() != normalized_lookup.casefold():
                continue

            history_rows.append(
                map_price_change_history_row(
                    change_doc,
                    item_doc,
                    source_item=source_item,
                )
            )

    return history_rows


@app.get("/erp/price-changes/{change_id}", response_model=ERPPriceChangeOut)
async def get_erp_price_change(change_id: int):
    await ensure_price_change_updates_synced(force=True)

    change = await price_change_collection.find_one({"ID": int(change_id)})
    if not change:
        raise HTTPException(status_code=404, detail="Price change not found")

    return map_price_change_for_erp(change)


@app.post("/erp/price-changes", response_model=ERPPriceChangeOut, status_code=201)
async def create_erp_price_change(payload: ERPPriceChangeCreate):
    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one item to the price change")

    now = datetime.utcnow()
    last_change = await price_change_collection.find_one(
        {"ID": {"$type": "number"}},
        sort=[("ID", -1)],
    )
    next_id = int(last_change.get("ID", 0) or 0) + 1 if last_change else 1

    seen_lookup_codes = set()
    item_docs = []
    for item_payload in payload.items:
        lookup_code = str(item_payload.item_lookup_code or "").strip()
        if not lookup_code:
            raise HTTPException(status_code=400, detail="Each price change item needs a lookup code")
        normalized_lookup = lookup_code.lower()
        if normalized_lookup in seen_lookup_codes:
            raise HTTPException(status_code=409, detail=f"Duplicate price change item: {lookup_code}")
        seen_lookup_codes.add(normalized_lookup)

        source_item = await find_erp_item_by_lookup_or_id(
            lookup_code,
            store_id=payload.store_id,
        )
        if not source_item:
            raise HTTPException(status_code=404, detail=f"Item not found: {lookup_code}")

        item_docs.append(build_price_change_item_doc(item_payload, source_item=source_item, now=now))

    price_change_doc = build_price_change_doc(next_id, payload, item_docs, now=now)
    await price_change_collection.insert_one(price_change_doc)
    created = await price_change_collection.find_one({"ID": next_id})

    next_status = normalize_price_change_status(payload.status)
    effect_date = parse_price_change_datetime(payload.effect_date)
    if next_status == "Applied" or (
        next_status == "Approved" and (effect_date is None or effect_date <= now)
    ):
        created, _ = await apply_price_change_document(created, applied_at=now)

    return map_price_change_for_erp(created)


@app.put("/erp/price-changes/{change_id}", response_model=ERPPriceChangeOut)
async def update_erp_price_change(change_id: int, payload: ERPPriceChangeUpdate):
    existing = await price_change_collection.find_one({"ID": int(change_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Price change not found")

    description = payload.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one item to the price change")

    now = datetime.utcnow()
    existing_item_docs = existing.get("Items", []) if isinstance(existing.get("Items"), list) else []
    existing_items_by_lookup = {}
    existing_items_by_id = {}
    for existing_item_doc in existing_item_docs:
        if not isinstance(existing_item_doc, dict):
            continue

        existing_lookup_code = str(existing_item_doc.get("ItemLookupCode", "") or "").strip().lower()
        if existing_lookup_code:
            existing_items_by_lookup[existing_lookup_code] = existing_item_doc

        try:
            existing_item_id = int(existing_item_doc.get("ID", 0) or 0)
        except (TypeError, ValueError):
            existing_item_id = 0
        if existing_item_id > 0:
            existing_items_by_id[existing_item_id] = existing_item_doc

    seen_lookup_codes = set()
    item_docs = []
    for item_payload in payload.items:
        lookup_code = str(item_payload.item_lookup_code or "").strip()
        if not lookup_code:
            raise HTTPException(status_code=400, detail="Each price change item needs a lookup code")
        normalized_lookup = lookup_code.lower()
        if normalized_lookup in seen_lookup_codes:
            raise HTTPException(status_code=409, detail=f"Duplicate price change item: {lookup_code}")
        seen_lookup_codes.add(normalized_lookup)

        source_item = await find_erp_item_by_lookup_or_id(
            lookup_code,
            store_id=payload.store_id,
        )
        if not source_item:
            raise HTTPException(status_code=404, detail=f"Item not found: {lookup_code}")

        existing_price_change_item = None
        try:
            incoming_item_id = int(item_payload.id or 0)
        except (TypeError, ValueError):
            incoming_item_id = 0

        if incoming_item_id > 0:
            existing_price_change_item = existing_items_by_id.get(incoming_item_id)
        if existing_price_change_item is None:
            existing_price_change_item = existing_items_by_lookup.get(normalized_lookup)

        item_docs.append(
            build_price_change_item_doc(
                item_payload,
                source_item=source_item,
                existing_price_change_item=existing_price_change_item,
                now=now,
            )
        )

    update_doc = build_price_change_doc(
        int(change_id),
        payload,
        item_docs,
        now=now,
        existing_doc=existing,
    )
    await price_change_collection.update_one(
        {"_id": existing["_id"]},
        {"$set": update_doc},
    )
    updated = await price_change_collection.find_one({"_id": existing["_id"]})

    next_status = normalize_price_change_status(payload.status)
    effect_date = parse_price_change_datetime(payload.effect_date)
    if next_status == "Applied" or (
        next_status == "Approved" and (effect_date is None or effect_date <= now)
    ):
        updated, _ = await apply_price_change_document(updated, applied_at=now)

    return map_price_change_for_erp(updated)


@app.post("/erp/price-changes/{change_id}/approve", response_model=ERPPriceChangeOut)
async def approve_erp_price_change(change_id: int, payload: ERPPriceChangeAction):
    existing = await price_change_collection.find_one({"ID": int(change_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Price change not found")

    now = datetime.utcnow()
    remarks = str(payload.remarks or "").strip()
    update_fields = {
        "Status": "Approved",
        "ApprovedAt": now,
        "LastUpdated": now,
    }
    if str(payload.user or "").strip():
        update_fields["User"] = str(payload.user).strip()
    if remarks:
        update_fields["Remarks"] = remarks

    await price_change_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
    updated = await price_change_collection.find_one({"_id": existing["_id"]})

    effect_date = parse_price_change_datetime(updated.get("EffectDate"))
    if effect_date is None or effect_date <= now:
        updated, _ = await apply_price_change_document(updated, applied_at=now)

    return map_price_change_for_erp(updated)


@app.post("/erp/price-changes/{change_id}/apply", response_model=ERPPriceChangeOut)
async def apply_erp_price_change(change_id: int, payload: ERPPriceChangeAction):
    existing = await price_change_collection.find_one({"ID": int(change_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Price change not found")
    if not existing.get("Items"):
        raise HTTPException(status_code=400, detail="This price change has no items to apply")

    now = datetime.utcnow()
    update_fields = {
        "Status": "Approved",
        "ApprovedAt": parse_price_change_datetime(existing.get("ApprovedAt")) or now,
        "EffectDate": now,
        "LastUpdated": now,
    }
    if str(payload.user or "").strip():
        update_fields["User"] = str(payload.user).strip()
    if str(payload.remarks or "").strip():
        update_fields["Remarks"] = str(payload.remarks).strip()

    await price_change_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
    refreshed = await price_change_collection.find_one({"_id": existing["_id"]})
    applied, _ = await apply_price_change_document(refreshed, applied_at=now)
    return map_price_change_for_erp(applied)


@app.post("/erp/price-changes/{change_id}/cancel", response_model=ERPPriceChangeOut)
async def cancel_erp_price_change(change_id: int, payload: ERPPriceChangeAction):
    existing = await price_change_collection.find_one({"ID": int(change_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Price change not found")
    if normalize_price_change_status(existing.get("Status")) == "Applied":
        raise HTTPException(status_code=409, detail="Applied price changes cannot be cancelled")

    now = datetime.utcnow()
    update_fields = {
        "Status": "Cancelled",
        "LastUpdated": now,
    }
    if str(payload.user or "").strip():
        update_fields["User"] = str(payload.user).strip()
    if str(payload.remarks or "").strip():
        update_fields["Remarks"] = str(payload.remarks).strip()

    await price_change_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
    cancelled = await price_change_collection.find_one({"_id": existing["_id"]})
    return map_price_change_for_erp(cancelled)


@app.get("/erp/users", response_model=List[ERPUserOut])
async def list_erp_users(search: Optional[str] = Query(default=None), limit: int = Query(default=300, ge=1, le=2000)):
    query = {}
    if search:
        query = {
            "$or": [
                {"Number": {"$regex": search, "$options": "i"}},
                {"Name": {"$regex": search, "$options": "i"}},
                {"EmailAddress": {"$regex": search, "$options": "i"}},
                {"Telephone": {"$regex": search, "$options": "i"}},
            ]
        }

    users = await cashier_collection.find(query).sort("ID", 1).to_list(limit)
    return [map_cashier_for_erp(user) for user in users]


@app.post("/erp/users", response_model=ERPUserOut, status_code=201)
async def create_erp_user(payload: ERPUserCreate):
    number = payload.number.strip()
    password = payload.password.strip()
    name = payload.name.strip() if payload.name else ""
    email_address = payload.email_address.strip() if payload.email_address else ""
    telephone = payload.telephone.strip() if payload.telephone else ""
    user_role = payload.user_role.strip() if payload.user_role else "Cashier"

    if not number:
        raise HTTPException(status_code=400, detail="User number is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if payload.floor_limit < 0:
        raise HTTPException(status_code=400, detail="Floor limit cannot be negative")
    if payload.drop_limit < 0:
        raise HTTPException(status_code=400, detail="Drop limit cannot be negative")

    existing = await find_cashier_by_number(number)
    if existing:
        raise HTTPException(status_code=409, detail="User number already exists")

    last_user = await cashier_collection.find_one(
        {"ID": {"$type": "number"}},
        sort=[("ID", -1)]
    )
    next_id = int(last_user.get("ID", 0)) + 1 if last_user else 1

    user_doc = {
        "ID": next_id,
        "LastUpdated": datetime.utcnow(),
        "Number": number,
        "StoreID": int(payload.store_id),
        "Name": name if name else None,
        "Pass": password,
        "FloorLimit": float(payload.floor_limit),
        "ReturnLimit": 0,
        "DropLimit": float(payload.drop_limit),
        "CashDrawerNumber": 0,
        "SecurityLevel": 0,
        "UserRole": user_role or "Cashier",
        "Priviledges": int(payload.priviledges),
        "EmailAddress": email_address if email_address else None,
        "FailedLogonAttempts": 0,
        "MaxOverShortAmount": 0,
        "MaxOverShortPercent": 0,
        "OverShortLimitType": 0,
        "Telephone": telephone if telephone else None,
        "Enabled": bool(payload.enabled),
        "TimeSchedule": False,
        "LastPasswordChange": None,
        "PassExpires": True,
        "InventoryLocation": 0,
        "SalesRepID": 0,
        "BinLocation": None,
        "Signature": None,
    }

    await cashier_collection.insert_one(user_doc)
    return map_cashier_for_erp(user_doc)


@app.put("/erp/users/{user_id}", response_model=ERPUserOut)
async def update_erp_user(user_id: int, payload: ERPUserUpdate):
    number = payload.number.strip()
    name = payload.name.strip() if payload.name else ""
    user_role = payload.user_role.strip() if payload.user_role else "Cashier"
    email_address = payload.email_address.strip() if payload.email_address else ""
    telephone = payload.telephone.strip() if payload.telephone else ""
    password = payload.password.strip() if payload.password else ""

    if not number:
        raise HTTPException(status_code=400, detail="User number is required")
    if payload.floor_limit < 0:
        raise HTTPException(status_code=400, detail="Floor limit cannot be negative")
    if payload.drop_limit < 0:
        raise HTTPException(status_code=400, detail="Drop limit cannot be negative")

    existing = await cashier_collection.find_one({"ID": int(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    number_owner = await cashier_collection.find_one(
        {
            "Number": {
                "$regex": f"^{re.escape(number)}$",
                "$options": "i",
            },
            "ID": {"$ne": int(user_id)},
        }
    )
    if number_owner:
        raise HTTPException(status_code=409, detail="User number already exists")

    update_fields = {
        "Number": number,
        "Name": name if name else None,
        "UserRole": user_role or "Cashier",
        "EmailAddress": email_address if email_address else None,
        "Telephone": telephone if telephone else None,
        "FloorLimit": float(payload.floor_limit),
        "DropLimit": float(payload.drop_limit),
        "Enabled": bool(payload.enabled),
        "LastUpdated": datetime.utcnow(),
    }
    if password:
        update_fields["Pass"] = password

    await cashier_collection.update_one(
        {"ID": int(user_id)},
        {"$set": update_fields}
    )
    updated = await cashier_collection.find_one({"ID": int(user_id)})
    return map_cashier_for_erp(updated)


@app.get("/auth/configuration", response_model=AuthConfigurationOut)
async def get_auth_configuration():
    biometrics_value = parse_config_int(await get_configuration_value("Biometrics", 0), default=0)
    threshold = await get_fingerprint_match_threshold()
    enrolled_fingerprint_users = await count_enrolled_fingerprint_users()
    return AuthConfigurationOut(
        biometrics=biometrics_value == 1,
        biometrics_value=biometrics_value,
        fingerprint_match_threshold=threshold,
        enrolled_fingerprint_users=enrolled_fingerprint_users,
        biometrics_bootstrap_required=biometrics_value == 1 and enrolled_fingerprint_users == 0,
    )


@app.post("/auth/login/password", response_model=ERPUserOut)
async def login_with_password(payload: PasswordLoginRequest):
    biometrics_enabled = await get_biometrics_enabled()
    enrolled_fingerprint_users = await count_enrolled_fingerprint_users()
    if biometrics_enabled and enrolled_fingerprint_users > 0:
        raise HTTPException(
            status_code=403,
            detail="Password login is disabled because Biometrics is enabled in configurations.",
        )

    number = payload.number.strip()
    password = payload.password.strip()

    if not number:
        raise HTTPException(status_code=400, detail="Cashier number is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    cashier = await find_cashier_by_number(number)
    if not cashier:
        raise HTTPException(status_code=401, detail="Invalid cashier number or password")

    if not bool(cashier.get("Enabled", True)):
        raise HTTPException(status_code=403, detail="This cashier account is disabled")

    stored_password = str(cashier.get("Pass", "") or "").strip()
    if stored_password != password:
        await cashier_collection.update_one(
            {"_id": cashier["_id"]},
            {"$inc": {"FailedLogonAttempts": 1}},
        )
        raise HTTPException(status_code=401, detail="Invalid cashier number or password")

    await cashier_collection.update_one(
        {"_id": cashier["_id"]},
        {
            "$set": {
                "FailedLogonAttempts": 0,
                "LastLogonAt": datetime.utcnow(),
            }
        },
    )
    cashier["FailedLogonAttempts"] = 0
    return map_cashier_for_erp(cashier)


@app.get("/auth/fingerprint-users", response_model=List[FingerprintAuthCandidate])
async def get_fingerprint_auth_candidates(number: Optional[str] = Query(default=None)):
    query = {"Enabled": True}
    if number and number.strip():
        query["Number"] = {
            "$regex": f"^{re.escape(number.strip())}$",
            "$options": "i",
        }

    users = await cashier_collection.find(query).sort("ID", 1).to_list(1000)
    candidates = []
    for user in users:
        template_base64 = get_cashier_fingerprint_template(user)
        if not template_base64:
            continue

        candidates.append(
            FingerprintAuthCandidate(
                id=int(user.get("ID", 0) or 0),
                number=str(user.get("Number", "") or ""),
                name=str(user.get("Name", "") or ""),
                user_role=str(user.get("UserRole", "") or ""),
                store_id=int(user.get("StoreID", 1) or 1),
                template_base64=template_base64,
                template_format=get_cashier_fingerprint_format(user),
                fingerprint_updated_at=get_cashier_fingerprint_updated_at(user),
            )
        )

    return candidates


@app.post("/auth/users/{user_id}/fingerprint", response_model=ERPUserOut)
async def save_user_fingerprint(user_id: int, payload: FingerprintEnrollmentRequest):
    existing = await cashier_collection.find_one({"ID": int(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    template_base64 = payload.template_base64.strip()
    if not template_base64:
        raise HTTPException(status_code=400, detail="Fingerprint template is required")

    update_fields = {
        "FingerprintTemplate": template_base64,
        "FingerprintTemplateFormat": (payload.template_format or "STANDARDPRO").strip().upper() or "STANDARDPRO",
        "FingerprintUpdatedAt": datetime.utcnow(),
        "LastUpdated": datetime.utcnow(),
    }

    if payload.image_quality is not None:
        update_fields["FingerprintImageQuality"] = int(payload.image_quality)
    if payload.nfiq is not None:
        update_fields["FingerprintNfiq"] = int(payload.nfiq)
    if payload.device_model:
        update_fields["FingerprintDeviceModel"] = payload.device_model.strip()
    if payload.device_serial:
        update_fields["FingerprintDeviceSerial"] = payload.device_serial.strip()

    await cashier_collection.update_one({"ID": int(user_id)}, {"$set": update_fields})
    updated = await cashier_collection.find_one({"ID": int(user_id)})
    return map_cashier_for_erp(updated)


@app.get("/erp/dashboard/summary", response_model=ERPDashboardSummaryOut)
async def get_erp_dashboard_summary():
    total_baskets = await transaction_collection.count_documents({})
    totals = await transaction_collection.aggregate(
        [
            {
                "$project": {
                    "numeric_total": {
                        "$convert": {
                            "input": "$Total",
                            "to": "double",
                            "onError": 0,
                            "onNull": 0,
                        }
                    }
                }
            },
            {"$group": {"_id": None, "total_sales": {"$sum": "$numeric_total"}}},
        ]
    ).to_list(length=1)
    total_sales = float((totals[0] if totals else {}).get("total_sales", 0) or 0)
    return ERPDashboardSummaryOut(total_sales=total_sales, total_baskets=total_baskets)


@app.get("/erp/dashboard/daily-sales", response_model=ERPDashboardDailySalesOut)
async def get_erp_dashboard_daily_sales(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
):
    today = datetime.utcnow().date()
    resolved_date_to = date_to or today
    resolved_date_from = date_from or resolved_date_to.replace(day=1)

    if resolved_date_from > resolved_date_to:
        raise HTTPException(status_code=400, detail="Date From cannot be later than Date To")

    start_datetime = datetime.combine(resolved_date_from, datetime.min.time())
    end_datetime = datetime.combine(resolved_date_to + timedelta(days=1), datetime.min.time())

    rows = await transaction_collection.aggregate(
        [
            {
                "$match": {
                    "sdateTime": {
                        "$gte": start_datetime,
                        "$lt": end_datetime,
                    }
                }
            },
            {
                "$project": {
                    "day_key": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$sdateTime",
                        }
                    },
                    "numeric_total": {
                        "$convert": {
                            "input": "$Total",
                            "to": "double",
                            "onError": 0,
                            "onNull": 0,
                        }
                    },
                }
            },
            {
                "$group": {
                    "_id": "$day_key",
                    "sales": {"$sum": "$numeric_total"},
                }
            },
            {"$sort": {"_id": 1}},
        ]
    ).to_list(length=400)

    sales_lookup = {
        str(row.get("_id", "")): float(row.get("sales", 0) or 0)
        for row in rows
    }

    points: List[ERPDashboardDailySalesPointOut] = []
    cursor = resolved_date_from
    total_sales = 0.0

    while cursor <= resolved_date_to:
        day_key = cursor.isoformat()
        sales = float(sales_lookup.get(day_key, 0) or 0)
        total_sales += sales
        points.append(
            ERPDashboardDailySalesPointOut(
                date=day_key,
                label=cursor.strftime("%d %b"),
                sales=sales,
            )
        )
        cursor += timedelta(days=1)

    return ERPDashboardDailySalesOut(
        date_from=resolved_date_from,
        date_to=resolved_date_to,
        total_sales=total_sales,
        points=points,
    )


@app.get("/erp/dashboard/category-sales", response_model=ERPDashboardCategorySalesOut)
async def get_erp_dashboard_category_sales(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
):
    today = datetime.utcnow().date()
    resolved_date_to = date_to or today
    resolved_date_from = date_from or resolved_date_to.replace(day=1)

    if resolved_date_from > resolved_date_to:
        raise HTTPException(status_code=400, detail="Date From cannot be later than Date To")

    start_datetime = datetime.combine(resolved_date_from, datetime.min.time())
    end_datetime = datetime.combine(resolved_date_to + timedelta(days=1), datetime.min.time())

    transactions = await transaction_collection.find(
        {
            "sdateTime": {
                "$gte": start_datetime,
                "$lt": end_datetime,
            }
        },
        {
            "_id": 0,
            "TransactionID": 1,
        },
    ).to_list(length=10000)

    transaction_ids = [row.get("TransactionID") for row in transactions if row.get("TransactionID") is not None]
    if not transaction_ids:
        return ERPDashboardCategorySalesOut(
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            total_sales=0.0,
            categories=[],
        )

    transaction_items = await transaction_items_collection.find(
        {"TransactionID": {"$in": transaction_ids}},
        {
            "_id": 0,
            "ItemID": 1,
            "Quantity": 1,
            "Price": 1,
        },
    ).to_list(length=50000)

    if not transaction_items:
        return ERPDashboardCategorySalesOut(
            date_from=resolved_date_from,
            date_to=resolved_date_to,
            total_sales=0.0,
            categories=[],
        )

    item_keys = sorted(
        {
            str(row.get("ItemID", "")).strip()
            for row in transaction_items
            if str(row.get("ItemID", "")).strip()
        }
    )
    numeric_item_keys = [int(key) for key in item_keys if key.isdigit()]

    item_match_filters = []
    if item_keys:
        item_match_filters.append({"ItemLookupCode": {"$in": item_keys}})
    if numeric_item_keys:
        item_match_filters.append({"ItemLookupCode": {"$in": numeric_item_keys}})
        item_match_filters.append({"ItemID": {"$in": numeric_item_keys}})

    item_docs = await item_collection.find(
        {"$or": item_match_filters} if item_match_filters else {"_id": None},
        {
            "_id": 0,
            "ItemLookupCode": 1,
            "ItemID": 1,
            "Category": 1,
            "CategoryID": 1,
            "DepartmentID": 1,
        },
    ).to_list(length=max(len(item_keys) * 2, 100))

    category_docs = await categories_collection.find(
        {},
        {
            "_id": 0,
            "ID": 1,
            "order": 1,
            "name": 1,
            "Name": 1,
            "parent_id": 1,
            "ParentID": 1,
        },
    ).to_list(length=1000)

    categories_by_id = {}
    categories_by_name = {}
    for category_doc in category_docs:
        category_identity = get_category_identity(category_doc)
        category_name = normalize_category_name(
            category_doc.get("name", category_doc.get("Name", ""))
        )
        if category_identity > 0 and category_identity not in categories_by_id:
            categories_by_id[category_identity] = category_doc
        if category_name:
            categories_by_name[category_name.casefold()] = category_doc

    category_lookup = {}
    for item_doc in item_docs:
        category_value = resolve_item_dashboard_category_name(
            item_doc,
            categories_by_id=categories_by_id,
            categories_by_name=categories_by_name,
        )

        lookup_code = str(item_doc.get("ItemLookupCode", "") or "").strip()
        item_id = str(item_doc.get("ItemID", "") or "").strip()
        if lookup_code:
            category_lookup[lookup_code] = category_value
        if item_id:
            category_lookup[item_id] = category_value

    category_totals = {}
    total_sales = 0.0

    for row in transaction_items:
        item_key = str(row.get("ItemID", "") or "").strip()
        quantity = float(row.get("Quantity", 0) or 0)
        price = float(row.get("Price", 0) or 0)
        line_total = quantity * price

        if line_total == 0:
            continue

        category_name = category_lookup.get(item_key) or "Uncategorized"
        category_totals[category_name] = float(category_totals.get(category_name, 0) or 0) + line_total
        total_sales += line_total

    ranked_categories = sorted(
        (
            (name, float(value or 0))
            for name, value in category_totals.items()
            if float(value or 0) > 0
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    return ERPDashboardCategorySalesOut(
        date_from=resolved_date_from,
        date_to=resolved_date_to,
        total_sales=float(total_sales or 0),
        categories=[
            ERPDashboardCategorySalesCategoryOut(category=name, sales=float(value or 0))
            for name, value in ranked_categories
        ],
    )


@app.get("/tender")
async def get_tender():
    """Fetch available tenders (Cash, M-Pesa, Card)."""
    tenders = await tender_collection.find({}, {"_id": 0}).to_list(100)
    return tenders

@app.post("/transaction")
async def post_transaction(data: TransactionData):
    """Save transaction, items, and print receipt."""
    deducted_items = []
    inserted_transaction_id = None
    inserted_item_ids = []

    async def rollback_transaction_side_effects():
        for code, quantity in deducted_items:
            await item_collection.update_one(
                {"ItemLookupCode": code},
                {
                    "$inc": {"quantity": quantity},
                    "$set": {"LastUpdated": datetime.utcnow()},
                }
            )

        if inserted_item_ids:
            await transaction_items_collection.delete_many({"_id": {"$in": inserted_item_ids}})

        if inserted_transaction_id is not None:
            await transaction_collection.delete_one({"_id": inserted_transaction_id})

    try:
        transaction_id = int(datetime.now().timestamp())  # Unique numeric ID
        required_quantities = {}

        for item in data.items:
            requested_quantity = int(item.quantity or 0)
            if requested_quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid quantity for {item.description or item.code}"
                )
            required_quantities[item.code] = required_quantities.get(item.code, 0) + requested_quantity

        for item_code, requested_quantity in required_quantities.items():
            update_result = await item_collection.update_one(
                {
                    "ItemLookupCode": item_code,
                    "quantity": {"$gte": requested_quantity},
                },
                {
                    "$inc": {"quantity": -requested_quantity},
                    "$set": {"LastUpdated": datetime.utcnow()},
                }
            )

            if update_result.modified_count == 0:
                current_item = await item_collection.find_one({"ItemLookupCode": item_code})
                description = current_item.get("Description", item_code) if current_item else item_code
                available_quantity = get_item_stock_quantity(current_item or {})
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient stock for {description}. "
                        f"Available: {available_quantity}, requested: {requested_quantity}"
                    )
                )

            deducted_items.append((item_code, requested_quantity))

        transaction_doc = {
            "TransactionID": transaction_id,
            "CashierID": data.cashier_id,
            "CustomerID": data.customer_id,
            "StoreID": data.store_id,
            "sdateTime": datetime.utcnow(),
            "Total": data.total,
            "SalesTax": data.tax,
            "Comment": data.comment,
            "Tenders": [t.dict() for t in data.tenders],
            "Status": 1
        }
        transaction_result = await transaction_collection.insert_one(transaction_doc)
        inserted_transaction_id = transaction_result.inserted_id

        items_list = []
        for index, item in enumerate(data.items):
            item_doc = {
                "TransactionID": transaction_id,
                "DetailedID": transaction_id * 100 + index,
                "ItemID": item.code,
                "Description": item.description,
                "Quantity": item.quantity,
                "Price": item.price,
                "Taxable": item.taxable,
                "SalesRepID": item.rep,
                "StoreID": data.store_id,
                "Cost": 0,
                "FullPrice": 0,
                "SalesTax": round(item.price * item.quantity * 0.08, 2) if item.taxable else 0,
                "Comment": "POS Sale",
                "DispatchTime": datetime.utcnow(),
                "Dispatched": False
            }
            item_result = await transaction_items_collection.insert_one(item_doc)
            inserted_item_ids.append(item_result.inserted_id)
            items_list.append(item_doc)

        # Try printing receipt
        try:
            printed = await print_receipt(transaction_doc, items_list, transaction_doc["Tenders"])
            if printed:
                logging.info(f"Receipt printed for transaction {transaction_id}")
            else:
                logging.warning(f"Receipt print returned False for transaction {transaction_id}")
        except Exception as e:
            logging.error(f"Printer error for transaction {transaction_id}: {e}")

        logging.info(f"Transaction {transaction_id} saved successfully.")
        return {
            "message": "Transaction saved successfully",
            "transaction_id": transaction_id
        }

    except HTTPException:
        await rollback_transaction_side_effects()
        raise
    except Exception as e:
        await rollback_transaction_side_effects()
        logging.error(f"Transaction save error: {e}")
        raise HTTPException(status_code=500, detail="Transaction processing failed")

@app.post("/print-test")
async def print_test_receipt():
    """Test endpoint for printing a sample receipt"""
    try:
        # Sample transaction data for testing
        transaction_doc = {
            "TransactionID": 1001,
            "CashierID": 1002,
            "StoreID": 1,
            "Total": 25.50,
            "SalesTax": 2.04,
            "Comment": "Test transaction"
        }
        
        items_list = [
            {
                "Description": "Test Product With Long Name",
                "Quantity": 2,
                "Price": 10.00
            },
            {
                "Description": "Another Test Product",
                "Quantity": 1,
                "Price": 5.50
            }
        ]
        
        tenders = [
            {
                "code": "Cash",
                "amount": 25.50
            }
        ]
        
        # Try printing receipt
        result = await print_receipt(transaction_doc, items_list, tenders)
        
        if result:
            return {"message": "Test receipt printed successfully"}
        else:
            return {"message": "Failed to print test receipt"}
            
    except Exception as e:
        logging.error(f"Test print error: {e}")
        raise HTTPException(status_code=500, detail="Test print failed")



@app.get("/loyalty/customer/{identifier}")
async def get_loyalty_customer(identifier: str):
    """Get loyalty customer by ID number, card number, or mobile number"""
    try:
        customer = None

        # Try to find by ID number
        customer = await loyalty_customers_collection.find_one({"Idnumber": identifier})

        if not customer:
            # Try to find by card number
            customer = await loyalty_customers_collection.find_one({"Loyaltyno": identifier})

        if not customer:
            # Try to find by mobile number with flexible matching
            if identifier.startswith("07") and len(identifier) == 10:
                # Convert 07 format to 2547 format
                international_format = "254" + identifier[1:]
                customer = await loyalty_customers_collection.find_one({"Mobile": international_format})
            elif identifier.startswith("2547") and len(identifier) == 12:
                # Convert 2547 format to 07 format
                local_format = "0" + identifier[3:]
                customer = await loyalty_customers_collection.find_one({"Mobile": local_format})
            else:
                # Try direct match
                customer = await loyalty_customers_collection.find_one({"Mobile": identifier})

        if customer:
            # Convert to dict if needed and safely remove _id
            customer = dict(customer)
            customer.pop("_id", None)
            return {"success": True, "customer": customer}

        return {"success": False, "message": "Customer not found"}

    except Exception as e:
        logging.error(f"Error fetching loyalty customer: {e}")
        return {"success": False, "message": "Error fetching customer"}

 

@app.get("/loyalty/customer/mobile/{mobile}")
async def get_loyalty_customer_by_mobile(mobile: str):
    """Get loyalty customer specifically by mobile number with various format handling"""
    try:
        # Handle different mobile number formats
        search_numbers = [mobile]
        
        # If it's a Kenyan number, try different formats
        if mobile.startswith("2547") and len(mobile) == 12:
            # Convert to 07 format
            local_format = "0" + mobile[3:]
            search_numbers.append(local_format)
        elif mobile.startswith("07") and len(mobile) == 10:
            # Convert to 2547 format
            international_format = "254" + mobile[1:]
            search_numbers.append(international_format)
        
        # Try to find by any of the mobile number formats
        customer = None
        for number in search_numbers:
            customer = await loyalty_customers_collection.find_one({"Mobile": number})
            if customer:
                break
        
        if customer:
            # Remove _id from response
            customer.pop("_id", None)
            return {"success": True, "customer": customer}
        else:
            return {"success": False, "message": "Customer not found"}
    except Exception as e:
        logging.error(f"Error fetching loyalty customer by mobile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer")

@app.get("/loyalty/customers/all")
async def get_all_loyalty_customers():
    """Get all loyalty customers (for debugging purposes)"""
    try:
        # Find all customers
        cursor = loyalty_customers_collection.find({})
        customers = await cursor.to_list(length=100)
        
        # Remove _id from each customer
        for customer in customers:
            customer.pop("_id", None)
        
        return {"success": True, "customers": customers}
    except Exception as e:
        logging.error(f"Error fetching all loyalty customers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customers")
    
    
    # ==================== M-PESA STK PUSH ====================


async def get_next_loyalty_customer_id():
    cursor = loyalty_customers_collection.find({}, {"id": 1, "ID": 1, "MemberID": 1})
    customers = await cursor.to_list(length=None)
    max_id = 0

    for customer in customers:
        raw_id = customer.get("id") or customer.get("ID") or customer.get("MemberID")
        try:
            numeric_id = int(str(raw_id).strip())
        except (TypeError, ValueError):
            continue
        max_id = max(max_id, numeric_id)

    return str(max_id + 1)


def build_loyalty_lookup_clauses(customer: LoyaltyCustomer):
    lookup_clauses = []
    if customer.id:
        lookup_clauses.append({"id": customer.id})
    if customer.Idnumber:
        lookup_clauses.append({"Idnumber": customer.Idnumber})
    if customer.Loyaltyno:
        lookup_clauses.append({"Loyaltyno": customer.Loyaltyno})
    if customer.Mobile:
        lookup_clauses.append({"Mobile": customer.Mobile})
    return lookup_clauses

from fastapi import Request
import requests, base64
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # Loads .env file from your backend folder

@app.post("/api/mpesa/stkpush")
async def stkpush(request: Request):
    data = await request.json()
    phone = data.get("phone")
    amount = data.get("amount")
    name = data.get("customer_name", "Customer")

    consumer_key = os.getenv("MPESA_CONSUMER_KEY")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
    shortcode = os.getenv("MPESA_BUSINESS_SHORTCODE")
    passkey = os.getenv("MPESA_PASSKEY")
    mode = os.getenv("MPESA_MODE", "sandbox")

    # Get token
    url = (
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        if mode == "live"
        else "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    )
    r = requests.get(url, auth=(consumer_key, consumer_secret))
    token_data = r.json()
    print("🔑 Token response:", token_data)
    access_token = token_data.get("access_token")

    if not access_token:
        return {"success": False, "message": "Failed to get access token", "details": token_data}

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode("utf-8")

    stk_url = (
        "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
        if mode == "live"
        else "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    )

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerBuyGoodsOnline",
        "Amount": amount,
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": "https://example.com/mpesa/callback",
        "AccountReference": name,
        "TransactionDesc": "POS Payment",
    }

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    response = requests.post(stk_url, json=payload, headers=headers)
    result = response.json()

    print("📲 Safaricom STK Response:", result)

    return {"success": True, "message": "STK push sent", "result": result}


@app.post("/loyalty/customer")
async def create_loyalty_customer(customer: LoyaltyCustomer):
    """Create or update a loyalty customer"""
    try:
        lookup_clauses = build_loyalty_lookup_clauses(customer)
        if not lookup_clauses:
            raise HTTPException(
                status_code=400,
                detail="Enter at least one customer identifier"
            )

        # Check if customer already exists
        existing_customer = await loyalty_customers_collection.find_one({"$or": lookup_clauses})
        
        customer_dict = customer.dict()
        
        if existing_customer:
            # Update existing customer
            result = await loyalty_customers_collection.update_one(
                {"_id": existing_customer["_id"]},
                {"$set": customer_dict}
            )
            return {"success": True, "message": "Customer updated successfully"}
        else:
            # Create new customer
            result = await loyalty_customers_collection.insert_one(customer_dict)
            return {"success": True, "message": "Customer created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating/updating loyalty customer: {e}")
        raise HTTPException(status_code=500, detail="Failed to create/update customer")


@app.post("/loyalty/customers/add")
async def add_loyalty_customer(customer: LoyaltyCustomer):
    """Insert a new loyalty customer without overwriting existing records"""
    try:
        lookup_clauses = build_loyalty_lookup_clauses(customer)
        if not lookup_clauses:
            raise HTTPException(
                status_code=400,
                detail="Enter a mobile number, ID number, loyalty number, or customer ID"
            )

        existing_customer = await loyalty_customers_collection.find_one({"$or": lookup_clauses})
        if existing_customer:
            raise HTTPException(
                status_code=409,
                detail="A loyalty customer with those details already exists"
            )

        customer_dict = customer.dict()
        if not customer_dict.get("id"):
            customer_dict["id"] = await get_next_loyalty_customer_id()

        await loyalty_customers_collection.insert_one(customer_dict)
        customer_dict.pop("_id", None)
        return {
            "success": True,
            "message": "Customer created successfully",
            "customer": customer_dict,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding loyalty customer: {e}")
        raise HTTPException(status_code=500, detail="Failed to add customer")

@app.post("/loyalty/award-points")
async def award_loyalty_points(loyalty_transaction: LoyaltyTransaction):
    """Award loyalty points to a customer"""
    try:
        # Find the customer by card number
        customer = await loyalty_customers_collection.find_one({
            "Loyaltyno": loyalty_transaction.Cardno
        })
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Calculate new points
        new_points = customer.get("Points", 0) + loyalty_transaction.Points
        new_total_credit = customer.get("TotalCredit", 0) + loyalty_transaction.TransactionAmt
        new_balance = customer.get("Balance", 0) + loyalty_transaction.TransactionAmt
        new_bal2 = customer.get("Bal2", 0) + loyalty_transaction.TransactionAmt
        
        await loyalty_customers_collection.update_one(
            {"_id": customer["_id"]},
            {
                "$set": {
                    "Points": new_points,
                    "TotalCredit": new_total_credit,
                    "Balance": new_balance,
                    "Bal2": new_bal2,
                    "Lastupdated": datetime.utcnow()
                }
            }
        )
        
        # Create loyalty transaction record
        loyalty_transaction_data = loyalty_transaction.dict()
        loyalty_transaction_data["Lastupdated"] = datetime.utcnow()
        
        await loyalty_transactions_collection.insert_one(loyalty_transaction_data)
        
        return {
            "success": True,
            "points_earned": loyalty_transaction.Points,
            "total_points": new_points,
            "message": f"Successfully awarded {loyalty_transaction.Points} points"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error awarding loyalty points: {e}")
        raise HTTPException(status_code=500, detail="Failed to award points")

def format_currency(v: float) -> str:
    return f"{v:,.2f}"

async def get_tender_description(code):
    """Get full tender description from code"""
    try:
        tender = await tender_collection.find_one({"Code": code.upper()})
        if tender:
            return tender.get("Description", code)
        return code
    except Exception as e:
        print(f"Error fetching tender description: {e}")
        return code

async def print_receipt(transaction_doc, items_list, tenders, loyalty_info=None):
    """
    Print receipt using POS printer - works with any thermal printer
    """
    try:
        # Load configuration from environment variables
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        printer_type = os.getenv("PRINTER_TYPE", "windows")
        printer_name = os.getenv("PRINTER_NAME", "POS-80C (copy 1)")
        
        # Extract transaction information
        transaction_id = transaction_doc.get("TransactionID", 0)
        store_id = transaction_doc.get("StoreID", 1)
        cashier_id = transaction_doc.get("CashierID", 1002)
        total = transaction_doc.get("Total", 0)
        tax = transaction_doc.get("SalesTax", 0)
        
        # Convert tender codes to full descriptions
        full_description_tenders = []
        for tender in tenders:
            full_description = await get_tender_description(tender.get("code") or tender.get("Code"))
            full_description_tenders.append({
                "code": full_description,
                "amount": tender.get("amount", tender.get("Amount", 0.0))
            })
        
        # --- Formatting helpers ---
        def format_receipt_windows(transaction_doc, items_list):
            """Format receipt for Windows driver printers (48 chars for 80mm printer)"""
            line_width = 48

            formatted_items = []
            for item in items_list:
                formatted_items.append({
                    "name": item.get("Description", "")[:30],  # 30 chars for item
                    "qty": item.get("Quantity", 1),
                    "price": item.get("Price", 0.0)
                })

            store_name = "EASTLEIGH MATTRESSES LIMITED"
            total = transaction_doc.get("Total", 0)
            tax = transaction_doc.get("SalesTax", 0)

            receipt_lines = []
            receipt_lines.append(store_name.center(line_width))
            receipt_lines.append("=" * line_width)
            
            # Add transaction details
            receipt_lines.append(f"Transaction: {transaction_id}")
            receipt_lines.append(f"Store: {store_id} | Cashier: {cashier_id}")
            receipt_lines.append("-" * line_width)
            
            # Header row
            receipt_lines.append(f"{'Item':30}{'Qty':>6}{'Price':>12}")
            receipt_lines.append("-" * line_width)

            # Item lines
            for item in formatted_items:
                name = item.get('name', '')[:30].ljust(30)
                qty = str(item.get('qty', 1)).rjust(6)
                price = f"{item.get('price', 0):.2f}".rjust(12)
                receipt_lines.append(f"{name}{qty}{price}")

            receipt_lines.append("-" * line_width)
            receipt_lines.append(f"{'Tax:':>36}{tax:>12.2f}")
            receipt_lines.append(f"{'TOTAL:':>36}{total:>12.2f}")
            receipt_lines.append("=" * line_width)
            
            # Add tender information
            if full_description_tenders:
                receipt_lines.append("PAYMENT METHOD:")
                for tender in full_description_tenders:
                    receipt_lines.append(f"{tender['code']:30}{format_currency(tender['amount']):>18}")
                receipt_lines.append("=" * line_width)
            
            # Add loyalty information if available
            if loyalty_info:
                receipt_lines.append(f"Loyalty Points Earned: {loyalty_info.get('points_earned', 0)}")
                receipt_lines.append(f"Loyalty Points Balance: {loyalty_info.get('points_balance', 0)}")
                if loyalty_info.get('customer_name'):
                    receipt_lines.append(f"Customer: {loyalty_info.get('customer_name')}")
            else:
                receipt_lines.append("LOYALTY PROGRAM:")
                receipt_lines.append("You earn 1 point for every KES 100 spent")
            
            receipt_lines.append("")
            receipt_lines.append("Thank you for shopping with us!")
            receipt_lines.append("Items sold are not returnable")
            receipt_lines.append("Please check items & totals")
            receipt_lines.append("before leaving the store.")
            receipt_lines.append("")
            return "\n".join(receipt_lines)

        def format_receipt_escpos(transaction_doc, items_list):
            """Format receipt for ESC/POS raw printing (48 chars for 80mm printer)"""
            line_width = 48

            formatted_items = []
            for item in items_list:
                formatted_items.append({
                    "name": item.get("Description", "")[:30],  # 30 chars for item
                    "qty": item.get("Quantity", 1),
                    "price": item.get("Price", 0.0)
                })

            store_name = "EASTLEIGH MATTRESSES LIMITED"
            total = transaction_doc.get("Total", 0)
            tax = transaction_doc.get("SalesTax", 0)

            receipt_lines = []
            receipt_lines.append(store_name.center(line_width))
            receipt_lines.append("=" * line_width)
            
            # Add transaction details
            receipt_lines.append(f"Transaction: {transaction_id}")
            receipt_lines.append(f"Store: {store_id} | Cashier: {cashier_id}")
            receipt_lines.append("-" * line_width)
            
            # Header row
            receipt_lines.append(f"{'Item':30}{'Qty':>6}{'Price':>12}")
            receipt_lines.append("-" * line_width)

            # Item lines
            for item in formatted_items:
                name = item.get('name', '')[:30].ljust(30)
                qty = str(item.get('qty', 1)).rjust(6)
                price = f"{item.get('price', 0):.2f}".rjust(12)
                receipt_lines.append(f"{name}{qty}{price}")

            receipt_lines.append("-" * line_width)
            receipt_lines.append(f"{'Tax:':>36}{tax:>12.2f}")
            receipt_lines.append(f"{'TOTAL:':>36}{total:>12.2f}")
            receipt_lines.append("=" * line_width)
            
            # Add tender information
            if full_description_tenders:
                receipt_lines.append("PAYMENT METHOD:")
                for tender in full_description_tenders:
                    receipt_lines.append(f"{tender['code']:30}{format_currency(tender['amount']):>18}")
                receipt_lines.append("=" * line_width)
            
            # Add loyalty information if available
            if loyalty_info:
                receipt_lines.append(f"Loyalty Points Earned: {loyalty_info.get('points_earned', 0)}")
                receipt_lines.append(f"Loyalty Points Balance: {loyalty_info.get('points_balance', 0)}")
                if loyalty_info.get('customer_name'):
                    receipt_lines.append(f"Customer: {loyalty_info.get('customer_name')}")
            else:
                receipt_lines.append("LOYALTY PROGRAM:")
                receipt_lines.append("You earn 1 point for every KES 100 spent")
            
            receipt_lines.append("")
            receipt_lines.append("Thank you for shopping with us!")
            receipt_lines.append("Items sold are not returnable")
            receipt_lines.append("Please check items & totals")
            receipt_lines.append("before leaving the store.")
            receipt_lines.append("")
            return "\n".join(receipt_lines)
        
        if printer_type == "windows" or printer_type == "auto":
            try:
                formatted_items = []
                for item in items_list:
                    formatted_items.append({
                        "name": item.get("Description", "")[:30],
                        "qty": item.get("Quantity", 1),
                        "price": item.get("Price", 0.0)
                    })

                raw_printer = POSPrinter(printer_name)
                if raw_printer.print_full_width_receipt(
                    "EASTLEIGH MATTRESSES LIMITED",
                    formatted_items,
                    total,
                    tax,
                    transaction_id=transaction_id,
                    register_id=store_id,
                    cashier_id=cashier_id,
                    tenders=full_description_tenders,
                    loyalty_info=loyalty_info,
                    footer_msg="Thank you for shopping with us!",
                    printer_name=printer_name,
                ):
                    print("Receipt printed successfully via Windows RAW full width")
                    return True
                else:
                    print("Windows RAW full width print failed")
                    return False
            except Exception as e:
                print(f"Windows full width printing error: {e}")
                return False

        # --- Windows printing ---
        if printer_type == "windows" or printer_type == "auto":
            try:
                import subprocess
                import tempfile
                
                # ✅ Use Windows-friendly format (48 chars for 80mm printer)
                receipt_content = format_receipt_windows(transaction_doc, items_list)
                
                # Write to a temporary file
                with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                    f.write(receipt_content)
                    temp_filename = f.name
                
                # PowerShell print command
                ps_command = f'Get-Content "{temp_filename}" | Out-Printer "{printer_name}"'
                result = subprocess.run(['powershell', '-Command', ps_command],
                                       capture_output=True, text=True)
                
                os.unlink(temp_filename)
                
                if result.returncode == 0:
                    print("Receipt printed successfully via Windows printer")
                    return True
                else:
                    print(f"Failed to print via Windows command: {result.stderr}")
            except Exception as e:
                print(f"Windows raw printing error: {e}")
        
        # --- ESC/POS printing ---
        try:
            printer = POSPrinter()
            
            if printer.connect_windows(printer_name):
                print(f"Connected to Windows printer: {printer_name}")
                
                # Format items for the ESC/POS printer method
                formatted_items = []
                for item in items_list:
                    formatted_items.append({
                        "name": item.get("Description", "")[:30],  # 30 chars for item
                        "qty": item.get("Quantity", 1),
                        "price": item.get("Price", 0.0)
                    })
                
                store_name = "EASTLEIGH MATTRESSES LIMITED"
                total = transaction_doc.get("Total", 0)
                tax = transaction_doc.get("SalesTax", 0)
                
                # Use the print_receipt method from POSPrinter class
                if printer.print_receipt(store_name, formatted_items, total, tax):
                    print("Receipt printed successfully via ESC/POS")
                    return True
                else:
                    print("Failed to print receipt via ESC/POS")
                    return False
            else:
                print(f"Failed to connect to Windows printer: {printer_name}")
        except Exception as e:
            print(f"ESC/POS printing error: {e}")
        
        print("No printer connected - printing to console for testing")
        return False

            
    except Exception as e:
        print(f"Error printing receipt: {e}")
        return False
