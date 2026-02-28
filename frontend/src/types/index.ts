export type AgentName = "scavenger" | "synthesizer" | "interface";

export type ThoughtStep =
  | { type: "agent_start"; agent: AgentName }
  | { type: "tool_call"; agent: AgentName; tool: string; query: string }
  | { type: "tool_result"; agent: AgentName; tool: string; result: string }
  | { type: "handoff"; from: AgentName; to: AgentName };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string; // final text (streaming, appended token by token)
  thoughts: ThoughtStep[]; // populated before content begins
  isStreaming: boolean;
}

export interface Session {
  id: string; // UUID
  createdAt: string; // ISO date string
  preview: string; // first user message, truncated to 40 chars
  messages: Message[];
}
