# test_mpesa_shortcode.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_shortcode_type():
    """Test M-Pesa shortcode type and transaction configuration"""
    
    shortcode = os.getenv("MPESA_SHORTCODE", "137146")
    print(f"M-Pesa Shortcode: {shortcode}")
    
    # Determine shortcode type
    if len(shortcode) == 6:
        shortcode_type = "PayBill (Business)"
        transaction_type = "CustomerPayBillOnline"
        party_b = shortcode
        print(f"Shortcode Type: {shortcode_type}")
        print(f"Transaction Type: {transaction_type}")
        print(f"Party B (Business Shortcode): {party_b}")
        print("This configuration is for PayBill transactions.")
    elif len(shortcode) == 5:
        shortcode_type = "Till Number"
        transaction_type = "CustomerBuyGoodsOnline"
        party_b = "0" + shortcode  # Till numbers need a leading zero for PartyB
        print(f"Shortcode Type: {shortcode_type}")
        print(f"Transaction Type: {transaction_type}")
        print(f"Party B (Till Number with leading zero): {party_b}")
        print("This configuration is for Till Number transactions.")
    else:
        print(f"Unknown shortcode type. Length: {len(shortcode)}")
        print("Shortcode should be either 5 digits (Till) or 6 digits (PayBill)")
        
    print("\n" + "="*50)
    print("M-Pesa STK Push Configuration Summary:")
    print("="*50)
    print(f"Business Shortcode: {shortcode}")
    print(f"Transaction Type: {transaction_type}")
    print(f"Party B: {party_b}")
    print("Callback URL:", os.getenv("MPESA_CALLBACK_URL", "Not set"))
    print("Mode:", os.getenv("MPESA_MODE", "sandbox"))

if __name__ == "__main__":
    test_shortcode_type()