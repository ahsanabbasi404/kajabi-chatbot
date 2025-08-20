import { type NextRequest, NextResponse } from "next/server"
import { generatePDFEstimate, validateEstimateData } from "@/lib/pdf-webhook"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is missing")
      return NextResponse.json(
        {
          error: "OpenAI API key is not configured",
          details: "Please set the OPENAI_API_KEY environment variable",
        },
        { status: 500 },
      )
    }

    if (!process.env.OPENAI_ASSISTANT_ID) {
      console.error("OPENAI_ASSISTANT_ID environment variable is missing")
      return NextResponse.json(
        {
          error: "OpenAI Assistant ID is not configured",
          details: "Please set the OPENAI_ASSISTANT_ID environment variable",
        },
        { status: 500 },
      )
    }

    const API_KEY = process.env.OPENAI_API_KEY
    const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID

    const formData = await request.formData()
    const message = formData.get("message") as string
    const threadId = formData.get("threadId") as string | null

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }

    console.log("Processing message:", message.substring(0, 100) + "...")

    // Handle file uploads
    const fileIds: string[] = []
    const files = Array.from(formData.entries()).filter(([key]) => key.startsWith("file_"))

    for (const [, file] of files) {
      if (file instanceof File) {
        try {
          console.log("Uploading file:", file.name)
          const fileFormData = new FormData()
          fileFormData.append("file", file)
          fileFormData.append("purpose", "assistants")

          const fileResponse = await fetch("https://api.openai.com/v1/files", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${API_KEY}`,
            },
            body: fileFormData,
          })

          if (!fileResponse.ok) {
            const errorData = await fileResponse.text()
            throw new Error(`File upload failed: ${errorData}`)
          }

          const uploadedFile = await fileResponse.json()
          fileIds.push(uploadedFile.id)
          console.log("File uploaded successfully:", uploadedFile.id)
        } catch (fileError) {
          console.error("File upload error:", fileError)
          return NextResponse.json(
            {
              error: "Failed to upload file",
              details: fileError instanceof Error ? fileError.message : "Unknown file upload error",
            },
            { status: 500 },
          )
        }
      }
    }

    // Create or use existing thread
    let currentThreadId = threadId
    if (!currentThreadId) {
      try {
        console.log("Creating new thread...")
        const threadResponse = await fetch("https://api.openai.com/v1/threads", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
          body: JSON.stringify({}),
        })

        if (!threadResponse.ok) {
          const errorData = await threadResponse.text()
          throw new Error(`Thread creation failed: ${errorData}`)
        }

        const thread = await threadResponse.json()
        currentThreadId = thread.id
        console.log("Thread created:", currentThreadId)
      } catch (threadError) {
        console.error("Thread creation error:", threadError)
        return NextResponse.json(
          {
            error: "Failed to create thread",
            details: threadError instanceof Error ? threadError.message : "Unknown thread creation error",
          },
          { status: 500 },
        )
      }
    }

    // Add message to thread
    const messageData: any = {
      role: "user",
      content: message,
    }

    // Add file attachments if any
    if (fileIds.length > 0) {
      messageData.attachments = fileIds.map((fileId: string) => ({
        file_id: fileId,
        tools: [{ type: "file_search" }],
      }))
    }

    try {
      console.log("Adding message to thread...")
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify(messageData),
      })

      if (!messageResponse.ok) {
        const errorData = await messageResponse.text()
        throw new Error(`Message creation failed: ${errorData}`)
      }

      console.log("Message added successfully")
    } catch (messageError) {
      console.error("Message creation error:", messageError)
      return NextResponse.json(
        {
          error: "Failed to add message to thread",
          details: messageError instanceof Error ? messageError.message : "Unknown message creation error",
        },
        { status: 500 },
      )
    }

    // Create a run with streaming
    try {
      console.log("Creating run with assistant:", ASSISTANT_ID)
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          assistant_id: ASSISTANT_ID,
          stream: true,
        }),
      })

      if (!runResponse.ok) {
        const errorData = await runResponse.text()
        throw new Error(`Run creation failed: ${errorData}`)
      }

      console.log("Run created successfully")

      // Create a readable stream for the response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          // Send thread ID first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "thread_id", threadId: currentThreadId })}\n\n`),
          )

          try {
            console.log("Starting stream processing...")
            const reader = runResponse.body?.getReader()
            if (!reader) {
              throw new Error("No response body reader available")
            }

            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6)
                  if (data === "[DONE]") {
                    continue
                  }

                  try {
                    const event = JSON.parse(data)

                    if (event.object === "thread.message.delta") {
                      const delta = event.delta
                      if (delta.content) {
                        for (const content of delta.content) {
                          if (content.type === "text" && content.text?.value) {
                            controller.enqueue(
                              encoder.encode(
                                `data: ${JSON.stringify({
                                  type: "content",
                                  content: content.text.value,
                                })}\n\n`,
                              ),
                            )
                          }
                        }
                      }
                    } else if (event.object === "thread.run" && event.status === "requires_action") {
                      // Handle tool calls
                      console.log("Run requires action - handling tool calls")
                      const toolCalls = event.required_action?.submit_tool_outputs?.tool_calls || []
                      
                      const toolOutputs = []
                      
                      for (const toolCall of toolCalls) {
                        console.log("Processing tool call:", toolCall.function.name)
                        
                        if (toolCall.function.name === "generate_pdf_estimate") {
                          try {
                            const params = JSON.parse(toolCall.function.arguments)
                            console.log("PDF generation params:", params)
                            
                            // Validate the data
                            const validation = validateEstimateData(params)
                            if (!validation.valid) {
                              toolOutputs.push({
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({
                                  success: false,
                                  error: validation.error
                                })
                              })
                              continue
                            }
                            
                            // Generate PDF via webhook
                            const result = await generatePDFEstimate(params)
                            
                            toolOutputs.push({
                              tool_call_id: toolCall.id,
                              output: JSON.stringify(result)
                            })
                            
                            // Send status update to client
                            controller.enqueue(
                              encoder.encode(
                                `data: ${JSON.stringify({
                                  type: "tool_result",
                                  tool: "generate_pdf_estimate",
                                  result: result
                                })}\n\n`,
                              ),
                            )
                            
                          } catch (error) {
                            console.error("Error in PDF generation:", error)
                            toolOutputs.push({
                              tool_call_id: toolCall.id,
                              output: JSON.stringify({
                                success: false,
                                error: error instanceof Error ? error.message : "Unknown error"
                              })
                            })
                          }
                        } else {
                          // Unknown tool call
                          toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: JSON.stringify({
                              success: false,
                              error: `Unknown tool: ${toolCall.function.name}`
                            })
                          })
                        }
                      }
                      
                      // Submit tool outputs
                      if (toolOutputs.length > 0) {
                        try {
                          const submitResponse = await fetch(
                            `https://api.openai.com/v1/threads/${currentThreadId}/runs/${event.id}/submit_tool_outputs`,
                            {
                              method: "POST",
                              headers: {
                                Authorization: `Bearer ${API_KEY}`,
                                "Content-Type": "application/json",
                                "OpenAI-Beta": "assistants=v2",
                              },
                              body: JSON.stringify({
                                tool_outputs: toolOutputs,
                                stream: true
                              }),
                            }
                          )
                          
                          if (!submitResponse.ok) {
                            console.error("Failed to submit tool outputs:", await submitResponse.text())
                          } else {
                            // Process the streaming response from tool submission
                            const submitReader = submitResponse.body?.getReader()
                            if (submitReader) {
                              const submitDecoder = new TextDecoder()
                              let submitBuffer = ""
                              
                              while (true) {
                                const { done: submitDone, value: submitValue } = await submitReader.read()
                                if (submitDone) break
                                
                                submitBuffer += submitDecoder.decode(submitValue, { stream: true })
                                const submitLines = submitBuffer.split("\n")
                                submitBuffer = submitLines.pop() || ""
                                
                                for (const submitLine of submitLines) {
                                  if (submitLine.startsWith("data: ")) {
                                    const submitData = submitLine.slice(6)
                                    if (submitData === "[DONE]") {
                                      continue
                                    }
                                    
                                    try {
                                      const submitEvent = JSON.parse(submitData)
                                      
                                      if (submitEvent.object === "thread.message.delta") {
                                        const submitDelta = submitEvent.delta
                                        if (submitDelta.content) {
                                          for (const submitContent of submitDelta.content) {
                                            if (submitContent.type === "text" && submitContent.text?.value) {
                                              controller.enqueue(
                                                encoder.encode(
                                                  `data: ${JSON.stringify({
                                                    type: "content",
                                                    content: submitContent.text.value,
                                                  })}\n\n`,
                                                ),
                                              )
                                            }
                                          }
                                        }
                                      }
                                    } catch (submitParseError) {
                                      console.error("Error parsing submit stream data:", submitParseError)
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } catch (submitError) {
                          console.error("Error submitting tool outputs:", submitError)
                        }
                      }
                    } else if (event.object === "thread.run" && event.status === "completed") {
                      console.log("Run completed successfully")
                    } else if (event.object === "thread.run" && event.status === "failed") {
                      console.error("Run failed:", event)
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "error",
                            message: "The assistant run failed. Please try again.",
                          })}\n\n`,
                        ),
                      )
                    }
                  } catch (parseError) {
                    console.error("Error parsing stream data:", parseError)
                  }
                }
              }
            }
          } catch (streamError) {
            console.error("Streaming error:", streamError)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: "An error occurred while processing your request.",
                })}\n\n`,
              ),
            )
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    } catch (runError) {
      console.error("Run creation error:", runError)
      return NextResponse.json(
        {
          error: "Failed to create assistant run",
          details: runError instanceof Error ? runError.message : "Unknown run creation error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("API Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
