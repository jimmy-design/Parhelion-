# test_callback.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

app = FastAPI(title="M-Pesa Callback Test Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CallbackData(BaseModel):
    Body: dict

@app.post("/api/mpesa/callback")
async def mpesa_callback(request: CallbackData):
    """Handle M-Pesa payment callback"""
    try:
        # Log the callback data
        logging.info(f"M-Pesa callback received: {request}")
        
        # Extract payment details
        result_code = request.Body.get("stkCallback", {}).get("ResultCode", 1)
        result_desc = request.Body.get("stkCallback", {}).get("ResultDesc", "")
        merchant_request_id = request.Body.get("stkCallback", {}).get("MerchantRequestID", "")
        checkout_request_id = request.Body.get("stkCallback", {}).get("CheckoutRequestID", "")
        
        if result_code == 0:
            # Payment successful
            callback_metadata = request.Body.get("stkCallback", {}).get("CallbackMetadata", {}).get("Item", [])
            
            # Extract payment details from metadata
            amount = None
            mpesa_receipt = None
            phone_number = None
            
            for item in callback_metadata:
                if item.get("Name") == "Amount":
                    amount = item.get("Value")
                elif item.get("Name") == "MpesaReceiptNumber":
                    mpesa_receipt = item.get("Value")
                elif item.get("Name") == "PhoneNumber":
                    phone_number = item.get("Value")
            
            logging.info(f"Payment successful: {mpesa_receipt}, Amount: {amount}, Phone: {phone_number}")
            
            # Here you would typically update your database to mark the transaction as paid
            # For now, we'll just log it
            
            return {"ResultCode": 0, "ResultDesc": "Success"}
        else:
            # Payment failed
            logging.error(f"Payment failed: {result_desc}")
            return {"ResultCode": 1, "ResultDesc": "Payment failed"}
            
    except Exception as e:
        logging.error(f"Callback processing error: {str(e)}")
        # Always return success to M-Pesa to avoid retries
        return {"ResultCode": 0, "ResultDesc": "Success"}

@app.get("/")
async def read_root():
    return {"message": "M-Pesa Callback Test Server is running"}

if __name__ == "__main__":
    # Run the test server
    uvicorn.run(app, host="0.0.0.0", port=8001)