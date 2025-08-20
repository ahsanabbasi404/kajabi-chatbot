"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  content: string
  className?: string
  isUserMessage?: boolean
}

export function MarkdownRenderer({ content, className, isUserMessage = false }: MarkdownRendererProps) {
  return (
    <div className={cn("max-w-none text-inherit", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "")
            const language = match ? match[1] : ""

            return !inline ? (
              <div className="relative">
                {language && (
                  <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {language}
                  </div>
                )}
                <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm font-mono text-inherit" {...props}>
                    {String(children).replace(/\n$/, "")}
                  </code>
                </pre>
              </div>
            ) : (
              <code className={cn("bg-muted px-1 py-0.5 rounded text-sm font-mono", className)} {...props}>
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold text-inherit">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2 text-inherit">{children}</td>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-inherit">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-inherit">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-medium mb-1 text-inherit">{children}</h3>,
          p: ({ children }) => <p className="mb-2 leading-relaxed text-inherit">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-inherit">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-inherit">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed text-inherit">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic my-2 text-inherit">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className={isUserMessage ? "text-white underline hover:no-underline !text-white" : "text-primary underline hover:no-underline"}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          em: ({ children }) => <em className="font-bold not-italic text-inherit">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
