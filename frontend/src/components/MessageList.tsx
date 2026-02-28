import { useEffect, useRef } from "react";
import type { Message } from "../types";
import { UserMessage } from "./UserMessage";
import { AgentMessage } from "./AgentMessage";
import { ThoughtProcess } from "./ThoughtProcess";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return <div className="flex-1" />;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-200 mx-auto px-6 py-8 flex flex-col gap-6">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : (
            <div key={msg.id} className="flex flex-col gap-2">
              {msg.thoughts.length > 0 && (
                <ThoughtProcess thoughts={msg.thoughts} />
              )}
              <AgentMessage
                content={msg.content}
                isStreaming={msg.isStreaming}
              />
            </div>
          ),
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}
