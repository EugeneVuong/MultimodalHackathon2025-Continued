"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
  Constants,
} from "@videosdk.live/react-sdk";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// Define bounding-box type
interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Add the auth token
const authToken = process.env.NEXT_PUBLIC_VIDEOSDK_AUTH_TOKEN!;

// Create the main CameraView component
export default function CameraView() {
  const params = useParams();
  const sessionID = params.sessionID as string;

  return (
    <div className="relative w-full h-screen bg-neutral-900">
      <MeetingProvider
        config={{
          meetingId: sessionID,
          micEnabled: false,
          webcamEnabled: false,
          name: "Camera View",
          mode: Constants.modes.RECV_ONLY,
          debugMode: false,
        }}
        token={authToken}
      >
        <StreamContainer sessionID={sessionID} />
      </MeetingProvider>
    </div>
  );
}

// StreamContainer manages subscription to motionEvents
function StreamContainer({ sessionID }: { sessionID: string }) {
  const { join, meeting } = useMeeting({
    onMeetingJoined: () => console.log("Joined meeting:", sessionID),
    onError: (err) => console.error("Meeting error:", err),
  });

  // State for motion-detection bounding boxes
  const [boxes, setBoxes] = useState<BBox[]>([]);

  // Subscribe to Firestore for motionEvents/{sessionID}
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "motionEvents", sessionID),
      (snap) => {
        if (snap.exists()) {
          setBoxes(snap.data().boxes || []);
        }
      },
      (err) => console.error("MotionEvents listener error:", err)
    );
    return () => unsub();
  }, [sessionID]);

  useEffect(() => {
    if (!meeting) {
      join();
    }
  }, [join, meeting]);

  return (
    <>
      <div className="absolute top-4 left-4 z-10 bg-black/75 text-white px-4 py-2 rounded-lg shadow-lg">
        <p className="font-mono text-sm">Session ID: {sessionID}</p>
      </div>
      {meeting ? (
        <StreamView boxes={boxes} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <p>Connecting to stream...</p>
        </div>
      )}
    </>
  );
}

// StreamView renders video participants and overlays boxes
function StreamView({ boxes }: { boxes: BBox[] }) {
  const { participants } = useMeeting();
  const participantArray = Array.from(participants.values());

  if (participantArray.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white">
        <p>Waiting for camera stream...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {participantArray
        .filter((p) => p.mode === Constants.modes.SEND_AND_RECV)
        .map((p) => (
          <Participant key={p.id} participantId={p.id} />
        ))}

      {/* Overlay bounding boxes */}
      {boxes.map((b, i) => (
        <div
          key={i}
          className="absolute border-2 border-red-500 pointer-events-none"
          style={{
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            zIndex: 10,
          }}
        />
      ))}
    </div>
  );
}

// Participant renders a single video stream
function Participant({ participantId }: { participantId: string }) {
  const { webcamStream, webcamOn } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setupStream = (
    stream: any,
    ref: React.RefObject<HTMLVideoElement | HTMLAudioElement>,
    condition: boolean
  ) => {
    if (!ref.current) return;
    if (stream && condition) {
      const mediaTrack = (stream as { track: MediaStreamTrack }).track;
      ref.current.srcObject = new MediaStream([mediaTrack]);
      ref.current.play().catch(console.error);
    } else {
      ref.current.pause();
      ref.current.srcObject = null;
    }
  };

  useEffect(() => {
    setupStream(webcamStream, videoRef, webcamOn);
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative w-full h-full">
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <p>Camera Off</p>
        </div>
      )}
    </div>
  );
}
