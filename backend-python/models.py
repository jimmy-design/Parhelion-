# models.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Item(BaseModel):
    code: str
    description: str
    quantity: int
    price: float
    taxable: bool
    rep: str

class Tender(BaseModel):
    code: str
    amount: float

class TransactionData(BaseModel):
    items: List[Item]
    tenders: List[Tender]
    total: float
    tax: float
    cashier_id: int = 1002
    store_id: int = 1
    customer_id: int = 1001
    comment: str = "Transaction completed"

class LoyaltyCustomer(BaseModel):
    MemberID: Optional[str] = None
    Fullname: Optional[str] = ""
    Idnumber: Optional[str] = ""
    Loyaltyno: Optional[str] = ""
    Mobile: Optional[str] = ""
    TotalCredit: float = 0.0
    TotalDebit: float = 0.0
    Balance: float = 0.0
    Points: int = 0
    # Additional fields from your schema
    Profession: Optional[str] = ""
    STID: Optional[str] = ""
    CTID: Optional[str] = ""
    Passportnumber: Optional[str] = ""
    Nationality: Optional[str] = "Kenyan"
    Dlnumber: Optional[str] = ""
    Maritalstatus: Optional[int] = 1
    Gender: Optional[int] = 1
    Physicaladdress: Optional[str] = ""
    Postaladdress: Optional[str] = ""
    Town: Optional[str] = ""
    TelNo: Optional[str] = ""
    EmailAdd: Optional[str] = ""
    Enabled: Optional[int] = 1
    DateofBirth: Optional[datetime] = None
    SinceDate: Optional[datetime] = None
    Category: Optional[int] = 1
    uuser: Optional[str] = "admin"
    IdentityID: Optional[str] = ""
    Blocked: Optional[int] = 0
    AcceptTerms: Optional[int] = 1
    Bal2: float = 0.0

class LoyaltyTransaction(BaseModel):
    Cardno: str
    Register: str = "R001"
    TransactionNo: str
    Description: str = "Purchase"
    TransactionAmt: float
    Pointsb4trn: int
    Points: int
    sdatetime: datetime
    STID: str = "ST123"
    tkind: int = 1
    uuser: str = "admin"
    RedeemID: int = 0
    Lastupdated: datetime
    identityid: str
    Uploaded: int = 0
    web: int = 0

class MpesaSTKRequest(BaseModel):
    phone: str
    amount: float
    customer_name: str = ""
    account_reference: str = "POS_SALE"
    transaction_desc: str = "Payment for goods"
