import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Message, Session, ThoughtStep, AgentName } from "../types";
import { saveSessions, loadSessions } from "../lib/storage";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8080";

// ---------------------------------------------------------------------------
// SSE payload → ThoughtStep mapper
// ---------------------------------------------------------------------------

function toThoughtStep(
  event: string,
  payload: Record<string, string>,
): ThoughtStep | null {
  switch (event) {
    case "agent_start":
      return { type: "agent_start", agent: payload.agent as AgentName };
    case "handoff":
      return {
        type: "handoff",
        from: payload.from as AgentName,
        to: payload.to as AgentName,
      };
    case "tool_call":
      return {
        type: "tool_call",
        agent: payload.agent as AgentName,
        tool: payload.tool,
        query: payload.query ?? "",
      };
    case "tool_result":
      return {
        type: "tool_result",
        agent: payload.agent as AgentName,
        tool: payload.tool,
        result: payload.result ?? "",
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => loadSessions()[0]?.id ?? null,
  );
  const [isStreaming, setIsStreaming] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const messages = activeSession?.messages ?? [];

  // ------------------------------------------------------------------
  // Create a new empty session and make it active
  // ------------------------------------------------------------------
  const newSession = useCallback(() => {
    const session: Session = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      preview: "New chat",
      messages: [],
    };
    setSessions((prev) => {
      const updated = [session, ...prev];
      saveSessions(updated);
      return updated;
    });
    setActiveSessionId(session.id);
  }, []);

  // ------------------------------------------------------------------
  // Select an existing session
  // ------------------------------------------------------------------
  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  // ------------------------------------------------------------------
  // Send a message and stream the response
  // ------------------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      // Ensure there is an active session
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = uuidv4();
        const session: Session = {
          id: sessionId,
          createdAt: new Date().toISOString(),
          preview: text.slice(0, 40),
          messages: [],
        };
        setSessions((prev) => {
          const updated = [session, ...prev];
          saveSessions(updated);
          return updated;
        });
        setActiveSessionId(sessionId);
      }

      const sid = sessionId; // stable ref for closures

      const userMsg: Message = {
        id: uuidv4(),
        role: "user",
        content: text,
        thoughts: [],
        isStreaming: false,
      };

      const assistantId = uuidv4();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        thoughts: [],
        isStreaming: true,
      };

      // Write user + empty assistant message; update preview on first turn
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s;
          return {
            ...s,
            preview: s.messages.length === 0 ? text.slice(0, 40) : s.preview,
            messages: [...s.messages, userMsg, assistantMsg],
          };
        }),
      );

      setIsStreaming(true);

      // Helper to patch the in-flight assistant message
      const patchAssistant = (updater: (m: Message) => Message) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sid) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId ? updater(m) : m,
              ),
            };
          }),
        );
      };

      try {
        const response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, message: text }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Parse SSE stream manually (fetch-based, no EventSource)
        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Normalize CRLF → LF so blank-line separators are always ""
          buffer += decoder
            .decode(value, { stream: true })
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");
          const rawLines = buffer.split("\n");
          buffer = rawLines.pop() ?? "";

          let currentEvent = "";
          let currentData = "";

          for (const line of rawLines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              currentData = line.slice(5).trim();
            } else if (line === "") {
              if (!currentEvent) {
                continue;
              }

              try {
                const payload = currentData
                  ? (JSON.parse(currentData) as Record<string, string>)
                  : {};

                if (currentEvent === "token") {
                  patchAssistant((m) => ({
                    ...m,
                    content: m.content + (payload.text ?? ""),
                  }));
                } else if (currentEvent === "done") {
                  patchAssistant((m) => ({ ...m, isStreaming: false }));
                  break outer;
                } else {
                  const step = toThoughtStep(currentEvent, payload);
                  if (step) {
                    patchAssistant((m) => ({
                      ...m,
                      thoughts: [...m.thoughts, step],
                    }));
                  }
                }
              } catch {
                /* swallow parse errors */
              }

              // Reset for next event
              currentEvent = "";
              currentData = "";
            }
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        patchAssistant((m) => ({ ...m, isStreaming: false }));
      } finally {
        setIsStreaming(false);
        // Persist updated sessions to localStorage
        setSessions((prev) => {
          saveSessions(prev);
          return prev;
        });
      }
    },
    [activeSessionId, isStreaming],
  );

  return {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    sendMessage,
    newSession,
    selectSession,
  };
}
