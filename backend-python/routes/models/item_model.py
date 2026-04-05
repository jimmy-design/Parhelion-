from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Item(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    ItemLookupCode: str
    BinLocation: Optional[str] = None
    BuydownPrice: float = 0.00
    BuydownQuantity: float = 0.00
    CommissionAmount: float = 0.00
    CommissionMaximum: float = 0.00
    CommissionMode: int = 0
    CommissionPercentProfit: float = 0.000
    CommissionPercentSale: float = 0.000
    Description: Optional[str] = None
    FoodStampable: bool = False
    ItemNotDiscountable: bool = False
    LastRecieved: Optional[datetime] = None
    LastUpdated: Optional[datetime] = None
    Notes: Optional[str] = None
    QuantityCommitted: float = 0.00
    SerialNumberCount: int = 0
    TareWeightPercent: float = 0.000
    DepartmentID: int = 0
    CategoryID: int = 0
    MessageID: int = 0
    Price: float = 0.0000
    PriceA: float = 0.0000
    PriceB: float = 0.0000
    PriceC: float = 0.0000
    SalePrice: float = 0.0000
    SaleStartDate: Optional[datetime] = None
    SaleEndDate: Optional[datetime] = None
    QuantityDiscountID: int = 0
    TaxID: int = 0
    ItemType: int = 0
    Cost: float = 0.0000
    quantity: float = 0.0000
    AVGQty: float = 0.0000
    Sales1: float = 0.0000
    Sales2: float = 0.0000
    ReorderPoint: float = 0.00
    RestockLevel: float = 0.00
    TareWeight: float = 0.00
    SupplierID: int = 0
    TagAlongItem: int = 0
    TagAlongQuantity: float = 0.00
    ParentItem: int = 0
    ParentQuantity: float = 0.00
    BarCodeFormat: int = 0
    PriceLowerBound: float = 0.00
    PriceUpperBound: float = 0.00
    PictureName: Optional[str] = None
    LastSold: Optional[datetime] = None
    ExtendedDescription: Optional[str] = None
    SubDescription1: Optional[str] = None
    SubDescription2: Optional[str] = None
    SubDescription3: Optional[str] = None
    UnitOfMeasure: Optional[str] = None
    SubCategoryID: int = 0
    QuantityEntryNotAllowed: bool = False
    PriceMustBeEntered: bool = False
    BlockSalesReason: Optional[str] = None
    BlockSalesAfterDate: Optional[datetime] = None
    Weight: float = 0.000
    Taxable: bool = False
    BlockSalesBeforeDate: Optional[datetime] = None
    LastCost: float = 0.00
    ReplacementCost: float = 0.00
    WebItem: bool = False
    BlockSalesType: int = 0
    BlockSalesScheduleID: int = 0
    SaleType: int = 0
    SaleScheduleID: int = 0
    Consignment: bool = False
    Inactive: bool = False
    LastCounted: Optional[datetime] = None
    DoNotOrder: bool = False
    MSRP: Optional[float] = None
    DateCreated: Optional[datetime] = None
    Content: Optional[str] = None
    UsuallyShip: Optional[str] = None
    Warranty: bool = False
    WarrantyPeriod: int = 0
    FinishedProductID: Optional[int] = None
    Packs: float = 1.0000
    PacksUnitofMeasure: str = "PCs"
    PackagingTotalQty: float = 1.0000
    LastSync: Optional[datetime] = None
    RepackedItem: int = 0
    GLAccountID: int = 0
    StoreID: int = 0

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
