# test_mpesa_auth.py
import os
import base64
import requests
from dotenv import load_dotenv

def test_mpesa_auth():
    """Test M-Pesa authentication"""
    
    # Load environment variables
    load_dotenv()
    
    # M-Pesa Daraja API credentials
    consumer_key = os.getenv("MPESA_CONSUMER_KEY")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
    
    print("M-Pesa Authentication Test")
    print("=" * 30)
    print(f"Consumer Key: {consumer_key}")
    print(f"Consumer Secret: {consumer_secret}")
    
    # Determine if we're in live mode
    mpesa_mode = os.getenv("MPESA_MODE", "sandbox")
    
    # Set URLs based on mode
    if mpesa_mode == "live":
        auth_url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    else:
        auth_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    
    print(f"Mode: {mpesa_mode}")
    print(f"Auth URL: {auth_url}")
    
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
            return True
        else:
            print(f"Authentication failed: {auth_response.text}")
            return False
    except Exception as e:
        print(f"Error during authentication: {str(e)}")
        return False

if __name__ == "__main__":
    test_mpesa_auth()