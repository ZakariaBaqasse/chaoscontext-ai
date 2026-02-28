import ReactMarkdown from "react-markdown";
import "./AgentMessage.css";

interface AgentMessageProps {
  content: string;
  isStreaming: boolean;
}

export function AgentMessage({ content, isStreaming }: AgentMessageProps) {
  return (
    <div
      className="w-full text-base leading-relaxed agent-message"
      style={{
        color: "var(--cc-text-primary)",
        fontFamily: "var(--cc-font-sans)",
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {isStreaming && <span className="blinking-cursor">|</span>}
    </div>
  );
}
