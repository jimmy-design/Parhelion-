# debug_mpesa.py
import requests
import base64
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

def debug_mpesa_stk_push():
    """Debug M-Pesa STK Push to identify the issue"""
    print("Debugging M-Pesa STK Push...")
    
    # M-Pesa Daraja API credentials
    consumer_key = os.getenv("MPESA_CONSUMER_KEY")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
    shortcode = os.getenv("MPESA_SHORTCODE")
    passkey = os.getenv("MPESA_PASSKEY")
    callback_url = os.getenv("MPESA_CALLBACK_URL", "https://eastmatt.com/payment/mpesa/callback")
    mpesa_mode = os.getenv("MPESA_MODE", "sandbox")
    
    print(f"Consumer Key: {consumer_key}")
    print(f"Consumer Secret: {consumer_secret}")
    print(f"Shortcode: {shortcode}")
    print(f"Passkey: {passkey[:10]}...{passkey[-10:] if passkey else 'N/A'}")
    print(f"Callback URL: {callback_url}")
    print(f"Mode: {mpesa_mode}")
    
    # Validate that required credentials are present
    if not all([consumer_key, consumer_secret, shortcode, passkey]):
        print("ERROR: M-Pesa credentials not configured properly")
        return
    
    # Test phone number (use a valid test number)
    phone = "254700000000"  # Test number
    amount = 100
    
    # Format phone number (ensure it starts with 254)
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    elif not phone.startswith("254"):
        phone = "254" + phone
    
    print(f"Phone number: {phone}")
    print(f"Amount: {amount}")
    
    # Set URLs based on mode
    if mpesa_mode == "live":
        auth_url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        stk_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
        print("Using LIVE environment")
    else:
        auth_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        stk_url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
        print("Using SANDBOX environment")
    
    # Get access token
    print("\n1. Getting access token...")
    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    auth_headers = {"Authorization": f"Basic {credentials}"}
    
    try:
        auth_response = requests.get(auth_url, headers=auth_headers)
        print(f"   Status Code: {auth_response.status_code}")
        
        if auth_response.status_code != 200:
            print(f"   ERROR: Failed to authenticate with M-Pesa: {auth_response.text}")
            return
        
        access_token = auth_response.json()["access_token"]
        print(f"   Access Token: {access_token[:20]}...")
        
    except Exception as e:
        print(f"   ERROR: Exception during authentication: {e}")
        return
    
    # Prepare STK Push request
    print("\n2. Preparing STK Push request...")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
    
    stk_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    stk_payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": "POS_SALE",
        "TransactionDesc": "Payment for goods"
    }
    
    print(f"   STK URL: {stk_url}")
    print(f"   Callback URL: {callback_url}")
    print(f"   Payload: {stk_payload}")
    
    # Send STK Push request
    print("\n3. Sending STK Push request...")
    try:
        stk_response = requests.post(stk_url, json=stk_payload, headers=stk_headers)
        print(f"   Status Code: {stk_response.status_code}")
        print(f"   Response: {stk_response.text}")
        
        if stk_response.status_code == 200:
            response_data = stk_response.json()
            print(f"   Response Data: {response_data}")
            
            if response_data.get("ResponseCode") == "0":
                print("   SUCCESS: STK Push sent successfully")
                print(f"   Checkout Request ID: {response_data.get('CheckoutRequestID')}")
                print(f"   Merchant Request ID: {response_data.get('MerchantRequestID')}")
            else:
                print(f"   ERROR: M-Pesa request failed: {response_data.get('ResponseDescription', 'Unknown error')}")
        else:
            print(f"   ERROR: HTTP error {stk_response.status_code}: {stk_response.text}")
            
    except Exception as e:
        print(f"   ERROR: Exception during STK Push: {e}")

if __name__ == "__main__":
    debug_mpesa_stk_push()