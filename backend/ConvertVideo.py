import os
import cv2

# --- Function to Create Video from Frames ---
def create_video_from_frames(frames, output_path, fps=30):
    """Creates a video file from a list of frames."""
    if not frames:
        print("Error: No frames provided to create video.")
        return False

    # Get frame dimensions from the first frame
    height, width, layers = frames[0].shape
    size = (width, height)

    # Define the codec and create VideoWriter object
    # Common codecs: 'mp4v' for .mp4, 'XVID' for .avi
    # Adjust fourcc based on desired output format and available codecs
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # For .mp4 output
    out = cv2.VideoWriter(output_path, fourcc, fps, size)

    if not out.isOpened():
        print(f"Error: Could not open VideoWriter for path {output_path}")
        # Try a different codec if the first fails (optional)
        # fourcc = cv2.VideoWriter_fourcc(*'XVID') # For .avi
        # out = cv2.VideoWriter(output_path.replace('.mp4', '.avi'), fourcc, fps, size)
        # if not out.isOpened():
        #     print(f"Error: Still could not open VideoWriter with alternative codec.")
        #     return False
        return False


    print(f"Writing {len(frames)} frames to {output_path} at {fps} FPS...")
    for frame in frames:
        # Ensure frame dimensions match if they vary (though they shouldn't from extract_frames)
        if frame.shape[0] != height or frame.shape[1] != width:
            print(f"Warning: Frame size mismatch ({frame.shape[:2]}) vs expected ({height, width}). Resizing.")
            frame = cv2.resize(frame, size)
        out.write(frame) # Write the frame

    out.release() # Release the VideoWriter
    print(f"Successfully created video: {output_path}")
    return True