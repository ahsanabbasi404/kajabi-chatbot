"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, Paperclip, X, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "./markdown-renderer"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  files?: File[]
}

interface UploadedFile {
  file: File
  id: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const validFiles = files.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword",
    )

    const newFiles = validFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const sendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: input,
      timestamp: new Date(),
      files: uploadedFiles.map((f) => f.file),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input // Store input before clearing
    setInput("")
    setIsLoading(true)

    // Create assistant message placeholder
    const assistantMessageId = Math.random().toString(36).substring(7)
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const formData = new FormData()
      formData.append("message", currentInput) // Use stored input
      if (threadId) {
        formData.append("threadId", threadId)
      }

      // Add files to form data
      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append(`file_${index}`, uploadedFile.file)
      })

      console.log("Sending request to /api/chat...") // Added logging

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorData
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json()
        } else {
          // Handle non-JSON error responses
          const textResponse = await response.text()
          console.error("Non-JSON error response:", textResponse)
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: textResponse || "No additional details available",
          }
        }

        console.error("API Error Response:", errorData)
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("text/event-stream")) {
        console.error("Expected event stream, got:", contentType)
        const textResponse = await response.text()
        console.error("Response body:", textResponse)
        throw new Error("Expected streaming response but received different content type")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body received")
      }

      let accumulatedContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === "thread_id") {
                setThreadId(data.threadId)
                console.log("Thread ID received:", data.threadId)
              } else if (data.type === "content") {
                accumulatedContent += data.content
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg)),
                )
              } else if (data.type === "error") {
                console.error("Stream error:", data.message)
                throw new Error(data.message)
              }
            } catch (parseError) {
              if (line.trim() && !line.includes("data: ")) {
                console.warn("Failed to parse line:", line, parseError)
              }
            }
          }
        }
      }

      if (!accumulatedContent.trim()) {
        throw new Error("No response received from assistant")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, there was an error: ${errorMessage}. Please check the console for more details and ensure your OpenAI API key and Assistant ID are properly configured.`,
              }
            : msg,
        ),
      )
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Money Mentor Chat</h1>
            <p className="text-sm text-muted-foreground">Financial Freedom Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Hi, I'm your Money Mentor — how can I help you today?</h3>
              <p className="text-muted-foreground">I specialise in budgeting, saving, investing, and growing your wealth.</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === "user" ? "bg-primary text-white !text-white [&_*]:!text-white [&_*]:text-white" : "bg-muted text-foreground",
                )}
              >
                {message.files && message.files.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm opacity-80">
                        <FileText className="w-3 h-3" />
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {message.content ? (
                  <MarkdownRenderer 
                    content={message.content} 
                    className={message.role === "user" ? "!text-white [&_*]:!text-white" : "text-inherit"} 
                    isUserMessage={message.role === "user"}
                  />
                ) : message.role === "assistant" && isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                ) : null}

                <div className="text-xs opacity-60 mt-2">{message.timestamp.toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          {/* File Upload Area */}
          {uploadedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedFiles.map((uploadedFile) => (
                <Badge key={uploadedFile.id} variant="secondary" className="flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs">{uploadedFile.file.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeFile(uploadedFile.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
              <Paperclip className="w-4 h-4" />
            </Button>

            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about money..."
                disabled={isLoading}
                className="pr-12"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                className="absolute right-1 top-1 h-8 w-8"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <p className="text-xs text-muted-foreground mt-2 text-center">
            Upload relevant financial documents (optional) for tailored advice
          </p>
        </div>
      </div>
    </div>
  )
}
