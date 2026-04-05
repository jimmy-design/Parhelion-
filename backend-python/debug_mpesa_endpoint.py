# debug_mpesa_endpoint.py
import requests
import json

def test_mpesa_endpoint():
    """Test the actual M-Pesa endpoint with debugging"""
    
    # Test data
    test_data = {
        "phone": "0712345678",
        "amount": 100
    }
    
    # Make the request to the STK Push endpoint
    try:
        response = requests.post(
            "http://localhost:8000/api/mpesa/stkpush",
            headers={"Content-Type": "application/json"},
            data=json.dumps(test_data)
        )
        
        print("M-Pesa Endpoint Test Results:")
        print("=" * 40)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("\nSuccess Details:")
            print(f"  Success: {result.get('success')}")
            print(f"  Message: {result.get('message')}")
        else:
            print("Error occurred during STK Push")
            
    except Exception as e:
        print(f"Error making request: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_mpesa_endpoint()