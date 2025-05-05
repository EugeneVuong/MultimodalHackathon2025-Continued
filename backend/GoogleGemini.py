import asyncio
import base64
import cv2
import io
import numpy as np
import time
import os
from collections import deque
from fastapi import FastAPI
from aiortc import RTCPeerConnection, RTCSessionDescription
from dotenv import load_dotenv
import uvicorn
import requests
import deeplake
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import av.logging

# load environment and initialize app
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    av.logging.set_level(av.logging.ERROR) 

    # startup logic (if any)
    yield
    # shutdown cleanup: close all peer connections
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

pcs: set[RTCPeerConnection] = set()

schema = {
    "id": deeplake.types.UInt64(),  # Unique identifier for each entry (e.g., session ID or video clip ID)
    "frames": deeplake.types.Sequence(deeplake.types.Image(sample_compression="jpeg")),  # Video frames as a sequence of images
    "captions": deeplake.types.Text(),  # Single caption for the entire video
    "embeddings": deeplake.types.Embedding(768),  # Embedding for the entire video
}


# path = "file://database"
path = "al://second-sight/videos"

df = 0

try:
    ds = deeplake.open(path)
except Exception as e:
    print(f"Failed to open dataset: {e}")
    ds = deeplake.create(path, schema=schema)

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.codecs import get_decoder as _original_get_decoder
import aiortc.codecs

# patch out missing RTX decoder errors
def _patched_get_decoder(codec):
    try:
        return _original_get_decoder(codec)
    except ValueError as e:
        if 'video/rtx' in str(e):
            print(f"Ignoring missing RTX decoder: {e}")
            return None
        raise

aiortc.codecs.get_decoder = _patched_get_decoder

async def consume_video(track, session_id: str):
    previous_frame = None
    frame_buffer = deque()
    recording_mode = False
    recording_start_time = None
    clip_frames = []
    while True:
        frame = await track.recv()
        img = frame.to_ndarray(format="bgr24")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21,21), 0)
        current_time = time.time()
        frame_buffer.append((current_time, img.copy()))
        while frame_buffer and (current_time - frame_buffer[0][0] > 5):
            frame_buffer.popleft()
        if previous_frame is None:
            previous_frame = gray
        else:
            # ensure frames have same size before diff
            if previous_frame.shape != gray.shape:
                print(f"Shape mismatch: prev={previous_frame.shape}, curr={gray.shape}, resetting.")
                previous_frame = gray
                continue
            # compute difference
            delta = cv2.absdiff(previous_frame, gray)
            thresh = cv2.threshold(delta, 50, 255, cv2.THRESH_BINARY)[1]
            thresh = cv2.dilate(thresh, None, iterations=2)
            contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            movement_detected = False
            for c in contours:
                if cv2.contourArea(c) < 1500:
                    continue
                movement_detected = True
                x, y, w, h = cv2.boundingRect(c)
                cv2.rectangle(img, (x,y), (x+w, y+h), (0,255,0), 2)
            if movement_detected:
                cv2.putText(img, "Motion Detected", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
                if not recording_mode:
                    recording_mode = True
                    recording_start_time = current_time
                    clip_frames = [f for ts, f in frame_buffer]
        previous_frame = gray
        if recording_mode:
            clip_frames.append(img.copy())
            if current_time - recording_start_time >= 15:
                out_filename = f"tempVideo/motion_clip_{int(current_time)}.mp4"
                h, w, _ = img.shape
                writer = cv2.VideoWriter(out_filename, cv2.VideoWriter_fourcc(*'mp4v'), 20.0, (w, h))
                for f in clip_frames:
                    writer.write(f)
                writer.release()
                print(f"Saved motion clip to {out_filename}")
                asyncio.create_task(process_motion_clip(out_filename, session_id))
                recording_mode = False
                clip_frames = []

@app.post("/webrtc/offer/{session_id}")
async def offer(session_id: str, sdp: dict):
    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("track")
    def on_track(track):
        if track.kind == "video":
            asyncio.create_task(consume_video(track, session_id))

    offer = RTCSessionDescription(**sdp)
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}

async def process_motion_clip(clip_filename: str, session_id: str):
    """
    Processes a saved motion clip by first generating a caption using Google's Gemini API,
    then generating text embeddings using Together AI. The blocking API calls are executed
    in a thread pool, and an async semaphore is used to limit concurrent API calls.
    """
    async with asyncio.Semaphore(1):
        loop = asyncio.get_running_loop()
        try:
            caption = await loop.run_in_executor(None, generate_video_caption, clip_filename)
            print("Generated caption:", caption)
            embedding = await loop.run_in_executor(None, generate_text_embedding, caption)
            print("Generated embedding:", embedding)
            await loop.run_in_executor(None, process_video_and_store, ds, clip_filename, caption, embedding, session_id)
            print("Generated embedding:", embedding)


        except Exception as e:
            print(f"Error processing motion clip {clip_filename}: {e}")

def process_video_and_store(ds, video_path, caption, embedding, streamId):
    """
    Process a video to store caption and embedding in dataset.

    Args:
        ds (deeplake._deeplake.DatasetView): The dataset to store the results
        video_path (str): Path to the video file
        caption (str): Caption generated for the video
        embedding (list): Embedding generated for the caption
    """

    # Read the MP4 file as binary
    with open(video_path, "rb") as video_file:
        video_blob = io.BytesIO(video_file.read())
    base64encoding = base64.b64encode(video_blob.getvalue()).decode("utf-8")

    # Extract frames from the video
    frames = extract_frames(video_path)

    data_to_upload = {
           'id': int(time.time() * 1000),  # Repeat the ID for each frame
            'frames': [cv2.imencode('.jpg', frame)[1].tobytes() for frame in frames],  # Encode frames to JPEG
            'captions': caption,  # Single caption for the entire video (not repeated)
            'embeddings': embedding,  # Single embedding for the entire video
        }
    ds.append(data_to_upload)
    ds.commit("add to database")


def generate_video_caption(video_path: str, api_key: str = None):
    if api_key is None:
        api_key = os.getenv("GEMINI_API_KEY")
    """
    Generate a detailed caption for a video file using Google's Gemini API.
    
    Args:
        video_path (str): Path to the video file
        api_key (str): Google Gemini API key
    
    Returns:
        str: Generated caption for the video
    """
    client = genai.Client(api_key=api_key)

    print("Uploading video...")
    video_file = client.files.upload(file=video_path)
    print(f"Completed upload: {video_file.uri}")

    # Wait for video processing
    while video_file.state.name == "PROCESSING":
        print('.', end='', flush=True)
        time.sleep(1)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        raise ValueError(f"Video processing failed: {video_file.state.name}")

    # Enhanced prompt for better description
    # prompt = """
    # Analyze this video in detail and describe:
    # 1. The main action or event
    # 2. The setting and environment
    # 3. Any notable movements or changes
    # 4. Key details about the subjects involved
    # Please provide a natural, flowing description.
    # """

    prompt = """
    Analyze this video in detail and describe the main action or 
    event, the setting and environment, any notable movements or 
    changes, and key details about the subjects involved. 
    Please provide a natural, flowing description.
    """

    response = client.models.generate_content(
        model="gemini-2.0-flash-lite-preview-02-05",
        contents=[video_file, prompt]
    )

    # Cleanup
    client.files.delete(name=video_file.name)

    return response.text

def generate_text_embedding(text: str, api_key: str = None):
    if api_key is None:
        api_key = os.getenv("TOGETHER_API_KEY")
    """
    Generate text embeddings using Together AI API.
    
    Args:
        text (str): Input text to generate embedding for
        api_key (str): Together AI API key
    
    Returns:
        list: Vector embedding of the input text
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

    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()['data'][0]['embedding']
    else:
        raise Exception(f"API request failed with status {response.status_code}")
    
# Function to extract frames from a video file
def extract_frames(video_path):
    # Open the video
    cap = cv2.VideoCapture(video_path)
    frames = []

    while True:
        ret, frame = cap.read()  # Read the next frame
        if not ret:
            break  # End of video

        # You can optionally process or resize the frame here
        frames.append(frame)  # Append frame to list

    cap.release()
    return frames

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
