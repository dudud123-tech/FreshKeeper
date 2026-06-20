Put the receipt text detection model here as:

dbnet_receipt.tflite

The Android native module ReceiptTextDetector loads this file from app assets.
If the file is missing, the module returns an empty box list and the app falls back to OpenCV / ML Kit coordinates.
