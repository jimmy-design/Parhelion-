# simulate_callback.py
import requests
import json

def simulate_callback():
    """Simulate an M-Pesa callback to test the endpoint"""
    
    # Sample callback data (success)
    callback_data = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "12345-67890-12345",
                "CheckoutRequestID": "ws_CO_170820251827443712345678",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {
                            "Name": "Amount",
                            "Value": 100.00
                        },
                        {
                            "Name": "MpesaReceiptNumber",
                            "Value": "LGR001234567890"
                        },
                        {
                            "Name": "PhoneNumber",
                            "Value": "254712345678"
                        }
                    ]
                }
            }
        }
    }
    
    # Send the callback to the endpoint
    try:
        response = requests.post(
            "http://localhost:8000/api/mpesa/callback",
            headers={"Content-Type": "application/json"},
            data=json.dumps(callback_data)
        )
        
        print("Callback Simulation Results:")
        print("=" * 40)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("\nCallback Response:")
            print(f"  Result Code: {result.get('ResultCode')}")
            print(f"  Result Desc: {result.get('ResultDesc')}")
        else:
            print("Error occurred during callback simulation")
            
    except Exception as e:
        print(f"Error making callback request: {str(e)}")

if __name__ == "__main__":
    simulate_callback()