// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";

// import {
//   MeetingProvider,
//   useMeeting,
//   useParticipant,
// } from "@videosdk.live/react-sdk";

// const authToken =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiIzNjE1MTIzNi0zZDRjLTQwZGQtYjYzYy04MjJmN2JlNjE4MTQiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIl0sImlhdCI6MTczOTY4Mzg2NywiZXhwIjoxODk3NDcxODY3fQ.iuMlIS-8c7eoh_0ZrtT50d-gSPg3AaZKSjOUa1I5wFY";

// // Creating the Stream
// const createStream = async ({ token }) => {
//   try {
//     const res = await fetch("https://api.videosdk.live/v2/rooms", {
//       method: "POST",
//       headers: {
//         authorization: `${token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({}),
//     });
//     const data = await res.json();
//     return data.roomId;
//   } catch (error) {
//     console.error("Failed to create stream:", error);
//     throw error;
//   }
// };

// function StreamView({ streamId }) {
//   const { participants } = useMeeting();

//   return (
//     <div>
//       {[...participants.values()].map((p) => (
//         <Participant participantId={p.id} key={p.id} streamId={streamId} />
//       ))}
//     </div>
//   );
// }

// function Participant({ participantId, streamId }) {
//   const { webcamStream, micStream, webcamOn, micOn, isLocal } =
//     useParticipant(participantId);

//   const audioRef = useRef(null);
//   const videoRef = useRef(null);

//   // Setup stream for audio/video elements
//   const setupStream = (stream, ref, condition) => {
//     if (ref.current && stream) {
//       ref.current.srcObject = condition
//         ? new MediaStream([stream.track])
//         : null;
//       condition && ref.current.play().catch(console.error);
//     }
//   };

//   // Update mic stream when mic is on/off
//   useEffect(() => setupStream(micStream, audioRef, micOn), [micStream, micOn]);
//   // Update webcam stream when webcam is on/off
//   useEffect(
//     () => setupStream(webcamStream, videoRef, webcamOn),
//     [webcamStream, webcamOn]
//   );

//   return (
//     <div className="min-h-screen w-full">
//       <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded z-[50]">
//         <p>Stream ID: {streamId}</p>
//         <p>Mic: {micOn ? "ON" : "OFF"}</p>
//         <p>Camera: {webcamOn ? "ON" : "OFF"}</p>
//       </div>
//       <LSControls />
//       {micOn && <audio ref={audioRef} autoPlay muted={isLocal} />}
//       {webcamOn && (
//         <video
//           ref={videoRef}
//           autoPlay
//           muted={isLocal}
//           className="w-full h-screen object-cover"
//         />
//       )}
//     </div>
//   );
// }

// function LSControls() {
//   const { leave, toggleMic, toggleWebcam } = useMeeting();
//   const router = useRouter();

//   const handleToggleWebcam = async () => {
//     try {
//       await toggleWebcam();
//     } catch (error) {
//       console.error("Error toggling webcam:", error);
//     }
//   };

//   const handleLeave = async () => {
//     try {
//       await leave();
//       await router.push("/results");
//     } catch (error) {
//       console.error("Error toggling mic:", error);
//     }
//   };

//   const handleToggleMic = async () => {
//     try {
//       await toggleMic();
//     } catch (error) {
//       console.error("Error toggling mic:", error);
//     }
//   };

//   return (
//     <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-[10px] z-10">
//       <button
//         className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
//         onClick={handleLeave}
//       >
//         Leave
//       </button>
//       <button
//         className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
//         onClick={handleToggleMic}
//       >
//         Toggle Mic
//       </button>
//       <button
//         className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
//         onClick={handleToggleWebcam}
//       >
//         Toggle Camera
//       </button>
//     </div>
//   );
// }

// function LSContainer({ streamId, onLeave }) {
//   const [joined, setJoined] = useState(false);

//   const { join } = useMeeting({
//     onMeetingJoined: () => setJoined(true),
//     onMeetingLeft: onLeave,
//     onError: (error) => alert(error.message),
//   });

//   return (
//     <div className="">
//       {joined ? (
//         <StreamView streamId={streamId} />
//       ) : (
//         <div className="flex items-center justify-center min-h-screen">
//           <button
//             className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
//             onClick={join}
//           >
//             Start Streaming
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// export default function LiveStreamer() {
//   const [streamId, setStreamId] = useState(null);

//   const initializeStream = async () => {
//     try {
//       const newStreamId = await createStream({ token: authToken });
//       setStreamId(newStreamId);
//     } catch (error) {
//       console.error("Error initializing stream:", error);
//     }
//   };

//   // Automatically initialize the stream when the component mounts
//   useEffect(() => {
//     initializeStream();
//   }, []);

//   const onStreamLeave = () => setStreamId(null);

//   // Display a loader until the stream is created
//   if (!streamId) {
//     return (
//       <div className="flex flex-col items-center justify-center text-center h-screen gap-5 p-5rounded-lg shadow">
//         <p>Creating live stream...</p>
//       </div>
//     );
//   }

//   return (
//     <MeetingProvider
//       config={{
//         meetingId: streamId,
//         micEnabled: true,
//         webcamEnabled: true,
//         name: "Live Streamer",
//         mode: "SEND_AND_RECV",
//         debugMode: false,
//       }}
//       token={authToken}
//     >
//       <LSContainer streamId={streamId} onLeave={onStreamLeave} />
//     </MeetingProvider>
//   );
// }

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
} from "@videosdk.live/react-sdk";

// Import Firebase functions and the Firestore db instance
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig"; // Adjust the import path as needed

const authToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiIzNjE1MTIzNi0zZDRjLTQwZGQtYjYzYy04MjJmN2JlNjE4MTQiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIl0sImlhdCI6MTczOTY4Mzg2NywiZXhwIjoxODk3NDcxODY3fQ.iuMlIS-8c7eoh_0ZrtT50d-gSPg3AaZKSjOUa1I5wFY";

// Creating the Stream
const createStream = async ({ token }) => {
  try {
    const res = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        authorization: `${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return data.roomId;
  } catch (error) {
    console.error("Failed to create stream:", error);
    throw error;
  }
};

function StreamView({ streamId }) {
  const { participants } = useMeeting();

  return (
    <div>
      {[...participants.values()].map((p) => (
        <Participant participantId={p.id} key={p.id} streamId={streamId} />
      ))}
    </div>
  );
}

function Participant({ participantId, streamId }) {
  const { webcamStream, micStream, webcamOn, micOn, isLocal } =
    useParticipant(participantId);

  const audioRef = React.useRef(null);
  const videoRef = React.useRef(null);

  // Setup stream for audio/video elements
  const setupStream = (stream, ref, condition) => {
    if (ref.current && stream) {
      ref.current.srcObject = condition
        ? new MediaStream([stream.track])
        : null;
      condition && ref.current.play().catch(console.error);
    }
  };

  // Update mic stream when mic is on/off
  useEffect(() => setupStream(micStream, audioRef, micOn), [micStream, micOn]);
  // Update webcam stream when webcam is on/off
  useEffect(
    () => setupStream(webcamStream, videoRef, webcamOn),
    [webcamStream, webcamOn]
  );

  return (
    <div className="min-h-screen w-full">
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded z-[50]">
        <p>Stream ID: {streamId}</p>
        <p>Mic: {micOn ? "ON" : "OFF"}</p>
        <p>Camera: {webcamOn ? "ON" : "OFF"}</p>
      </div>
      <LSControls />
      {micOn && <audio ref={audioRef} autoPlay muted={isLocal} />}
      {webcamOn && (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          className="w-full h-screen object-cover"
        />
      )}
    </div>
  );
}

function LSControls() {
  const { leave, toggleMic, toggleWebcam } = useMeeting();
  const router = useRouter();

  // When the user clicks "Leave", we want to remove the firebase document.
  const handleLeave = async () => {
    try {
      await leave();
      // Delete the document from Firestore
      // (Since we’re using the cleanup in LiveStreamer, this may also be called there)
      // You could alternatively call deleteDoc() here if you pass streamId via context or props.
      await router.push("/results");
    } catch (error) {
      console.error("Error leaving stream:", error);
    }
  };

  const handleToggleMic = async () => {
    try {
      await toggleMic();
    } catch (error) {
      console.error("Error toggling mic:", error);
    }
  };

  const handleToggleWebcam = async () => {
    try {
      await toggleWebcam();
    } catch (error) {
      console.error("Error toggling webcam:", error);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-[10px] z-10">
      <button
        className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
        onClick={handleLeave}
      >
        Leave
      </button>
      <button
        className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
        onClick={handleToggleMic}
      >
        Toggle Mic
      </button>
      <button
        className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
        onClick={handleToggleWebcam}
      >
        Toggle Camera
      </button>
    </div>
  );
}

function LSContainer({ streamId, onLeave }) {
  const [joined, setJoined] = useState(false);

  const { join } = useMeeting({
    onMeetingJoined: () => setJoined(true),
    onMeetingLeft: onLeave,
    onError: (error) => alert(error.message),
  });

  return joined ? (
    <StreamView streamId={streamId} />
  ) : (
    <div className="flex items-center justify-center min-h-screen">
      <button
        className="bg-[#007bff] text-white py-2.5 px-4 rounded-md cursor-pointer transition duration-300 hover:bg-[#0056b3]"
        onClick={join}
      >
        Start Streaming
      </button>
    </div>
  );
}

export default function LiveStreamer() {
  const [streamId, setStreamId] = useState(null);

  // Create the stream and update streamId
  const initializeStream = async () => {
    try {
      const newStreamId = await createStream({ token: authToken });
      setStreamId(newStreamId);
    } catch (error) {
      console.error("Error initializing stream:", error);
    }
  };

  useEffect(() => {
    initializeStream();
  }, []);

  // When streamId is available, create a Firestore document and setup cleanup.
  useEffect(() => {
    if (!streamId) return;

    // Create a document in the "sessionIds" collection with the streamId as the document ID.
    const sessionDocRef = doc(db, "sessionIds", streamId);
    setDoc(sessionDocRef, {
      createdAt: new Date().toISOString(),
      // You can add any other metadata you need here.
    })
      .then(() => console.log("Session document created"))
      .catch((error) =>
        console.error("Error creating session document:", error)
      );

    // Define a cleanup function that deletes the document.
    const cleanup = () => {
      deleteDoc(sessionDocRef)
        .then(() => console.log("Session document deleted"))
        .catch((error) =>
          console.error("Error deleting session document:", error)
        );
    };

    // Listen for when the user closes the tab or browser.
    window.addEventListener("beforeunload", cleanup);

    // Cleanup when the component unmounts (or if streamId changes)
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [streamId]);

  const onStreamLeave = () => setStreamId(null);

  // Display a loader until the stream is created
  if (!streamId) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-screen gap-5 p-5 rounded-lg shadow">
        <p>Creating live stream...</p>
      </div>
    );
  }
  

  
  return (
    <MeetingProvider
      config={{
        meetingId: streamId,
        micEnabled: true,
        webcamEnabled: true,
        name: "Live Streamer",
        mode: "SEND_AND_RECV",
        debugMode: false,
      }}
      token={authToken}
    >
      <LSContainer streamId={streamId} onLeave={onStreamLeave} />
    </MeetingProvider>
  );
}
