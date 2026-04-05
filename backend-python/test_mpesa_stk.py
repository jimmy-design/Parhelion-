# test_mpesa_stk.py
import os
import base64
import requests
from datetime import datetime
from dotenv import load_dotenv

def test_mpesa_stk():
    """Test M-Pesa STK Push"""
    
    # Load environment variables
    load_dotenv()
    
    # M-Pesa Daraja API credentials
    consumer_key = os.getenv("MPESA_CONSUMER_KEY")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
    shortcode = os.getenv("MPESA_SHORTCODE")
    passkey = os.getenv("MPESA_PASSKEY")
    
    print("M-Pesa STK Push Test")
    print("=" * 30)
    print(f"Consumer Key: {consumer_key}")
    print(f"Consumer Secret: {consumer_secret}")
    print(f"Shortcode: {shortcode}")
    print(f"Passkey: {passkey[:20]}...")
    
    # Determine if we're in live mode
    mpesa_mode = os.getenv("MPESA_MODE", "sandbox")
    
    # Set URLs based on mode
    if mpesa_mode == "live":
        auth_url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        stk_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    else:
        auth_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        stk_url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    
    print(f"Mode: {mpesa_mode}")
    print(f"Auth URL: {auth_url}")
    print(f"STK URL: {stk_url}")
    
    # Get access token
    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    auth_headers = {"Authorization": f"Basic {credentials}"}
    
    try:
        auth_response = requests.get(auth_url, headers=auth_headers)
        print(f"Auth Response Status: {auth_response.status_code}")
        
        if auth_response.status_code == 200:
            access_token = auth_response.json()["access_token"]
            print("Authentication successful!")
            print(f"Access Token: {access_token[:50]}...")
        else:
            print(f"Authentication failed: {auth_response.text}")
            return False
    except Exception as e:
        print(f"Error during authentication: {str(e)}")
        return False
    
    # Prepare STK Push request
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
    
    # Test data
    phone = "254712345678"  # Test phone number
    amount = 100  # Test amount
    
    print(f"\nSTK Push Request:")
    print(f"  Phone: {phone}")
    print(f"  Amount: {amount}")
    print(f"  Timestamp: {timestamp}")
    print(f"  Password: {password[:50]}...")
    
    stk_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    stk_payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerBuyGoodsOnline",
        "Amount": amount,
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": "https://dummyurl.com",  # Required, but can be dummy
        "AccountReference": "POS_SALE",
        "TransactionDesc": "Payment"
    }
    
    print(f"\nSending STK Push request...")
    
    try:
        stk_response = requests.post(stk_url, json=stk_payload, headers=stk_headers)
        print(f"STK Response Status: {stk_response.status_code}")
        print(f"STK Response: {stk_response.text}")
        
        if stk_response.status_code == 200:
            response_data = stk_response.json()
            print(f"Response Code: {response_data.get('ResponseCode')}")
            print(f"Response Description: {response_data.get('ResponseDescription')}")
            print(f"Checkout Request ID: {response_data.get('CheckoutRequestID')}")
            print(f"Merchant Request ID: {response_data.get('MerchantRequestID')}")
            
            if response_data.get("ResponseCode") == "0":
                print("\nSTK Push sent successfully!")
                return True
            else:
                print(f"\nSTK Push failed: {response_data.get('ResponseDescription')}")
                return False
        else:
            print(f"STK Push failed with status {stk_response.status_code}")
            return False
    except Exception as e:
        print(f"Error during STK Push: {str(e)}")
        return False

if __name__ == "__main__":
    test_mpesa_stk()