const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function sendTrackToBackend(
  track: MediaStreamTrack,
  sessionId: string
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
  pc.addTrack(track);

  // Create offer and set local description
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering to complete
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      return resolve();
    }
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", checkState);
  });

  // Send SDP offer to backend
  const response = await fetch(
    `${backendUrl}/webrtc/offer/${sessionId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify(pc.localDescription),
    }
  );

  if (!response.ok) {
    throw new Error(`WebRTC negotiation failed: ${response.statusText}`);
  }

  const answer = await response.json();
  await pc.setRemoteDescription(answer);

  return pc;
}
