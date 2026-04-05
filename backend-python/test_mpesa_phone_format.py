# test_mpesa_phone_format.py
import re

def test_phone_formatting():
    """Test phone number formatting for M-Pesa"""
    
    test_numbers = [
        "0712345678",      # Valid format 1
        "254712345678",    # Valid format 2
        "712345678",       # Valid format 3 (missing 254)
        "07123456789",     # Invalid - too long
        "071234567",       # Invalid - too short
        "2547123456789",   # Invalid - too long
    ]
    
    print("Testing phone number formatting:")
    print("=" * 50)
    
    for phone in test_numbers:
        print(f"\nOriginal: {phone}")
        
        # Format phone number to ensure it starts with 2547
        formatted = phone.strip()
        if formatted.startswith("0"):
            formatted = "254" + formatted[1:]
        elif not formatted.startswith("254"):
            formatted = "254" + formatted
            
        print(f"Formatted: {formatted}")
        
        # Validate Kenyan phone number format
        phone_regex = r'^2547\d{8}$'
        is_valid = bool(re.match(phone_regex, formatted))
        print(f"Valid format: {is_valid}")
        
        if is_valid:
            print("OK - This phone number should work for M-Pesa STK Push")
        else:
            print("ERROR - This phone number will not work for M-Pesa STK Push")

if __name__ == "__main__":
    test_phone_formatting()