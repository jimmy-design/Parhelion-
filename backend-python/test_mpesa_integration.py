# test_mpesa_integration.py
import requests
import json

def test_mpesa_integration():
    """Test M-Pesa STK Push integration"""
    
    # Test data
    test_data = {
        "phone": "0712345678",
        "amount": 100,
        "customer_name": "Test Customer"
    }
    
    # Make the request to the STK Push endpoint
    try:
        response = requests.post(
            "http://localhost:8000/api/mpesa/stkpush",
            headers={"Content-Type": "application/json"},
            data=json.dumps(test_data)
        )
        
        print("M-Pesa STK Push Test Results:")
        print("=" * 40)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("\nSuccess Details:")
            print(f"  Success: {result.get('success')}")
            print(f"  Message: {result.get('message')}")
            print(f"  Checkout Request ID: {result.get('checkout_request_id')}")
            print(f"  Merchant Request ID: {result.get('merchant_request_id')}")
        else:
            print("Error occurred during STK Push")
            
    except Exception as e:
        print(f"Error making request: {str(e)}")

if __name__ == "__main__":
    test_mpesa_integration()