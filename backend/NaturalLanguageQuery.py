import asyncio
import base64
import cv2
import io
import numpy as np
import time
import os
from collections import deque
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import deeplake
import requests
import uvicorn
from generations import generate_text_embedding

# load environment and initialize app
load_dotenv()

# --- FastAPI Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    yield
    # Shutdown cleanup: close all peer connections
    await asyncio.gather(*[pc.close() for pc in pcs])

# initialize FastAPI with lifespan
app = FastAPI(lifespan=lifespan)

# enable CORS globally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pcs: set = set()

# --- Environment Variables and DeepLake Connection ---
ACTIVELOOP_TOKEN = os.getenv("ACTIVELOOP_TOKEN")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
DEEPLAKE_PATH = "al://second-sight/video-recordings"  # Use hub:// for Activeloop Cloud

# --- Initialize DeepLake Dataset ---
try:
    ds = deeplake.open(DEEPLAKE_PATH, token=ACTIVELOOP_TOKEN)
except Exception as e:
    print(f"Failed to open dataset: {e}")

# --- Pydantic Models for Request and Response ---
class QueryRequest(BaseModel):
    query: str

class VideoResult(BaseModel):
    id: str
    caption: str
    frames: list[str]  # List of Base64 encoded frames

class QueryResponse(BaseModel):
    results: list[VideoResult]

# --- Helper function to query dataset ---
def query_deeplake_dataset(query_text: str, num_results: int = 1):
    global ds
    if ds is None:
        raise HTTPException(status_code=503, detail="Dataset not available")

    results_list = []
    try:
        # 1. Generate embedding for the query
        embed_query = generate_text_embedding(query_text, TOGETHER_API_KEY)
        if embed_query is None:
             raise ValueError("Embedding generation failed.")

        # Convert embedding to string format for the query
        str_query_embedding = ",".join(map(str, embed_query))

        # 2. Construct and execute the DeepLake query
        dl_query = f"""
            SELECT id, captions, frames, cosine_similarity(embeddings, ARRAY[{str_query_embedding}]) as score
            ORDER BY score DESC
            LIMIT {num_results}
        """

        # Execute the query
        view = ds.query(dl_query)

        # 3. Process results
        for row in view:
            row_data = row.data()  # Get dictionary representation

            if not all(k in row_data for k in ['id', 'captions', 'frames']):
                 print(f"Warning: Skipping row due to missing keys. Row data: {row_data.keys()}")
                 continue

            video_id = str(row_data["id"])
            caption = row_data["captions"]
            frame_tensors = row_data["frames"]

            # Encode frames to Base64
            base64_frames = []
            if hasattr(frame_tensors, '__iter__'):  # Ensure it's iterable
                for frame_data in frame_tensors:
                    try:
                        # Convert tensor data to bytes (JPEG encoding)
                        frame_bytes = frame_data.tobytes()  # Get raw bytes
                        encoded_frame = base64.b64encode(frame_bytes).decode('utf-8')
                        base64_frames.append(encoded_frame)
                    except AttributeError:
                        print(f"Warning: Could not get bytes from frame data type: {type(frame_data)}. Skipping frame.")
                    except Exception as encode_err:
                        print(f"Warning: Error encoding frame: {encode_err}. Skipping frame.")

            if base64_frames:
                results_list.append(VideoResult(
                    id=video_id,
                    caption=caption,
                    frames=base64_frames
                ))

    except Exception as e:
        print(f"Error during query processing: {e}")
        raise HTTPException(status_code=500, detail=f"Error querying dataset: {str(e)}")

    return results_list

# --- API Endpoint for Querying Videos ---
@app.post("/query", response_model=QueryResponse)
async def search_videos(request: QueryRequest):
    """
    Receives a text query, finds the most relevant video in the dataset
    based on embedding similarity, and returns its metadata including
    Base64 encoded frames.
    """
    try:
        search_results = query_deeplake_dataset(request.query)
        return QueryResponse(results=search_results)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Unexpected error in /query endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
