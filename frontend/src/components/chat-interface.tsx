"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isAI: boolean;
  role: "system" | "user" | "assistant";
  frames?: string[];
}

// Optimized Frame-by-Frame Video Player Component
function VideoPlayer({ frames }: { frames: string[] }) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30); // Default to 30fps
  const [quality, setQuality] = useState<'high'|'medium'|'low'>('medium');
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImages = useRef<Map<number, HTMLImageElement>>(new Map());
  const preloadedIndexes = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef<boolean>(false);

  // Function to draw a frame on the canvas (defined first to avoid circular references)
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || index >= frames.length) return;

    const img = frameImages.current.get(index);
    if (img) {
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply quality settings
      if (quality === 'low') {
        // Low quality - faster rendering
        context.imageSmoothingEnabled = false;
        // Resize canvas for lower quality
        const scaleFactor = 0.5;
        const originalWidth = canvas.width;
        const originalHeight = canvas.height;
        canvas.width = originalWidth * scaleFactor;
        canvas.height = originalHeight * scaleFactor;
        // Draw at lower resolution
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Restore dimensions
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        // Draw scaled version
        context.drawImage(canvas, 0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor,
                              0, 0, canvas.width, canvas.height);
      } else {
        // Medium or high quality
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = quality === 'high' ? 'high' : 'medium';
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [quality, frames.length]);

  // Preload a frame and optionally set canvas dimensions
  const preloadFrame = useCallback((index: number, setDimensions = false) => {
    if (index >= frames.length || preloadedIndexes.current.has(index)) return;

    const img = document.createElement('img');
    img.onload = () => {
      preloadedIndexes.current.add(index);
      frameImages.current.set(index, img);

      // If this is the first frame, set canvas dimensions
      if (setDimensions && canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        initialLoadRef.current = true;
        drawFrame(index);
      }

      // Preload the next frame in sequence
      if (index < frames.length - 1) {
        const nextIndex = index + 1;
        // Only preload if not already loading
        if (!preloadedIndexes.current.has(nextIndex)) {
          preloadFrame(nextIndex);
        }
      }
    };
    img.src = `data:image/jpeg;base64,${frames[index]}`;
  }, [frames, drawFrame]);
  


  // Animation loop using requestAnimationFrame for smoother playback
  const animate = useCallback((timestamp: number) => {
    if (!isPlaying) return;

    const frameInterval = 1000 / fps; // milliseconds per frame
    const elapsedTime = timestamp - lastFrameTimeRef.current;

    if (elapsedTime >= frameInterval) {
      // Update timing
      lastFrameTimeRef.current = timestamp - (elapsedTime % frameInterval);
      
      // Update frame index
      setCurrentFrameIndex(prevIndex => {
        const nextIndex = prevIndex >= frames.length - 1 ? 0 : prevIndex + 1;
        // Preload a few frames ahead
        const preloadIndex = (nextIndex + 5) % frames.length;
        if (!preloadedIndexes.current.has(preloadIndex)) {
          preloadFrame(preloadIndex);
        }
        // Draw the current frame
        drawFrame(nextIndex);
        return nextIndex;
      });
    }

    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, fps, frames.length, drawFrame, preloadFrame]);

  // Preload images for smoother playback
  useEffect(() => {
    // Preload the first few frames immediately
    const preloadCount = Math.min(10, frames.length);
    for (let i = 0; i < preloadCount; i++) {
      preloadFrame(i);
    }

    // Setup canvas dimensions on first frame load
    if (frames.length > 0 && !preloadedIndexes.current.has(0)) {
      preloadFrame(0, true);
    }

    // Save current refs for cleanup
    const currentFrameImages = frameImages.current;
    const currentPreloadedIndexes = preloadedIndexes.current;

    return () => {
      // Clean up images to prevent memory leaks
      currentFrameImages.clear();
      currentPreloadedIndexes.clear();
    };
  }, [frames, preloadFrame]);





  // Handle play/pause
  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, fps, frames.length, quality, animate]);

  const togglePlay = () => {
    setIsPlaying(prevState => !prevState);
  };

  const restart = () => {
    setCurrentFrameIndex(0);
    drawFrame(0);
    setIsPlaying(true);
  };

  const handleFpsChange = (newFps: number) => {
    setFps(newFps);
  };

  const handleQualityChange = (newQuality: 'high' | 'medium' | 'low') => {
    setQuality(newQuality);
    // Redraw current frame with new quality
    drawFrame(currentFrameIndex);
  };

  return (
    <div className="mt-2 bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg">
      <div className="flex flex-col">
        <div 
          className="relative rounded-md overflow-hidden w-full aspect-video max-w-2xl mx-auto"
        >
          {frames.length > 0 && (
            <canvas 
              ref={canvasRef} 
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${(currentFrameIndex / (frames.length - 1)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex ml-4 gap-2">
            <Button variant="outline" size="sm" onClick={togglePlay}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw size={16} className="mr-1" />
              Restart
            </Button>
          </div>
        </div>
        
        {/* Performance controls */}
        <div className="flex justify-between mt-2 text-xs border-t pt-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <span className="mr-2">FPS:</span>
            <select 
              value={fps} 
              onChange={(e) => handleFpsChange(Number(e.target.value))} 
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
            >
              <option value={15}>15</option>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div className="flex items-center">
            <span className="mr-2">Quality:</span>
            <select 
              value={quality} 
              onChange={(e) => handleQualityChange(e.target.value as 'high' | 'medium' | 'low')} 
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low (Fast)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize chat with a welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome-message",
        sender: "System",
        content: "I'm your AI security assistant. How can I help you monitor the streams?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isAI: true,
        role: "system",
      },
    ]);
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // Add user message to state
      const userMessage: Message = {
        id: Date.now().toString(),
        sender: "You",
        content: input,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isAI: false,
        role: "user",
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Replace with direct fetch to your API
      const response = await fetch("http://localhost:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }

      const data = await response.json();
      const firstResult = data.results?.[0];

      const caption = firstResult?.caption || "No results found.";
      const frames: string[] = firstResult?.frames || [];

      // Add AI response to state
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "AI Assistant",
        content: caption,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isAI: true,
        role: "assistant",
        frames: frames,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message to state
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        sender: "System",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isAI: true,
        role: "system",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea 
        className="flex-1 p-4" 
        ref={scrollAreaRef}
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        <div className="pr-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 mb-4 ${
                message.isAI ? "flex-row" : "flex-row-reverse"
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={message.isAI ? "/placeholder.svg?height=32&width=32" : ""}
                />
                <AvatarFallback>
                  {message.isAI ? "AI" : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div
                className={`flex flex-col ${
                  message.isAI ? "items-start" : "items-end"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.sender}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {message.timestamp}
                  </span>
                </div>
                {/* Show video if frames are available */}
                {message.frames && message.frames.length > 0 ? (
                  <>
                    <VideoPlayer frames={message.frames} />
                    {/* Display the video description with a heading */}
                    <div
                      className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.isAI ? "bg-neutral-100 dark:bg-neutral-800" : "bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"}`}
                    >
                      <p className="font-semibold mb-1">Video Description:</p>
                      <p>{message.content}</p>
                    </div>
                  </>
                ) : (
                  /* Show regular message content if no frames */
                  <div
                    className={`mt-1 rounded-lg px-3 py-2 text-sm ${message.isAI ? "bg-neutral-100 dark:bg-neutral-800" : "bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"}`}
                  >
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
