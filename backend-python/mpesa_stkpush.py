from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os, requests, base64
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" if mode == "live" else "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    r = requests.get(url, auth=(consumer_key, consumer_secret))
    access_token = r.json().get("access_token")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode("utf-8")

    stk_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest" if mode == "live" else "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": "https://example.com/mpesa/callback",
        "AccountReference": name,
        "TransactionDesc": "POS Payment"
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    response = requests.post(stk_url, json=payload, headers=headers)
    result = response.json()
    return result
