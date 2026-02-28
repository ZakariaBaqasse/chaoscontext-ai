import { useState } from "react";
import { PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import type { Session } from "../types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Collapsed toggle button */}
      {!isOpen && (
        <div
          className="h-screen flex flex-col items-center pt-4 shrink-0"
          style={{
            width: "52px",
            backgroundColor: "var(--cc-bg-elevated)",
            borderRight: "1px solid var(--cc-border)",
          }}
        >
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--cc-text-muted)" }}
            title="Open sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>
      )}

      {/* Expanded sidebar */}
      {isOpen && (
        <div
          className="h-screen flex flex-col shrink-0"
          style={{
            width: "260px",
            backgroundColor: "var(--cc-bg-elevated)",
            borderRight: "1px solid var(--cc-border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--cc-border)" }}
          >
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: "var(--cc-text-primary)" }}
            >
              Chats
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onNew}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--cc-text-muted)" }}
                title="New chat"
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--cc-accent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--cc-text-muted)")
                }
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--cc-text-muted)" }}
                title="Collapse sidebar"
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--cc-text-primary)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--cc-text-muted)")
                }
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-2">
            {sessions.length === 0 ? (
              <div
                className="px-4 py-6 text-sm text-center"
                style={{ color: "var(--cc-text-muted)" }}
              >
                No chats yet
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => onSelect(session.id)}
                    className="w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors"
                    style={{
                      borderLeft: isActive
                        ? "2px solid var(--cc-accent)"
                        : "2px solid transparent",
                      backgroundColor: isActive
                        ? "rgba(255,130,5,0.06)"
                        : "transparent",
                      color: isActive
                        ? "var(--cc-text-primary)"
                        : "var(--cc-text-muted)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = "transparent";
                    }}
                  >
                    <span
                      className="text-sm font-medium truncate leading-snug"
                      style={{
                        color: isActive
                          ? "var(--cc-text-primary)"
                          : "var(--cc-text-muted)",
                      }}
                    >
                      {session.preview || "New chat"}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--cc-text-muted)", opacity: 0.7 }}
                    >
                      {relativeTime(session.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
