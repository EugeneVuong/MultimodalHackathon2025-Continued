import asyncio
import base64
import cv2
import io
import numpy as np
import time
from collections import deque
from playwright.async_api import async_playwright
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
import requests
import deeplake

# Global variables to keep track of tasks, the Playwright instance, and the main event loop.
tasks = {}
playwright_instance = None
MAIN_LOOP = None  # This will be set to the asyncio event loop running our main().
api_semaphore: asyncio.Semaphore = None  # Used to limit concurrent API calls.


schema = {
    "id": deeplake.types.UInt64(),
    "embedding": deeplake.types.Embedding(768),
    "caption": deeplake.types.Text(),
    "base64encoding": deeplake.types.Text(),
    "streamId": deeplake.types.Text(),
}

path = "file://database"
df = 0

try:
    ds = deeplake.open(path)
except Exception as e:
    print(f"Failed to open dataset: {e}")
    ds = deeplake.create(path, schema=schema)


async def run_screencast(url: str, window_name: str, playwright_instance):
    """
    Launches a browser, navigates to `url`, starts a CDP screencast, and displays
    the live frames in an OpenCV window named `window_name`. It also checks for
    significant movement in the frame and, upon detecting motion, saves a video clip
    that includes the last 5 seconds (from a rolling buffer) and the next 15 seconds.
    """
    # Launch browser and open page.
    browser = await playwright_instance.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto(url)

    # Create a CDP session and start the screencast.
    session = await context.new_cdp_session(page)
    await session.send("Page.startScreencast", {"format": "png", "quality": 100})

    previous_frame = None  # For motion detection.
    frame_buffer = deque()  # Rolling buffer for last 5 seconds.
    
    # Variables for recording the motion clip.
    recording_mode = False
    recording_start_time = None
    clip_frames = []

    async def handle_screencast_frame(frame):
        nonlocal previous_frame, recording_mode, recording_start_time, clip_frames
        data = frame.get("data")
        session_id = frame.get("sessionId")
        # Acknowledge the frame.
        await session.send("Page.screencastFrameAck", {"sessionId": session_id})
        
        if data:
            # Decode the frame.
            img_bytes = base64.b64decode(data)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame_img is None:
                return

            # Prepare for motion detection.
            gray = cv2.cvtColor(frame_img, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)
            
            current_time = time.time()
            frame_buffer.append((current_time, frame_img.copy()))
            while frame_buffer and (current_time - frame_buffer[0][0] > 5):
                frame_buffer.popleft()

            if previous_frame is None:
                previous_frame = gray
            else:
                frame_delta = cv2.absdiff(previous_frame, gray)
                thresh = cv2.threshold(frame_delta, 50, 255, cv2.THRESH_BINARY)[1]
                thresh = cv2.dilate(thresh, None, iterations=2)
                contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                movement_detected = False

                for contour in contours:
                    if cv2.contourArea(contour) < 1500:
                        continue
                    movement_detected = True
                    (x, y, w, h) = cv2.boundingRect(contour)
                    cv2.rectangle(frame_img, (x, y), (x+w, y+h), (0, 255, 0), 2)

                if movement_detected:
                    cv2.putText(frame_img, "Motion Detected", (10, 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    if not recording_mode:
                        recording_mode = True
                        recording_start_time = current_time
                        # Capture the previous 5 seconds from the rolling buffer.
                        clip_frames = [f for ts, f in frame_buffer]
                previous_frame = gray

            if recording_mode:
                clip_frames.append(frame_img.copy())
                if current_time - recording_start_time >= 15:
                    out_filename = f"tempVideo/motion_clip_{int(current_time)}.mp4"
                    height, width, _ = frame_img.shape
                    fps = 20.0
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                    out = cv2.VideoWriter(out_filename, fourcc, fps, (width, height))
                    for clip_frame in clip_frames:
                        out.write(clip_frame)
                    out.release()
                    print(f"Saved motion clip to {out_filename}")
                    # Process the clip asynchronously (limit concurrent API calls via semaphore).
                    asyncio.create_task(process_motion_clip(out_filename, window_name))
                    recording_mode = False
                    clip_frames = []

            # Display the frame.
            cv2.imshow(window_name, frame_img)
            # If 'q' is pressed, raise cancellation.
            if cv2.waitKey(1) & 0xFF == ord("q"):
                raise asyncio.CancelledError()

    # Register the frame handler.
    session.on("Page.screencastFrame", handle_screencast_frame)

    try:
        # Keep running indefinitely until cancelled.
        await asyncio.Future()  # This future never completes.
    except asyncio.CancelledError:
        print(f"Task for window '{window_name}' is being cancelled. Cleaning up resources.")
        try:
            await session.send("Page.stopScreencast")
        except Exception as e:
            print(f"Error stopping screencast for '{window_name}':", e)
        await browser.close()
        cv2.destroyWindow(window_name)
        raise

def on_snapshot(col_snapshot, changes, read_time):
    """
    Callback for Firestore snapshot updates.
    When a document is added, schedule a new task.
    When a document is removed, cancel the corresponding task.
    """
    for change in changes:
        doc_id = change.document.id
        if change.type.name == 'ADDED':
            print(f"Document '{doc_id}' was added.")
            MAIN_LOOP.call_soon_threadsafe(add_task, doc_id)
        elif change.type.name == 'REMOVED':
            print(f"Document '{doc_id}' was removed.")
            MAIN_LOOP.call_soon_threadsafe(remove_task, doc_id)

def add_task(doc_id: str):
    """
    Creates a new task for the given document ID if one doesn't already exist.
    """
    global tasks, playwright_instance
    if doc_id not in tasks:
        url = f"http://localhost:3000/server/{doc_id}"
        task = asyncio.create_task(run_screencast(url, doc_id, playwright_instance))
        tasks[doc_id] = task
        print(f"Task for '{doc_id}' started.")

def remove_task(doc_id: str):
    """
    Cancels and removes the task associated with the given document ID.
    """
    global tasks
    task = tasks.get(doc_id)
    if task:
        task.cancel()
        print(f"Task for '{doc_id}' cancelled.")
        del tasks[doc_id]

async def process_motion_clip(clip_filename: str, session_id: str):
    """
    Processes a saved motion clip by first generating a caption using Google's Gemini API,
    then generating text embeddings using Together AI. The blocking API calls are executed
    in a thread pool, and an async semaphore is used to limit concurrent API calls.
    """
    global api_semaphore
    async with api_semaphore:
        loop = asyncio.get_running_loop()
        try:
            caption = await loop.run_in_executor(None, generate_video_caption, clip_filename)
            # print("Generated caption:", caption)
            embedding = await loop.run_in_executor(None, generate_text_embedding, caption)
            # print("Generated embedding:", embedding)
            await loop.run_in_executor(None, process_video_and_store, ds, clip_filename, caption, embedding, session_id)
            # print("Generated embedding:", embedding)


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

    ds.append({
        "id": [1],
        "embedding": [embedding],
        "caption": [caption],
        "base64encoding": [base64encoding],
        "streamId": [streamId]
    })

    ds.commit("add to database")


def generate_video_caption(video_path, api_key="AIzaSyA5NlH0GOSjAJKfmeCohq8tTNkES5_6uMU"):
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
    prompt = """
    Analyze this video in detail and describe:
    1. The main action or event
    2. The setting and environment
    3. Any notable movements or changes
    4. Key details about the subjects involved
    Please provide a natural, flowing description.
    """

    response = client.models.generate_content(
        model="gemini-2.0-flash-lite-preview-02-05",
        contents=[video_file, prompt]
    )

    # Cleanup
    client.files.delete(name=video_file.name)
    
    return response.text

def generate_text_embedding(text, api_key="257203c442a94c07ff6f1776f8cfbc6ea6a291cd9404e6fe70ad467cb9342762"):
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


async def main():
    global playwright_instance, MAIN_LOOP, api_semaphore

    # Initialize the Firebase Admin SDK.
    cred = credentials.Certificate("mmh2025-f6143-firebase-adminsdk-fbsvc-898695a57c.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    # Reference the collection to monitor.
    collection_ref = db.collection('sessionIds')
    # Set up the Firestore snapshot listener.
    collection_ref.on_snapshot(on_snapshot)

    # Store the current running event loop.
    MAIN_LOOP = asyncio.get_running_loop()
    # Initialize the semaphore to limit API call concurrency.
    api_semaphore = asyncio.Semaphore(1)

    async with async_playwright() as p:
        playwright_instance = p
        print("Listening for Firestore changes... Press Ctrl+C to exit.")
        # Keep the main task alive.
        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Shutting down.")
