"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
} from "@videosdk.live/react-sdk";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

const authToken = process.env.NEXT_PUBLIC_VIDEOSDK_AUTH_TOKEN as string;
if (!authToken) throw new Error("Missing NEXT_PUBLIC_VIDEOSDK_AUTH_TOKEN env var");

// helper to create a new Videosdk room
const createStream = async (token: string): Promise<string> => {
  const res = await fetch("https://api.videosdk.live/v2/rooms", {
    method: "POST",
    headers: { authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  return data.roomId as string;
};

/************** Participant **************/
const Participant = ({ participantId, streamId }: { participantId: string; streamId: string }) => {
  const { webcamStream, micStream, webcamOn, micOn, isLocal } = useParticipant(participantId);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const setupStream = useCallback((trackStream: any, ref: any, shouldPlay: boolean) => {
    if (!ref.current) return;
    if (trackStream && shouldPlay) {
      const track = (trackStream as { track: MediaStreamTrack }).track;
      ref.current.srcObject = new MediaStream([track]);
      ref.current.play().catch(console.error);
    } else {
      ref.current.pause();
      ref.current.srcObject = null;
    }
  }, []);

  useEffect(() => setupStream(micStream, audioRef, micOn), [micStream, micOn, setupStream]);
  useEffect(() => setupStream(webcamStream, videoRef, webcamOn), [webcamStream, webcamOn, setupStream]);

  return (
    <div className="min-h-screen w-full">
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded z-[50]">
        <p>Stream ID: {streamId}</p>
        <p>Mic: {micOn ? "ON" : "OFF"}</p>
        <p>Camera: {webcamOn ? "ON" : "OFF"}</p>
      </div>
      <LSControls />
      {micOn && <audio ref={audioRef} autoPlay muted={isLocal} />}
      {webcamOn && <video ref={videoRef} autoPlay muted={isLocal} className="w-full h-screen object-cover" />}
    </div>
  );
};

/************** Stream View **************/
const StreamView = ({ streamId }: { streamId: string }) => {
  const { participants } = useMeeting();
  return (
    <>
      {Array.from(participants.values()).map((p) => (
        <Participant key={p.id} participantId={p.id} streamId={streamId} />
      ))}
    </>
  );
};

/************** LS Controls **************/
const LSControls = () => {
  const { leave, toggleMic, toggleWebcam } = useMeeting();
  const router = useRouter();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
      <button className="bg-blue-600 text-white py-2 px-4 rounded" onClick={async () => { await leave(); router.push("/results"); }}>Leave</button>
      <button className="bg-blue-600 text-white py-2 px-4 rounded" onClick={() => toggleMic()}>Toggle Mic</button>
      <button className="bg-blue-600 text-white py-2 px-4 rounded" onClick={() => toggleWebcam()}>Toggle Cam</button>
    </div>
  );
};

/************** LS Container **************/
const LSContainer = ({ streamId, onLeave }: { streamId: string; onLeave: () => void }) => {
  const [joined, setJoined] = useState(false);
  const { join } = useMeeting({
    onMeetingJoined: () => setJoined(true),
    onMeetingLeft: onLeave,
    onError: (e) => console.error(e),
  });

  return joined ? (
    <StreamView streamId={streamId} />
  ) : (
    <div className="flex items-center justify-center min-h-screen">
      <button className="bg-blue-600 text-white py-2 px-4 rounded" onClick={join}>Start Streaming</button>
    </div>
  );
};

/************** Camera Client (default export) **************/
export default function CameraClient() {
  const [streamId, setStreamId] = useState<string | null>(null);

  const initStream = async () => {
    try {
      const id = await createStream(authToken);
      setStreamId(id);
    } catch (e) {
      console.error("init stream", e);
    }
  };

  // create room once
  useEffect(() => { initStream(); }, []);

  // firestore side-effects
  useEffect(() => {
    if (!streamId) return;
    const ref = doc(db, "sessionIds", streamId);
    setDoc(ref, { createdAt: new Date().toISOString() }).catch(console.error);
    const cleanup = () => deleteDoc(ref).catch(console.error);
    window.addEventListener("beforeunload", cleanup);
    return () => { window.removeEventListener("beforeunload", cleanup); cleanup(); };
  }, [streamId]);

  if (!streamId) {
    return (
      <div className="flex items-center justify-center h-screen">Creating live stream...</div>
    );
  }

  return (
    <MeetingProvider
      config={{ meetingId: streamId, micEnabled: true, webcamEnabled: true, name: "Live Streamer", mode: "SEND_AND_RECV", debugMode: false }}
      token={authToken}
    >
      <LSContainer streamId={streamId} onLeave={() => setStreamId(null)} />
    </MeetingProvider>
  );
}
