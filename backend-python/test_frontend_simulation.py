import requests
import json

# Test the customer lookup with the mobile number we know exists
mobile_number = "254712345678"

print("Testing customer lookup with mobile number:", mobile_number)

# Test general customer lookup endpoint
response = requests.get(f"http://localhost:8000/loyalty/customer/{mobile_number}")
print("General lookup response:", response.json())

# Test mobile-specific lookup endpoint
response = requests.get(f"http://localhost:8000/loyalty/customer/mobile/{mobile_number}")
print("Mobile-specific lookup response:", response.json())

# Test transaction processing
print("\nTesting transaction processing...")

transaction_data = {
    "items": [
        {
            "code": "TEST001",
            "description": "Test Item",
            "quantity": 1,
            "price": 10.0,
            "taxable": True,
            "rep": "T001"
        }
    ],
    "tenders": [
        {
            "code": "Cash",
            "amount": 10.0
        }
    ],
    "total": 10.0,
    "tax": 0.8
}

response = requests.post("http://localhost:8000/transaction", json=transaction_data)
print("Transaction response:", response.json())