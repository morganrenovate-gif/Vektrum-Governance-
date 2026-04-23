'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, ChevronDown, Send, Loader2 } from 'lucide-react'

interface AssistantPanelProps {
  /** Number of milestones or items requiring action — triggers pulse when > 0 */
  actionRequired?: number
}

interface Message {
  role: 'assistant' | 'user'
  text: string
}

const STORAGE_KEY = 'vektrum_assistant_seen'

const GREETING =
  "Hi, I'm your Vektrum AI assistant. I can help you review draw requests, check milestone status, and flag payment risks."

const SUGGESTIONS_DEFAULT = [
  'Show milestones ready for review',
  'Check release readiness',
  'Summarize active disputes',
  'Review open change orders',
]

// ─── Pill (collapsed state) ───────────────────────────────────────────────────

function AssistantPill({
  onOpen,
  pulse,
}: {
  onOpen: () => void
  pulse: boolean
}) {
  return (
    <button
      onClick={onOpen}
      className={[
        'flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2 px-4 py-2.5',
        'shadow-lg shadow-vektrum-canvas/10 hover:shadow-xl hover:border-vektrum-blue/40',
        'text-[13px] font-medium text-white/55 hover:text-white',
        'transition-all duration-200',
      ].join(' ')}
      aria-label="Open AI assistant"
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vektrum-blue opacity-60" />
        )}
        <span
          className={[
            'relative inline-flex h-2 w-2 rounded-full',
            pulse ? 'bg-vektrum-blue' : 'bg-vektrum-green',
          ].join(' ')}
        />
      </span>
      AI Assistant
    </button>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AssistantPanel({ actionRequired = 0 }: AssistantPanelProps) {
  const [open, setOpen] = useState(false)
  const [firstVisitDone, setFirstVisitDone] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: GREETING },
  ])
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTIONS_DEFAULT)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // On mount — check if first visit
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        // First visit — animate open after short delay
        const t = setTimeout(() => {
          setOpen(true)
        }, 1200)
        return () => clearTimeout(t)
      } else {
        setFirstVisitDone(true)
      }
    } catch {
      // localStorage not available — stay closed
    }
  }, [])

  // Mark first visit done when panel first opens
  useEffect(() => {
    if (open && !firstVisitDone) {
      try {
        localStorage.setItem(STORAGE_KEY, '1')
        setFirstVisitDone(true)
      } catch {
        // ignore
      }
    }
  }, [open, firstVisitDone])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || loading) return

    const userMsg: Message = { role: 'user', text: command.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.error ?? 'Something went wrong. Please try again.' },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.reply },
        ])
        if (data.suggestions?.length > 0) {
          setSuggestions(data.suggestions)
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Network error. Please check your connection and try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendCommand(input)
  }

  const pulse = actionRequired > 0

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Panel (open state) */}
      {open && (
        <div className="flex w-[340px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-2xl shadow-vektrum-canvas/20 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-vektrum-canvas px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue">
                <MessageCircle size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">Vektrum AI</p>
                <p className="text-[10px] text-white/50">AI-powered assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
              aria-label="Close assistant"
            >
              <ChevronDown size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto px-4 py-4 scrollbar-thin">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={[
                  'max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                  msg.role === 'assistant'
                    ? 'self-start bg-surface-3 text-white'
                    : 'self-end bg-vektrum-blue text-white',
                ].join(' ')}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="self-start flex items-center gap-1.5 rounded-xl bg-surface-3 px-3.5 py-2.5">
                <Loader2 size={13} className="animate-spin text-white/30" />
                <span className="text-[12px] text-white/30">Thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested commands */}
          {!loading && (
            <div className="border-t border-white/[0.05] px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/30">
                Suggested
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendCommand(s)}
                    className="rounded-full border border-white/[0.08] bg-surface-3 px-2.5 py-1 text-[11px] font-medium text-white/55 hover:border-vektrum-blue/40 hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-white/[0.08] px-3 py-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your deals..."
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/30 outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue text-white disabled:opacity-40 hover:bg-vektrum-blue-hover transition-colors"
              aria-label="Send message"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      )}

      {/* Pill / toggle */}
      {!open ? (
        <AssistantPill onOpen={() => setOpen(true)} pulse={pulse} />
      ) : (
        <button
          onClick={() => setOpen(false)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-canvas text-white shadow-lg hover:bg-vektrum-blue transition-colors"
          aria-label="Close assistant"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
