import asyncio
import base64
import cv2
import io
import numpy as np
import time
import os
from collections import deque
from fastapi import FastAPI, HTTPException
from aiortc import RTCPeerConnection, RTCSessionDescription
from dotenv import load_dotenv
import uvicorn
import requests
import deeplake
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import av.logging
from pydantic import BaseModel

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

# Change this to your own created dataset
path = "al://second-sight/video-recordings"
# Define your schema
schema = {
    "id": deeplake.types.UInt64(),  # Unique identifier for each entry (e.g., session ID or video clip ID)
    "frames": deeplake.types.Sequence(deeplake.types.Image(sample_compression="jpeg")),  # Video frames as a sequence of images
    "captions": deeplake.types.Text(),  # Single caption for the entire video
    "embeddings": deeplake.types.Embedding(768),  # Embedding for the entire video
}
df = 0

try:
    ds = deeplake.open(path, token=os.getenv("ACTIVELOOP_TOKEN"))
except Exception as e:
    print(f"Failed to open dataset: {e}")
    ds = deeplake.create(url = path, schema=schema, token= os.getenv("ACTIVELOOP_TOKEN"))
    print(f"Created new dataset at {path}")
    

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
    jpeg_frames = []
    for frame in frames:
        ret, jpeg = cv2.imencode('.jpg', frame)
        if ret:
            jpeg_frames.append(jpeg.tobytes())

    data_to_upload = {
           'id': [int(time.time() * 1000)],  # Repeat the ID for each frame
            'frames': [jpeg_frames],  # Encode frames to JPEG
            'captions': [caption],  # Single caption for the entire video (not repeated)
            'embeddings': [embedding],  # Single embedding for the entire video
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

# Pydantic models for query endpoint
class QueryRequest(BaseModel):
    query: str

class VideoResult(BaseModel):
    id: str
    caption: str
    frames: list[str]

class QueryResponse(BaseModel):
    results: list[VideoResult]

def query_deeplake_dataset(query_text: str, num_results: int = 1):
    if ds is None:
        raise HTTPException(status_code=503, detail="Dataset not available")

    results_list = []
    try:
        embed_query = generate_text_embedding(query_text)
        if embed_query is None:
            raise ValueError("Embedding generation failed.")

        str_query_embedding = ",".join(map(str, embed_query))

        dl_query = f"""
            SELECT *, cosine_similarity(embeddings, ARRAY[{str_query_embedding}]) as score
            ORDER BY cosine_similarity(embeddings, ARRAY[{str_query_embedding}]) DESC 
            LIMIT {num_results}  
        """
        view = ds.query(dl_query)

        for row in view:
            # row is a tuple: (id, captions, frames, score)
            try:
                # Access by column name (string)
                video_id = row['id']
                caption = row['captions'] 
                frame_tensors = row['frames']
                # score = row['score'] # You might want to use the score if needed later
            except KeyError as e:
                print(f"KeyError: {e} not found in row. Available keys: {list(row.keys()) if hasattr(row, 'keys') else 'N/A'}")
                print("Row content:", row)
                continue
            except TypeError:
                # This might happen if row isn't subscriptable as expected
                print(f"TypeError: Row is not a dict-like object. Row type: {type(row)}, Row: {row}")
                continue
            
            base64_frames = []
            # Ensure frame_tensors is what you expect. It might be a list of bytes already.
            # If 'frames' in DeepLake is already a list of JPEG bytes, the structure might be different.
            
            # Assuming frame_tensors is a list of individual frame data (e.g., numpy arrays or byte strings)
            if isinstance(frame_tensors, (list, np.ndarray)): # Check if it's iterable
                # If frame_tensors from deeplake for 'frames' column is a list containing ONE list of bytes:
                if len(frame_tensors) == 1 and isinstance(frame_tensors[0], list) and all(isinstance(f, bytes) for f in frame_tensors[0]):
                    actual_frame_data_list = frame_tensors[0]
                else: # Otherwise, assume it's a list of frame data directly
                    actual_frame_data_list = frame_tensors

                for frame_data in actual_frame_data_list:
                    if isinstance(frame_data, np.ndarray): # If it's a numpy array (raw pixels)
                        try:
                            # Print debug info about frame_data
                            print(f"Frame data shape: {frame_data.shape}, dtype: {frame_data.dtype}")
                            
                            # Handle different array shapes
                            frame_to_encode = None
                            if len(frame_data.shape) == 2:  # Grayscale image
                                frame_to_encode = frame_data
                            elif len(frame_data.shape) == 3:  # Color image (or similar)
                                frame_to_encode = frame_data
                                if frame_data.shape[2] == 1:  # Single channel in 3D array
                                    frame_to_encode = frame_data[:,:,0]  # Extract the single channel
                            elif len(frame_data.shape) == 1:  # 1D array, likely encoded bytes
                                try:
                                    # Try to decode it if it's bytes
                                    if frame_data.dtype == np.dtype('uint8') or frame_data.dtype == np.dtype('int8'):
                                        # Assume it's a serialized JPEG
                                        encoded = base64.b64encode(frame_data.tobytes()).decode('utf-8')
                                        base64_frames.append(encoded)
                                        continue  # Skip the resize and re-encode path
                                except Exception as e:
                                    print(f"Error handling 1D array: {e}")
                                    continue  # Skip this frame
                            else:
                                print(f"Unexpected frame_data shape: {frame_data.shape}")
                                continue  # Skip this frame
                            
                            # If we don't have a frame to encode at this point, skip
                            if frame_to_encode is None:
                                print("No valid frame to encode")
                                continue
                                
                            # Get the dimensions for resizing if needed
                            if len(frame_to_encode.shape) >= 2:
                                height, width = frame_to_encode.shape[:2]
                                max_image_dim = 1920  # Max dimension (width or height)
                                
                                if height > max_image_dim or width > max_image_dim:
                                    if height > width:
                                        scaling_factor = max_image_dim / float(height)
                                        new_height = max_image_dim
                                        new_width = int(width * scaling_factor)
                                    else: # width >= height
                                        scaling_factor = max_image_dim / float(width)
                                        new_width = max_image_dim
                                        new_height = int(height * scaling_factor)
                                    
                                    # Ensure dimensions are at least 1
                                    new_width = max(1, new_width)
                                    new_height = max(1, new_height)

                                    # Ensure frame is in the right format for resize
                                    if frame_to_encode.dtype != np.uint8:
                                        frame_to_encode = frame_to_encode.astype(np.uint8)
                                        
                                    resized_frame = cv2.resize(frame_to_encode, (new_width, new_height), interpolation=cv2.INTER_AREA)
                                    frame_to_encode = resized_frame
                                    print(f"Resized frame from {width}x{height} to {new_width}x{new_height} (max_dim: {max_image_dim})")
                            
                            # Convert frame to correct format for imencode if needed
                            if frame_to_encode.dtype != np.uint8:
                                frame_to_encode = frame_to_encode.astype(np.uint8)
                                
                            # This path might not be hit if you stored pre-encoded JPEGs
                            try:
                                ret, buffer = cv2.imencode('.jpg', frame_to_encode) # Use potentially resized frame
                                if ret:
                                    encoded = base64.b64encode(buffer).decode('utf-8')
                                    base64_frames.append(encoded)
                                else:
                                    print("imencode failed but didn't raise exception")
                            except Exception as e:
                                print(f"imencode specific error: {e}")
                                # Try saving the frame to a buffer using PIL as a fallback
                                try:
                                    from PIL import Image
                                    import io
                                    img = Image.fromarray(frame_to_encode)
                                    buffer = io.BytesIO()
                                    img.save(buffer, format="JPG")
                                    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
                                    base64_frames.append(encoded)
                                    print("Successfully used PIL as fallback")
                                except Exception as pil_err:
                                    print(f"PIL fallback also failed: {pil_err}")
                        except Exception as encode_err:
                            print(f"Error encoding numpy frame: {encode_err}")
                            continue
                    elif isinstance(frame_data, bytes): # If it's already bytes (likely pre-encoded JPEG)
                        try:
                            encoded = base64.b64encode(frame_data).decode('utf-8')
                            base64_frames.append(encoded)
                        except Exception as encode_err:
                            print(f"Error base64 encoding bytes frame: {encode_err}")
                            continue
                    else:
                        print(f"Skipping unrecognized frame_data type: {type(frame_data)}")
            else:
                print(f"Frame_tensors is not iterable or not a recognized type: {type(frame_tensors)}")


            if base64_frames:
                results_list.append(VideoResult(
                    id=str(video_id), # Ensure ID is string
                    caption=str(caption) if caption is not None else "", # Ensure caption is string
                    frames=base64_frames
                )) 

        return results_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def search_videos(request: QueryRequest):
    """
    Endpoint to search videos by natural language query.
    """
    results = query_deeplake_dataset(request.query)
    return QueryResponse(results=results)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)