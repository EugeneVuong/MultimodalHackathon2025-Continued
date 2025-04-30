import os
import firebase_admin
from firebase_admin import credentials, firestore

# Point to your service‐account JSON (or set GOOGLE_APPLICATION_CREDENTIALS)
cred = credentials.Certificate("mmh2025-f6143-firebase-adminsdk-fbsvc-02a58364e6.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

session_id = "pmcr-n98d-0pfh"
doc = db.collection("motionEvents").document(session_id).get()
print("Exists?", doc.exists)
print("Data:", doc.to_dict())
