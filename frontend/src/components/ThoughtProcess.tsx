import React, { useState } from "react";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import type { ThoughtStep, AgentName } from "../types";
import "./AgentMessage.css";

interface ThoughtProcessProps {
  thoughts: ThoughtStep[];
}

const AGENT_LABELS: Record<AgentName, string> = {
  interface: "Manager",
  scavenger: "Scavenger",
  synthesizer: "Synthesizer",
};

// ── Inline SVG logos ────────────────────────────────────────────────────────

function NotionLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 100 100"
      fill="none"
      aria-label="Notion"
      style={{ flexShrink: 0 }}
    >
      <rect width="100" height="100" rx="14" fill="#fff" />
      <path
        d="M23 18.7c3.2 2.6 4.4 2.4 10.4 2l56.3-3.4c1.2 0 .2-1.2-.2-1.4l-9.4-6.8c-1.8-1.4-4.2-3-8.8-2.6L16.6 10.3c-2 .2-2.4 1.2-1.6 2l8 6.4z"
        fill="#000"
      />
      <path
        d="M26.2 31v57.4c0 3.1 1.5 4.2 5 4l61.8-3.6c3.5-.2 4.4-2.2 4.4-4.8V27.5c0-2.6-1-4-3.3-3.8l-64.7 3.8c-2.5.2-3.2 1.3-3.2 3.5z"
        fill="#fff"
      />
      <path
        d="M62.3 32.4l-26.1 1.6c-2.2.1-2.8 1.4-2.8 3v4l7-1v39.5l-7 .8v4.2l29.2-1.8V78l-7.6.5V38l7.3-.4v-5.2z"
        fill="#000"
      />
    </svg>
  );
}

function SlackLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 54 54"
      aria-label="Slack"
      style={{ flexShrink: 0 }}
    >
      <path d="M19.7 31.3a4.3 4.3 0 1 1-4.3-4.3h4.3v4.3z" fill="#E01E5A" />
      <path
        d="M21.9 31.3a4.3 4.3 0 0 1 8.6 0v10.8a4.3 4.3 0 1 1-8.6 0V31.3z"
        fill="#E01E5A"
      />
      <path d="M26.2 19.7a4.3 4.3 0 1 1 4.3-4.3v4.3h-4.3z" fill="#36C5F0" />
      <path
        d="M26.2 21.9a4.3 4.3 0 0 1 0 8.6H15.4a4.3 4.3 0 1 1 0-8.6h10.8z"
        fill="#36C5F0"
      />
      <path d="M37.8 26.2a4.3 4.3 0 1 1 4.3 4.3h-4.3v-4.3z" fill="#2EB67D" />
      <path
        d="M35.6 26.2a4.3 4.3 0 0 1-8.6 0V15.4a4.3 4.3 0 1 1 8.6 0v10.8z"
        fill="#2EB67D"
      />
      <path d="M31.3 37.8a4.3 4.3 0 1 1-4.3 4.3v-4.3h4.3z" fill="#ECB22E" />
      <path
        d="M31.3 35.6a4.3 4.3 0 0 1 0-8.6h10.8a4.3 4.3 0 1 1 0 8.6H31.3z"
        fill="#ECB22E"
      />
    </svg>
  );
}

// ── Tool metadata ───────────────────────────────────────────────────────────

const TOOL_META: Record<
  string,
  { icon: () => React.ReactElement; label: string }
> = {
  read_notion_mock: { icon: NotionLogo, label: "Notion" },
  read_slack_mock: { icon: SlackLogo, label: "Slack" },
};

// ── Tool result row (collapsible) ───────────────────────────────────────────

function ToolResultRow({ tool, result }: { tool: string; result: string }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[tool];
  const PREVIEW_LEN = 120;
  const isLong = result.length > PREVIEW_LEN;
  const displayed =
    !isLong || expanded ? result : result.slice(0, PREVIEW_LEN) + "…";

  return (
    <div
      className="mt-1 ml-5 rounded-md px-3 py-2 text-[12px] leading-relaxed"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        fontFamily: "var(--cc-font-mono)",
        color: "#71717A",
        fontStyle: "italic",
      }}
    >
      <div className="flex items-start gap-2">
        {meta && (
          <span className="mt-0.5 opacity-40 shrink-0">
            <meta.icon />
          </span>
        )}
        <span className="wrap-break-word min-w-0">{displayed}</span>
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 flex items-center gap-1 text-[11px] transition-colors"
          style={{ color: "var(--cc-accent)", opacity: 0.8 }}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

// ── Step renderer ───────────────────────────────────────────────────────────

function StepRow({ step }: { step: ThoughtStep }) {
  // Secondary meta lines — very muted
  if (step.type === "agent_start") {
    return (
      <div
        className="text-[12px] leading-relaxed"
        style={{ color: "#52525B", fontFamily: "var(--cc-font-mono)" }}
      >
        // agent activated
      </div>
    );
  }

  if (step.type === "handoff") {
    return (
      <div
        className="text-[12px] leading-relaxed flex items-center gap-1"
        style={{ color: "#52525B", fontFamily: "var(--cc-font-mono)" }}
      >
        <span>→</span>
        <span>
          handing off to{" "}
          <span style={{ color: "#71717A" }}>
            {AGENT_LABELS[step.to].toLowerCase()}
          </span>
        </span>
      </div>
    );
  }

  // Tool call — primary action, highlighted query
  if (step.type === "tool_call") {
    const meta = TOOL_META[step.tool];
    if (meta) {
      const Icon = meta.icon;
      return (
        <div
          className="flex items-center gap-2 text-[13px] leading-relaxed"
          style={{ color: "#D4D4D8", fontFamily: "var(--cc-font-mono)" }}
        >
          <Icon />
          <span>
            Searching {meta.label} for{" "}
            <span
              className="rounded px-1 py-0.5"
              style={{
                color: "#EDEDED",
                backgroundColor: "rgba(255,130,5,0.12)",
                fontWeight: 500,
              }}
            >
              &quot;{step.query}&quot;
            </span>
          </span>
        </div>
      );
    }
    return (
      <div
        className="text-[13px]"
        style={{ color: "#D4D4D8", fontFamily: "var(--cc-font-mono)" }}
      >
        &gt; {step.tool}(&quot;{step.query}&quot;)
      </div>
    );
  }

  // Tool result — indented output block
  if (step.type === "tool_result") {
    return <ToolResultRow tool={step.tool} result={step.result} />;
  }

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStepAgent(step: ThoughtStep): AgentName {
  switch (step.type) {
    case "agent_start":
      return step.agent;
    case "handoff":
      return step.from;
    case "tool_call":
    case "tool_result":
      return step.agent;
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export function ThoughtProcess({ thoughts }: ThoughtProcessProps) {
  if (thoughts.length === 0) return null;

  const groups: Array<{ agent: AgentName; steps: ThoughtStep[] }> = [];
  for (const step of thoughts) {
    const agent = getStepAgent(step);
    const last = groups[groups.length - 1];
    if (last && last.agent === agent) {
      last.steps.push(step);
    } else {
      groups.push({ agent, steps: [step] });
    }
  }

  return (
    <div
      className="mb-5 rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--cc-bg-elevated)",
        borderLeft: "3px solid var(--cc-accent)",
      }}
    >
      {groups.map((group, i) => (
        <div key={i}>
          {/* Divider between agent blocks (not before the first) */}
          {i > 0 && (
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.05)",
                margin: "0 16px",
              }}
            />
          )}

          <div className="px-5 py-4">
            {/* Agent header */}
            <div
              className="flex items-center gap-2 mb-3"
              style={{ fontFamily: "var(--cc-font-sans)" }}
            >
              <Bot
                size={14}
                strokeWidth={2}
                style={{ color: "var(--cc-accent)", flexShrink: 0 }}
              />
              <span
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: "var(--cc-accent)" }}
              >
                {AGENT_LABELS[group.agent]}
              </span>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-1.5">
              {group.steps.map((step, j) => (
                <div key={j} className="thought-step-fadein">
                  <StepRow step={step} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
