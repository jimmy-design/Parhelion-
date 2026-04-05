# backend-python/routes/item_routes.py

from fastapi import APIRouter, HTTPException
from pymongo import MongoClient
from bson import ObjectId
from backend_python.database.models.item_model import Item

router = APIRouter()

client = MongoClient("mongodb://localhost:27017")
db = client["admin"]
collection = db["item"]

@router.get("/api/item/{code}", response_model=Item)
def get_item_by_code(code: str):
    item = collection.find_one({"ItemLookupCode": code})
    if item:
        item["_id"] = str(item["_id"])
        return item
    raise HTTPException(status_code=404, detail="Item not found")
