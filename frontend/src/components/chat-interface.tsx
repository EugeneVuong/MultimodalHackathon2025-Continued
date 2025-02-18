"use client";
import { useState, useRef, useEffect } from "react";
import { Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryAgent } from "@/lib/agent";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isAI: boolean;
  role: "system" | "user" | "assistant";
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<() => void>();

  useEffect(() => {
    let isMounted = true;

    const initializeChat = async () => {
      const messagesQuery = query(
        collection(db, "messages"),
        orderBy("timestamp", "asc")
      );

      // Check if there are any existing messages
      const querySnapshot = await getDocs(query(messagesQuery, limit(1)));

      if (querySnapshot.empty) {
        await addDoc(collection(db, "messages"), {
          sender: "System",
          content:
            "I'm your AI security assistant. How can I help you monitor the streams?",
          timestamp: serverTimestamp(),
          isAI: true,
          role: "system" as const,
        });
      }

      // Set up real-time listener only if component is still mounted
      if (isMounted) {
        const unsubscribe = onSnapshot(
          messagesQuery,
          (snapshot: QuerySnapshot<DocumentData>) => {
            if (isMounted) {
              const msgs: Message[] = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  sender: data.sender,
                  content: data.content,
                  timestamp:
                    data.timestamp?.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) ||
                    new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  isAI: data.isAI,
                  role: data.role as "system" | "user" | "assistant",
                };
              });
              setMessages(msgs);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
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
      // Save user message to Firestore
      await addDoc(collection(db, "messages"), {
        sender: "You",
        content: input,
        timestamp: serverTimestamp(),
        isAI: false,
        role: "user",
      });

      // Get response from agent
      console.log(input);
      const response = await queryAgent(input);

      // Save AI response to Firestore
      await addDoc(collection(db, "messages"), {
        sender: "AI Assistant",
        content: response,
        timestamp: serverTimestamp(),
        isAI: true,
        role: "assistant",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message to Firestore
      await addDoc(collection(db, "messages"), {
        sender: "System",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: serverTimestamp(),
        isAI: true,
        role: "system",
      });
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
                <div
                  className={`mt-1 rounded-lg px-3 py-2 text-sm ${
                    message.isAI
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                  }`}
                >
                  {message.content}
                </div>
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
