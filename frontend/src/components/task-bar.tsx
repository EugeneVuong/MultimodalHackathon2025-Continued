"use client"

import { useState } from "react"
import { MessageSquare, Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChatInterface } from "./chat-interface"
import { cn } from "@/lib/utils"

interface TaskBarProps {
  alerts: Array<{ id: number; message: string; time: string }>
}

export function TaskBar({ alerts }: TaskBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"chat" | "alerts">("chat")

  return (
    <>
      {/* Task Bar Button */}
      <div className="fixed bottom-6 right-6 flex gap-2">
        <Button
          variant="default"
          size="icon"
          onClick={() => {
            setIsOpen(true)
            setActiveTab("chat")
          }}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={() => {
            setIsOpen(true)
            setActiveTab("alerts")
          }}
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>

      {/* Task Bar Panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 w-96 h-[600px] transition-all duration-200 ease-in-out",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none",
        )}
      >
        <Card className="h-full">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex gap-4">
              <Button
                variant={activeTab === "chat" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("chat")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </Button>
              <Button
                variant={activeTab === "alerts" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("alerts")}
              >
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {activeTab === "chat" ? (
            <ChatInterface />
          ) : (
            <div className="p-4">
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border-b pb-4 last:border-0">
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">{alert.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

