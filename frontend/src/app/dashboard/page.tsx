"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Bell,
  Camera,
  AlertCircle,
  MessageSquare,
  Grid,
  Wifi,
  WifiOff,
  Plus,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/chat-interface";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
  Constants,
} from "@videosdk.live/react-sdk";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

interface Stream {
  id: string;
  name: string;
  thumbnail?: string;
}

const authToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiIzNjE1MTIzNi0zZDRjLTQwZGQtYjYzYy04MjJmN2JlNjE4MTQiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIl0sImlhdCI6MTczOTY4Mzg2NywiZXhwIjoxODk3NDcxODY3fQ.iuMlIS-8c7eoh_0ZrtT50d-gSPg3AaZKSjOUa1I5wFY";

const formatMeetingId = (id: string) => {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, "");
};

// Add this validation function near the top of the file, after the interfaces
const validateStreamId = (id: string): boolean => {
  // Format: xxxx-xxxx-xxxx where x can be alphanumeric
  const streamIdRegex = /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/;
  return streamIdRegex.test(id);
};

// Helper functions inserted here
function LSContainer({
  streamId,
  onLeave,
  onSnapshot,
  streamName,
}: {
  streamId: string;
  onLeave: () => void;
  onSnapshot: (streamId: string, dataUrl: string) => void;
  streamName: string;
}) {
  const [isConnecting, setIsConnecting] = useState(true);
  const { join, meeting } = useMeeting({
    onMeetingJoined: () => {
      console.log("Joined meeting:", streamId);
      setIsConnecting(false);
    },
    onMeetingLeft: onLeave,
    onError: (error) => {
      console.error("Meeting error:", error);
      setIsConnecting(false);
    },
  });

  useEffect(() => {
    if (!meeting) {
      join();
    }
  }, [join, meeting]);

  return (
    <>
      {isConnecting && (
        <div className="absolute inset-0 z-10 bg-neutral-100 dark:bg-neutral-800 animate-pulse">
          <div className="h-full w-full flex flex-col items-center justify-center">
            <div className="space-y-4 w-full max-w-[240px]">
              <Skeleton className="h-4 w-full bg-neutral-200 dark:bg-neutral-700" />
              <Skeleton className="h-4 w-3/4 mx-auto bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex justify-center">
                <Skeleton className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              </div>
              <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                Connecting to stream...
              </p>
            </div>
          </div>
        </div>
      )}
      {meeting && (
        <StreamView 
          streamId={streamId} 
          onSnapshot={onSnapshot} 
          streamName={streamName} 
        />
      )}
    </>
  );
}

function Participant({
  participantId,
  streamId,
  onSnapshot,
  displayNameProp,
}: {
  participantId: string;
  streamId: string;
  onSnapshot: (streamId: string, dataUrl: string) => void;
  displayNameProp: string;
}) {
  const { webcamStream, micStream, webcamOn, micOn, displayName } =
    useParticipant(participantId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream && webcamOn) {
      videoRef.current.srcObject = new MediaStream([webcamStream.track]);
      videoRef.current.play().catch(console.error);
      const snapshotTimer = setTimeout(() => {
        captureSnapshot();
      }, 2000);
      return () => clearTimeout(snapshotTimer);
    }
  }, [webcamStream, webcamOn]);

  useEffect(() => {
    if (audioRef.current && micStream && micOn) {
      audioRef.current.srcObject = new MediaStream([micStream.track]);
      audioRef.current.play().catch(console.error);
    }
  }, [micStream, micOn]);

  const captureSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      onSnapshot(streamId, canvas.toDataURL("image/jpeg", 0.8));
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
      <audio ref={audioRef} autoPlay />
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          data-participant={participantId}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-neutral-500">Camera Off</p>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white">
        <p className="text-sm">
          {displayNameProp} {micOn && "🎤"}
        </p>
      </div>
    </div>
  );
}

function StreamView({
  streamId,
  onSnapshot,
  streamName,
}: {
  streamId: string;
  onSnapshot: (streamId: string, dataUrl: string) => void;
  streamName: string;
}) {
  const { participants } = useMeeting();
  const participantArray = Array.from(participants.values());
  const snapshotInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    snapshotInterval.current = setInterval(() => {
      const firstParticipant = participantArray[0];
      if (firstParticipant) {
        const videoElement = document.querySelector<HTMLVideoElement>(
          `video[data-participant="${firstParticipant.id}"]`
        );
        if (videoElement) {
          const canvas = document.createElement("canvas");
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          canvas.getContext("2d")?.drawImage(videoElement, 0, 0);
          onSnapshot(streamId, canvas.toDataURL("image/jpeg", 0.8));
        }
      }
    }, 10000);
    return () => {
      if (snapshotInterval.current) {
        clearInterval(snapshotInterval.current);
      }
    };
  }, [participantArray, onSnapshot, streamId]);

  if (participantArray.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
        <div className="text-neutral-500 text-center p-4">
          <p>Waiting for stream to start...</p>
          <p className="text-sm mt-2">No active participants in the stream</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 gap-4 p-4">
      {participantArray
        .filter((p) => p.mode === Constants.modes.SEND_AND_RECV)
        .map((p) => (
          <Participant
            key={p.id}
            participantId={p.id}
            streamId={streamId}
            onSnapshot={onSnapshot}
            displayNameProp={streamName}
          />
        ))}
    </div>
  );
}

// End of helper functions block

// Add this style tag near the top of your component, after the imports
const styles = (
  <style jsx global>{`
    @keyframes shrink {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }
  `}</style>
);

export default function SecurityDashboard() {
  const [selectedStreams, setSelectedStreams] = useState<Stream[]>([]);
  const [streamInput, setStreamInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [availableStreams, setAvailableStreams] = useState<Stream[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStreams, setIsLoadingStreams] = useState(true);
  const [editingName, setEditingName] = useState<{id: string, name: string} | null>(null);

  const [alerts, setAlerts] = useState([
    { id: 1, message: "Movement detected in Zone A", time: "2 mins ago" },
    { id: 2, message: "Person jumping in Zone B", time: "5 mins ago" },
  ]);

  // NEW STATE FOR ACTIONS
  const [actionInput, setActionInput] = useState("");
  const [actions, setActions] = useState<{ id: string; description: string }[]>(
    []
  );

  // Add an action and store it in Firestore ("aiAlert" collection)
  const addAction = async () => {
    if (!actionInput.trim()) return;
    const newAction = {
      id: Date.now().toString(),
      description: actionInput.trim(),
    };
    try {
      await setDoc(doc(db, "aiAlert", newAction.id), newAction);
      setActions((prev) => [...prev, newAction]);
      setActionInput("");
    } catch (error) {
      console.error("Error adding action to Firestore:", error);
    }
  };

  // Remove an action and delete the document from Firestore
  const removeAction = async (id: string) => {
    try {
      await deleteDoc(doc(db, "aiAlert", id));
      setActions((prev) => prev.filter((action) => action.id !== id));
    } catch (error) {
      console.error("Error removing action from Firestore:", error);
    }
  };

  // Add state for alerts
  const [validationAlert, setValidationAlert] = useState<{
    title: string;
    description: string;
  } | null>(null);

  // Add this near your other state declarations in SecurityDashboard
  const [alertTimeout, setAlertTimeout] = useState<NodeJS.Timeout | null>(null);

  // Add this useEffect to handle alert timeouts
  useEffect(() => {
    if (validationAlert) {
      // Clear any existing timeout
      if (alertTimeout) {
        clearTimeout(alertTimeout);
      }
      
      // Set new timeout to clear alert after 5 seconds
      const timeout = setTimeout(() => {
        setValidationAlert(null);
      }, 5000);
      
      setAlertTimeout(timeout);
    }
    
    return () => {
      if (alertTimeout) {
        clearTimeout(alertTimeout);
      }
    };
  }, [validationAlert]);

  const connectToStream = () => {
    if (!streamInput.trim()) {
      setValidationAlert({
        title: "Invalid Input",
        description: "Please enter a stream ID"
      });
      return;
    }

    // Validate stream ID format
    if (!validateStreamId(streamInput)) {
      setValidationAlert({
        title: "Invalid Format",
        description: "Stream ID must be in the format: xxxx-xxxx-xxxx (e.g., tb5x-7zqt-nnbr)"
      });
      return;
    }

    const formattedId = formatMeetingId(streamInput);

    if (selectedStreams.some((s) => s.id === formattedId)) {
      setValidationAlert({
        title: "Already Connected",
        description: "This stream is already connected"
      });
      return;
    }

    const existingStream = availableStreams.find((s) => s.id === formattedId);
    const stream = existingStream || {
      id: formattedId,
      name: `Stream ${formattedId}`,
    };

    setSelectedStreams((prev) => [...prev, stream]);
    
    if (!existingStream) {
      setAvailableStreams((prev) => [...prev, stream]);
    }

    // Clear any existing alert
    setValidationAlert(null);
  };

  const disconnectStream = (streamId: string) => {
    setSelectedStreams((prev) => prev.filter((s) => s.id !== streamId));
    setValidationAlert(null); // Clear any existing alert when disconnecting
  };

  const addNewStream = () => {
    const newStreamId = `stream${availableStreams.length + 1}`;
    const newStream: Stream = {
      id: newStreamId,
      name: `New Stream ${availableStreams.length + 1}`,
    };
    setAvailableStreams((prev) => [...prev, newStream]);
  };

  const onStreamLeave = () => {
    setIsConnected(false);
    setSelectedStreams([]);
  };

  const updateThumbnail = (streamId: string, dataUrl: string) => {
    setAvailableStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId ? { ...stream, thumbnail: dataUrl } : stream
      )
    );
  };

  const removeAlert = (alertId: number) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const updateStreamName = (streamId: string, newName: string) => {
    if (!newName.trim()) {
      setValidationAlert({
        title: "Invalid Name",
        description: "Stream name cannot be empty"
      });
      return;
    }
    
    setAvailableStreams(prev => 
      prev.map(stream => 
        stream.id === streamId ? { ...stream, name: newName.trim() } : stream
      )
    );
    
    setSelectedStreams(prev =>
      prev.map(stream =>
        stream.id === streamId ? { ...stream, name: newName.trim() } : stream
      )
    );
    
    setEditingName(null);
    setValidationAlert(null); // Clear any existing alert
  };

  useEffect(() => {
    // Simulate loading time - remove this in production and replace with actual data fetching
    const timer = setTimeout(() => {
      setIsLoadingStreams(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {styles}
    <div className="flex h-screen bg-white dark:bg-neutral-950">
      {/* Main Content */}
      <div className="flex flex-col flex-1 p-6 gap-6">
        {/* Stream Connection */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Input
                  placeholder="Enter stream ID (e.g., tb5x-7zqt-nnbr)"
                value={streamInput}
                onChange={(e) => setStreamInput(e.target.value)}
                className="flex-1"
                  pattern="[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}"
              />
              <Button onClick={connectToStream}>Connect</Button>
                <Badge
                  variant={selectedStreams.length > 0 ? "default" : "secondary"}
                  className="gap-1"
                >
                {selectedStreams.length > 0 ? (
                    <>{selectedStreams.length} streams connected</>
                ) : (
                    <>No streams connected</>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

          {/* Validation Alert */}
          {validationAlert && (
            <Alert variant="destructive" className="mb-2 relative overflow-hidden">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{validationAlert.title}</AlertTitle>
              <AlertDescription>
                {validationAlert.description}
              </AlertDescription>
              {/* Progress bar */}
              <div 
                className="absolute bottom-0 left-0 h-1 bg-white/20 w-full"
              >
                <div 
                  className="h-full bg-white/40 transition-all duration-[5000ms] ease-linear"
                  style={{ 
                    width: '100%',
                    animation: 'shrink 5s linear forwards'
                  }}
                />
              </div>
            </Alert>
          )}

        {/* Primary Camera View */}
        <Card className="flex-1">
          <CardHeader className="bg-red-500 text-neutral-50 dark:bg-red-900 dark:text-neutral-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Active Streams ({selectedStreams.length})
              </CardTitle>
              <Badge variant="secondary">Live</Badge>
            </div>
          </CardHeader>
            <CardContent className="p-4 h-[calc(100%-4rem)] overflow-hidden">
            {selectedStreams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto">
                  {selectedStreams.map((stream) => (
                    <Card key={stream.id} className="relative h-[300px] min-h-[300px]">
                    <MeetingProvider
                      config={{
                        meetingId: stream.id,
                        micEnabled: false,
                        webcamEnabled: false,
                        name: `${stream.name} Viewer`,
                          mode: Constants.modes.RECV_ONLY as "RECV_ONLY",
                        debugMode: true,
                      }}
                      token={authToken}
                    >
                        <div className="relative h-full">
                      <LSContainer 
                        streamId={stream.id} 
                        onLeave={() => disconnectStream(stream.id)}
                        onSnapshot={updateThumbnail}
                            streamName={stream.name}
                      />
                        </div>
                    </MeetingProvider>
                    <Button
                      variant="destructive"
                      size="sm"
                        className="absolute top-2 right-2 z-20"
                      onClick={() => disconnectStream(stream.id)}
                    >
                      Disconnect
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
                <div className="h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <div className="text-center text-neutral-500 dark:text-neutral-400">
                    <p className="mb-2">No active streams</p>
                    <p className="text-sm">Connect to a stream to start viewing</p>
                  </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Action Input */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                <Input
                  placeholder="What should I look at? (e.g. 'Alert me if someone jumps')"
                  className="pl-10 mb-2"
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && actionInput.trim() !== '') { e.preventDefault(); addAction(); } }}
                />
              </div>
              <div className="flex flex-cols-6 gap-2 justify-items-center">
                <Button size="sm" onClick={addAction} className="mb-2">
                  Add Action
                </Button>
                {actions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">Actions ({actions.length})</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {actions.map((action) => (
                      <DropdownMenuItem key={action.id} onSelect={() => removeAction(action.id)}>
                        <span>{action.description}</span>
                        <Trash2 className="ml-auto h-4 w-4 text-red-500" />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <Card className="w-96 border-l rounded-none">
        <Tabs defaultValue="monitoring" className="h-full flex flex-col">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="monitoring">
                <Grid className="h-4 w-4 mr-2" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <TabsContent value="monitoring" className="h-full">
              <div className="p-4">
                <h3 className="font-semibold mb-4">Available Streams</h3>
                <div className="grid grid-cols-2 gap-2">
                    {isLoadingStreams ? (
                      // Loading placeholders
                      <>
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={`loading-${n}`}
                            className="relative aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden"
                          >
                            <div className="absolute inset-0 animate-pulse">
                              <div className="h-full w-full bg-neutral-200 dark:bg-neutral-700" />
                              <div className="absolute bottom-2 left-2 h-4 w-24 bg-neutral-300 dark:bg-neutral-600 rounded" />
                            </div>
                          </div>
                        ))}
                      </>
                    ) : availableStreams.length > 0 ? (
                      availableStreams.map((stream) => (
                        <div key={stream.id} className="relative">
                    <button
                      onClick={() => {
                          if (selectedStreams.some((s) => s.id === stream.id)) {
                            setValidationAlert({
                              title: "Already Connected",
                              description: "This stream is already connected"
                            });
                            return;
                          }
                          setSelectedStreams((prev) => [...prev, stream]);
                          setStreamInput(stream.id);
                          setValidationAlert(null);
                        }}
                        className={`relative aspect-video w-full bg-muted rounded-lg overflow-hidden hover:ring-2 hover:ring-ring ${
                          selectedStreams.some((s) => s.id === stream.id)
                            ? "ring-2 ring-neutral-900 dark:ring-neutral-50"
                            : ""
                        }`}
                      >
                        {stream.thumbnail ? (
                          <Image
                            src={stream.thumbnail}
                        alt={`${stream.name} Thumbnail`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 animate-pulse">
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="text-center space-y-2">
                                <Skeleton className="h-4 w-24 mx-auto bg-neutral-200 dark:bg-neutral-700" />
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading snapshot...</p>
                              </div>
                            </div>
                          </div>
                        )}
                      <span className="absolute bottom-2 left-2 text-xs bg-white/80 px-2 py-1 rounded dark:bg-neutral-950/80">
                        {stream.name}
                      </span>
                    </button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white/90 dark:bg-neutral-950/80 dark:hover:bg-neutral-950/90"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 bg-neutral-900/95 text-white border-neutral-800 backdrop-blur-sm" side="right">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  {editingName?.id === stream.id ? (
                                    <div className="flex-1 flex gap-2">
                                      <Input
                                        value={editingName.name}
                                        onChange={(e) => setEditingName({ id: stream.id, name: e.target.value })}
                                        className="flex-1 h-8 bg-neutral-800 border-neutral-700 text-white"
                                        placeholder="Enter stream name"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            updateStreamName(stream.id, editingName.name);
                                          } else if (e.key === 'Escape') {
                                            setEditingName(null);
                                          }
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => updateStreamName(stream.id, editingName.name)}
                                        className="h-8 px-2 bg-neutral-800 hover:bg-neutral-700"
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="font-medium text-white">{stream.name}</h4>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingName({ id: stream.id, name: stream.name })}
                                        className="h-8 px-2 text-neutral-400 hover:text-white"
                                      >
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                </div>
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-neutral-400">Stream ID:</span>
                                    <span className="font-mono text-neutral-200">{stream.id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-400">Status:</span>
                                    <span className="text-emerald-400">Active</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-400">Connected:</span>
                                    <span className="text-neutral-200">{selectedStreams.some((s) => s.id === stream.id) ? "Yes" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-400">Resolution:</span>
                                    <span className="text-neutral-200">1920x1080</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-400">FPS:</span>
                                    <span className="text-neutral-200">30</span>
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-neutral-500 dark:text-neutral-400">
                        No available streams found
                      </div>
                    )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="chat" className="h-full border-0 m-0 p-0">
              <ChatInterface />
            </TabsContent>
            <TabsContent value="alerts" className="h-full">
              <div className="p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-900" />
                  Recent Alerts
                </h3>
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="mb-4 pb-4 border-b last:border-b-0"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                      <div className="font-medium">{alert.message}</div>
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">
                              {alert.time}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAlert(alert.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
    </>
  );
}
