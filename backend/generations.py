#!/usr/bin/env python3
"""
local_test_gemini.py

Recreates your generate_video_caption and generate_text_embedding
functions in isolation for quick manual testing.
"""

import os
import time
import requests
from dotenv import load_dotenv
from google import genai

# 1) Load your API keys
load_dotenv()
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY")
TOGETHER_API_KEY  = os.getenv("TOGETHER_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("Set GEMINI_API_KEY in your .env")
if not TOGETHER_API_KEY:
    raise RuntimeError("Set TOGETHER_API_KEY in your .env")

def generate_video_caption(video_path, api_key=GEMINI_API_KEY):
    """
    Generate a detailed caption for a video file using Google's Gemini API.
    """
    client = genai.Client(api_key=api_key)
    print("Uploading video to Gemini…")
    video_file = client.files.upload(file=video_path)
    print(f"  → upload URI: {video_file.uri}")

    # Wait for processing
    while video_file.state.name == "PROCESSING":
        print(".", end="", flush=True)
        time.sleep(1)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        raise RuntimeError(f"Video processing failed: {video_file.state.name}")

    prompt = """
    Analyze this video in detail and describe the main action or 
    event, the setting and environment, any notable movements or 
    changes, and key details about the subjects involved. 
    Please provide a natural, flowing description.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-04-17",
        contents=[video_file, prompt]
    )

    # Clean up
    client.files.delete(name=video_file.name)
    return response.text

def generate_text_embedding(text, api_key=TOGETHER_API_KEY):
    """
    Generate text embeddings using the Together AI API.
    """
    url = "https://api.together.xyz/v1/embeddings"
    payload = {
        "model": "togethercomputer/m2-bert-80M-8k-retrieval",
        "input": text
    }
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    resp = requests.post(url, json=payload, headers=headers)
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]


if __name__ == "__main__":
    # 2) Point this to your sample clip
    SAMPLE_VIDEO = "tempVideo/testdelivery.mov"

    print("=== Testing generate_video_caption ===")
    caption = generate_video_caption(SAMPLE_VIDEO)
    print("\nCaption:", caption)

    print("\n=== Testing generate_text_embedding ===")
    emb = generate_text_embedding(caption)
    print(f"Embedding length: {len(emb)}  (first 10 dims: {emb[:10]})")
