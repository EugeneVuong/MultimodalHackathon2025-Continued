"use client";

// Add imports for useEffect and useRef
import { useEffect, useRef, RefObject } from "react";
import { useParams } from "next/navigation";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
  Constants,
} from "@videosdk.live/react-sdk";

// Add the auth token
const authToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiIzNjE1MTIzNi0zZDRjLTQwZGQtYjYzYy04MjJmN2JlNjE4MTQiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIl0sImlhdCI6MTczOTY4Mzg2NywiZXhwIjoxODk3NDcxODY3fQ.iuMlIS-8c7eoh_0ZrtT50d-gSPg3AaZKSjOUa1I5wFY";

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
        }}
        token={authToken}
      >
        <StreamContainer sessionID={sessionID} />
      </MeetingProvider>
    </div>
  );
}

// Add the StreamContainer component
function StreamContainer({ sessionID }: { sessionID: string }) {
  const { join, meeting } = useMeeting({
    onMeetingJoined: () => console.log("Joined meeting:", sessionID),
    onError: (error) => console.error("Meeting error:", error),
  });

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
        <StreamView />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <p>Connecting to stream...</p>
        </div>
      )}
    </>
  );
}

// Add the StreamView component
function StreamView() {
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
    <div className="h-full">
      {participantArray
        .filter((p) => p.mode === Constants.modes.SEND_AND_RECV)
        .map((p) => (
          <Participant key={p.id} participantId={p.id} />
        ))}
    </div>
  );
}

// Add the Participant component
function Participant({ participantId }: { participantId: string }) {
  const { webcamStream, webcamOn } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setupStream = (
    stream: any,
    ref: RefObject<HTMLVideoElement | HTMLAudioElement>,
    condition: boolean
  ) => {
    if (ref.current && stream) {
      ref.current.srcObject = condition
        ? new MediaStream([stream.track])
        : null;
      condition && ref.current.play().catch(console.error);
    }
  };

  useEffect(
    () => setupStream(webcamStream, videoRef, webcamOn),
    [webcamStream, webcamOn]
  );

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
