# test_mpesa.py
import requests
import json

def test_mpesa_stk_push():
    """Test the M-Pesa STK Push endpoint"""
    url = "http://localhost:8000/api/mpesa/stkpush"
    
    # Test data
    payload = {
        "phone": "254712345678",  # Replace with a valid test phone number
        "amount": 100.0,
        "customer_name": "Test Customer",
        "account_reference": "TEST001",
        "transaction_desc": "Test payment"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✅ STK Push request successful!")
            return True
        else:
            print("❌ STK Push request failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Testing M-Pesa STK Push integration...")
    print("=" * 50)
    test_mpesa_stk_push()