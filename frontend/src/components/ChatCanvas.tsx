import type { Message } from "../types";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatCanvasProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (text: string) => void;
}

const SUGGESTION_PROMPTS = [
  "What's the final spec for the MVP login system?",
  "Did the CEO change the auth requirements?",
  "Summarize the latest engineering Slack thread.",
];

export function ChatCanvas({ messages, isStreaming, onSend }: ChatCanvasProps) {
  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex-1 relative h-screen overflow-hidden"
      style={{ backgroundColor: "var(--cc-bg-base)" }}
    >
      {/* ── Empty / centered state ───────────────────────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-16"
        style={{
          transition: "opacity 0.4s ease, transform 0.4s ease",
          opacity: hasMessages ? 0 : 1,
          transform: hasMessages ? "translateY(-24px)" : "translateY(0)",
          pointerEvents: hasMessages ? "none" : "auto",
        }}
      >
        {/* Branding */}
        <h1
          className="text-4xl font-semibold tracking-tight mb-2 select-none"
          style={{ color: "var(--cc-text-primary)" }}
        >
          ChaosContext <span style={{ color: "var(--cc-accent)" }}>AI</span>
        </h1>
        <p
          className="text-base mb-8 select-none"
          style={{ color: "var(--cc-text-muted)" }}
        >
          Ask about your project specs. I&apos;ll find the truth in the chaos.
        </p>

        {/* Centered input */}
        <div className="w-full" style={{ maxWidth: "680px" }}>
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>

        {/* Suggestion pills */}
        <div
          className="mt-4 flex flex-wrap gap-2 justify-center"
          style={{ maxWidth: "680px" }}
        >
          {SUGGESTION_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              disabled={isStreaming}
              className="rounded-lg px-3 py-2 text-sm text-left transition-colors duration-150 cursor-pointer"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#A1A1AA",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(255,255,255,0.10)";
                (e.currentTarget as HTMLButtonElement).style.color = "#EDEDED";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "#A1A1AA";
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat state (messages + bottom input) ────────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          transition: "opacity 0.4s ease, transform 0.4s ease",
          opacity: hasMessages ? 1 : 0,
          transform: hasMessages ? "translateY(0)" : "translateY(16px)",
          pointerEvents: hasMessages ? "auto" : "none",
        }}
      >
        <MessageList messages={messages} />
        <div className="shrink-0 px-4 pb-5 pt-2 max-w-[800px] mx-auto w-full">
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
}
