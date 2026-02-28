# Technical Specifications: ChaosContext AI

## 1. Overview

ChaosContext AI is a hackathon PoC that acts as an "Invisible PM". It synthesizes scattered communications (Slack) and outdated documentation (Notion) into a single source of truth for developers. There is no database; all external data is mocked via local JSON files. Chat history is persisted in the browser's `localStorage`.

### Demo Scenario (Definition of Done)

1. User sends: _"I'm starting on the login system. What's the final spec?"_
2. UI shows each of the three agents activating in sequence with their tool calls visible.
3. Agent responds: Notion says Email/Password; the CEO's Slack message from yesterday overrides it to Google OAuth only. Google OAuth is the recommendation.
4. User sends: _"What library should I use for that?"_
5. Agent responds referencing Google OAuth from memory, recommending `react-oauth/google` + `authlib`.

---

## 2. System Architecture

```
Browser (React + Vite)
    │
    │  POST /chat  (session_id, message)
    │  ← text/event-stream (SSE)
    ▼
FastAPI Backend
    │
    ├── Agent Orchestrator (server-side agentic loop)
    │       ├── Scavenger Agent  ──► Mistral API
    │       ├── Synthesizer Agent ──► Mistral API
    │       └── Interface Agent  ──► Mistral API
    │
    └── Mock Data Layer
            ├── data/mock_notion.json
            └── data/mock_slack.json
```

**Transport:** All streaming uses Server-Sent Events (SSE). The connection is a single long-lived HTTP response per user message.

**No WebSockets. No database. No external API calls.**

---

## 3. Multi-Agent Architecture

### 3.1 Agent Definitions

The three agents are created **programmatically on backend startup** via `client.beta.agents.create(...)`. Their `agent_id` values are stored in memory and reused for all subsequent requests.

---

#### Agent 1: The Interface Agent _(entry point & orchestrator)_

| Property          | Value                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**       | Entry point for every user message. Decides whether to respond directly (follow-ups, context already in history) or delegate to the Scavenger. Also receives the Synthesizer's output and presents it to the user.                                                                         |
| **Tools**         | None                                                                                                                                                                                                                                                                                       |
| **Handoffs**      | → Scavenger Agent (on-demand only)                                                                                                                                                                                                                                                         |
| **System Prompt** | _Path A (respond directly): when the question can be answered from conversation history — no handoff. Path B (handoff to Scavenger): when fresh data is required. On receiving a Synthesizer result in context, present it clearly to the developer. See `agents.py` for the full prompt._ |

---

#### Agent 2: The Scavenger

| Property          | Value                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**       | Pure data retrieval. Called exclusively when the Interface agent determines fresh data is needed. Uses both tools unconditionally, returns raw results only.                                                                                           |
| **Tools**         | `read_notion_mock`, `read_slack_mock`                                                                                                                                                                                                                  |
| **Handoffs**      | → Synthesizer Agent                                                                                                                                                                                                                                    |
| **System Prompt** | _"You are a data retrieval agent. Call BOTH tools for every query regardless of results. Do NOT summarise or interpret. Return raw tool output exactly as received. Once both tools have been called, hand off immediately to the Synthesizer agent."_ |

---

#### Agent 3: The Synthesizer

| Property          | Value                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**       | Receives raw Scavenger tool results. Compares sources, identifies conflicts, determines the most recent source of truth. Hands back to Interface.                                                                                                                                                                               |
| **Tools**         | None                                                                                                                                                                                                                                                                                                                            |
| **Handoffs**      | → Interface Agent                                                                                                                                                                                                                                                                                                               |
| **System Prompt** | _"You are a synthesis agent. Compare the two raw results in context, identify conflicts, determine the more recent source, and produce a single concise 'Source of Truth' summary. Do NOT address the user — the Interface agent will handle that. Once your summary is written, hand off immediately to the Interface agent."_ |

---

### 3.2 Handoff Flow

The Interface agent is both the **entry point** and the **terminal agent**. The chain is circular:

```
User Message
    │
    ▼
[Interface Agent]  ── reads message + full conversation history
    │                    decides: needs fresh data?
    │
    ├─── NO (follow-up / history sufficient) ──► streams reply directly to user
    │
    └─── YES (first question / unknown topic)
              │
              │  handoff → FastAPI emits SSE
              ▼
    [Scavenger Agent]  ── calls read_notion_mock(query) + read_slack_mock(query)
              │
              │  handoff → FastAPI emits SSE, executes local tools
              ▼
    [Synthesizer Agent]  ── compares sources, produces Source of Truth summary
              │
              │  handoff → FastAPI emits SSE
              ▼
    [Interface Agent]  ── presents synthesis result to user
              │
              ▼
         SSE stream → Browser
```

Handoffs use the **native Mistral handoff API** with `handoff_execution="client"` mode. In client mode, when an agent triggers a handoff, Mistral pauses execution and returns an `agent.handoff` event directly to the FastAPI backend. This gives the backend the opportunity to:

1. Emit the corresponding SSE `handoff` event to the browser.
2. Execute any pending local tool calls (reading mock JSON files) and return results.
3. Resume the conversation by appending to it via `client.beta.conversations.append()`.

This is the correct mode for this app. `server` mode would run the entire chain inside Mistral's cloud, making it impossible to intercept between agents for SSE emission or to execute local Python tool functions.

---

## 4. Backend Specification

### 4.1 Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app, /chat endpoint, SSE orchestrator
│   ├── config.py        # Settings (MISTRAL_API_KEY from env)
│   ├── agents.py        # Agent creation + storage on startup
│   ├── tools.py         # read_notion_mock, read_slack_mock
│   └── schemas.py       # Pydantic models for request/response
├── data/
│   ├── mock_notion.json
│   └── mock_slack.json
├── .env                 # MISTRAL_API_KEY=...
└── pyproject.toml
```

### 4.2 Environment Variables

| Variable          | Required | Description                   |
| ----------------- | -------- | ----------------------------- |
| `MISTRAL_API_KEY` | Yes      | Mistral La Plateforme API key |

### 4.3 Startup Sequence (`agents.py`)

On `lifespan` startup event:

1. Instantiate `MistralClient` using `MISTRAL_API_KEY`.
2. If `backend/.agent_ids.json` exists, validate each stored ID against Mistral via `agents.get()`; if all valid, reuse them (idempotent restart / hot-reload path).
3. Otherwise, call `client.beta.agents.create(...)` three times — Scavenger (with tools), Synthesizer (no tools), Interface (no tools).
4. Wire the circular handoff chain:
   - `client.beta.agents.update(agent_id=interface.id, handoffs=[scavenger.id])` — Interface → Scavenger
   - `client.beta.agents.update(agent_id=scavenger.id, handoffs=[synthesizer.id])` — Scavenger → Synthesizer
   - `client.beta.agents.update(agent_id=synthesizer.id, handoffs=[interface.id])` — Synthesizer → Interface
5. Store all three `agent_id` values in module-level dicts: `AGENTS = { "interface": "...", "scavenger": "...", "synthesizer": "..." }` and `AGENT_ID_TO_NAME` (reverse lookup).
6. Persist IDs to `backend/.agent_ids.json` (gitignored) so the next startup skips creation.

### 4.4 Mock Data Files

**`data/mock_notion.json`**

```json
{
  "docs": [
    {
      "id": "doc_1",
      "title": "MVP Authentication Specs",
      "last_updated": "2026-01-15",
      "content": "For the MVP, we will implement a standard Email and Password authentication system. Do not use third-party providers yet to save time."
    }
  ]
}
```

**`data/mock_slack.json`**

```json
{
  "messages": [
    {
      "channel": "#engineering",
      "user": "CEO",
      "date": "2026-02-27",
      "text": "Hey team, scrap the email/password login for the MVP. It's taking too long to secure. Let's just drop in Google OAuth and call it a day."
    }
  ]
}
```

### 4.5 Tool Functions (`tools.py`)

**`read_notion_mock(query: str) → str`**

- Open `data/mock_notion.json`.
- Case-insensitive keyword search across `title` + `content` fields.
- If match found: return `"[Notion | {title} | Last updated: {last_updated}] {content}"`.
- If no match: return `"No relevant Notion document found for query: {query}"`.

**`read_slack_mock(query: str) → str`**

- Open `data/mock_slack.json`.
- Case-insensitive keyword search across `text` field.
- If match found: return `"[Slack | {channel} | {user} | {date}] {text}"`.
- If no match: return `"No relevant Slack message found for query: {query}"`.

### 4.6 API Endpoint

**`POST /chat`**

Request body:

```json
{
  "session_id": "uuid-string",
  "message": "I'm starting on the login system. What's the final spec?"
}
```

Response: `Content-Type: text/event-stream`

### 4.7 SSE Event Schema

Every event frame follows the format:

```
event: {event_type}\n
data: {json_payload}\n\n
```

| Event Type    | Payload                                                                         | When Emitted                             |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `agent_start` | `{ "agent": "scavenger" \| "synthesizer" \| "interface" }`                      | When each agent begins processing        |
| `tool_call`   | `{ "agent": "scavenger", "tool": "read_notion_mock", "query": "login system" }` | When Scavenger calls a tool              |
| `tool_result` | `{ "agent": "scavenger", "tool": "read_notion_mock", "result": "..." }`         | After tool executes                      |
| `handoff`     | `{ "from": "scavenger", "to": "synthesizer" }`                                  | Between agent transitions                |
| `token`       | `{ "text": "..." }`                                                             | Each streamed token from Interface Agent |
| `done`        | `{}`                                                                            | Stream complete                          |
| `error`       | `{ "message": "..." }`                                                          | On any failure                           |

### 4.8 Agentic Loop (Pseudocode, `main.py`)

The loop uses the native Mistral Conversations API with `handoff_execution="client"`. The conversation is **always started on the Interface agent**. Interface decides on its own whether to respond directly or hand off to Scavenger. When any agent decides to hand off, Mistral pauses and returns an `agent.handoff` event. The backend resumes the conversation via `conversations.append()`.

```
async def orchestrate(session_id, user_message) -> AsyncGenerator[SSEEvent]:
  history = get_session_history(session_id)   # prior turns for context
  current_agent_name = "interface"

  # Start the conversation on the Interface agent (entry point)
  yield agent_start("interface")
  conversation = client.beta.conversations.start(
      agent_id=AGENTS["interface"],
      inputs=build_initial_prompt(history, user_message),
      handoff_execution="client",
      stream=True,
  )

  # Event loop — runs until Interface agent produces a final message
  loop:
    for event in conversation:

      if event.type == "agent.handoff":
        # Mistral signals a handoff; emit SSE and note the new active agent
        next_agent_name = resolve_agent_name(event.agent_id)  # lookup in AGENT_ID_TO_NAME
        yield handoff(current_agent_name, next_agent_name)
        yield agent_start(next_agent_name)
        current_agent_name = next_agent_name

      elif event.type == "tool.execution" (function call pending):
        tool_name = event.function.name
        query = event.function.arguments["query"]
        yield tool_call(current_agent_name, tool_name, query)
        result = execute_tool(tool_name, query)   # reads local mock JSON
        yield tool_result(current_agent_name, tool_name, result)
        # Return tool result to continue the conversation
        conversation.append(tool_result_message(event.tool_call_id, result))

      elif event.type == "message.output" and current_agent_name == "interface":
        # Stream tokens from the Interface agent's final message
        # (this fires both when Interface responds directly AND after synthesis)
        for chunk in event.content:
          if chunk.type == "text":
            yield token(chunk.text)

      elif event.type == "conversation.done":
        break

  append_to_session_history(session_id, user_message, assembled_response)
  yield done()
```

### 4.9 Chat History

- **Storage:** Module-level `dict[str, list[dict]]` — `SESSION_HISTORY`.
- **Key:** `session_id` (UUID generated by frontend).
- **Value:** List of `{ "role": "user" | "assistant", "content": str }` messages.
- **Usage:** Only the Interface Agent receives the full history. Scavenger and Synthesizer are stateless per call.
- **Cleanup:** None (in-memory, process lifetime only).

### 4.10 CORS

Allow origins: `http://localhost:5173`. All methods and headers allowed.

---

## 5. Frontend Specification

### 5.1 Project Structure

```
frontend/src/
├── App.tsx
├── main.tsx
├── index.css           # Tailwind directives + CSS variables
├── components/
│   ├── Sidebar.tsx
│   ├── ChatCanvas.tsx
│   ├── MessageList.tsx
│   ├── UserMessage.tsx
│   ├── AgentMessage.tsx
│   ├── ThoughtProcess.tsx
│   └── ChatInput.tsx
├── hooks/
│   └── useChat.ts      # SSE client + state management
├── lib/
│   ├── utils.ts
│   └── storage.ts      # localStorage read/write helpers
└── types/
    └── index.ts        # Shared TypeScript types
```

### 5.2 TypeScript Types (`types/index.ts`)

```typescript
type AgentName = "scavenger" | "synthesizer" | "interface";

type ThoughtStep =
  | { type: "agent_start"; agent: AgentName }
  | { type: "tool_call"; agent: AgentName; tool: string; query: string }
  | { type: "tool_result"; agent: AgentName; tool: string; result: string }
  | { type: "handoff"; from: AgentName; to: AgentName };

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string; // final text (streaming, appended token by token)
  thoughts: ThoughtStep[]; // populated before content begins
  isStreaming: boolean;
}

interface Session {
  id: string; // UUID
  createdAt: string; // ISO date string
  preview: string; // first user message, truncated to 40 chars
  messages: Message[];
}
```

### 5.3 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (260px)  │  Chat Canvas (flex-1, max-w-800px)   │
│                  │                                       │
│  Session list    │  MessageList (scrollable)             │
│  (from           │                                       │
│  localStorage)   │                                       │
│                  │  ─────────────────────────────────── │
│                  │  ChatInput (sticky bottom)            │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Component Specifications

**`Sidebar`**

- Lists all sessions from `localStorage`, newest first.
- Each item shows `session.preview` + `session.createdAt` (relative time).
- Active session is highlighted with a `#FF8205` left border.
- "New Chat" button at top clears active session and generates a new UUID.
- Collapsible on mobile.

**`UserMessage`**

- Right-aligned.
- Background: `#27272A`. Rounded corners. Max-width: 70%.
- Font: Inter 16px, color `#EDEDED`.

**`ThoughtProcess`**

- Rendered _above_ the `AgentMessage` it belongs to.
- Groups steps by agent with a label header: e.g. `SCAVENGER`, `SYNTHESIZER`, `INTERFACE`.
- Each step rendered in monospace 13px, color `#A1A1AA`.
- Left border: 2px solid `#FF8205`.
- Background: `#141414`. Padding: 12px 16px.
- Format per step type:
  - `agent_start` → `▶ scavenger agent activated`
  - `tool_call` → `→ calling read_notion_mock("login system")`
  - `tool_result` → `← result: [Notion | MVP Auth Specs | ...] Email/Password...`
  - `handoff` → `⇒ handing off to synthesizer`

**`AgentMessage`**

- Left-aligned. No bubble. Text flows directly on `#0A0A0A`.
- Supports Markdown rendering (use `react-markdown`).
- Streaming cursor (blinking `|`) shown while `isStreaming === true`.
- Font: Inter 16px, line-height 1.6, color `#EDEDED`.

**`ChatInput`**

- `<textarea>` that auto-grows with content (max 5 rows).
- Background `#141414`, border `#27272A`, border-radius 12px.
- Submit button: small square icon button inside input, right side.
  - Disabled state: icon color `#A1A1AA`, no background.
  - Active state (text present): background `#FF8205`, icon color white.
- Submit on `Enter` (without Shift). `Shift+Enter` = newline.
- Disabled while a response is streaming.

### 5.5 `useChat` Hook (`hooks/useChat.ts`)

**Responsibilities:**

- Manages `messages: Message[]` state for the active session.
- `sendMessage(text: string)`: appends a user message, opens SSE stream, processes events.
- **SSE client pattern:** Use `fetch()` with `ReadableStream` (not `EventSource`) to support POST requests with a body.

**SSE event handling:**
| Event | Action |
|---|---|
| `agent_start` | Append `ThoughtStep` to the current assistant message's `thoughts` array |
| `tool_call` | Append `ThoughtStep` |
| `tool_result` | Append `ThoughtStep` |
| `handoff` | Append `ThoughtStep` |
| `token` | Append `text` to current assistant message's `content` |
| `done` | Set `isStreaming = false`, persist session to `localStorage` |
| `error` | Set `isStreaming = false`, show error in UI |

**On `sendMessage`:**

1. Generate `message_id` (UUID).
2. Append `UserMessage` to state.
3. Append empty `AssistantMessage` with `isStreaming: true`, empty `content`, empty `thoughts`.
4. POST to `http://localhost:8000/chat` with `{ session_id, message }`.
5. Read response body as `ReadableStream`, parse SSE frames, dispatch events to state updater.

### 5.6 localStorage Persistence (`lib/storage.ts`)

- Key: `chaoscontext_sessions`.
- Value: `Session[]` serialized as JSON.
- `saveSessions(sessions: Session[])`: serialize and write.
- `loadSessions(): Session[]`: read and parse; return `[]` on error.
- Called in `useChat` on every `done` event and on initial mount.

---

## 6. Design Tokens

Defined as CSS variables in `index.css` and mapped to Tailwind via `tailwind.config.js`.

| Token                  | Value     | Usage                                                |
| ---------------------- | --------- | ---------------------------------------------------- |
| `--color-bg`           | `#0A0A0A` | Main chat canvas background                          |
| `--color-surface`      | `#141414` | Sidebar, cards, input background                     |
| `--color-border`       | `#27272A` | All borders                                          |
| `--color-text-primary` | `#EDEDED` | Body text                                            |
| `--color-text-muted`   | `#A1A1AA` | Timestamps, thought process text                     |
| `--color-accent`       | `#FF8205` | Active states, submit button, thought process border |
| `--color-accent-hover` | `#FA500F` | Hover on accent elements                             |

Font: `Inter` (sans), `Geist Mono` (mono). Load via Google Fonts or local.

---

## 7. Dev Setup

### Prerequisites

- Docker + Docker Compose
- Or: Python 3.11+ with `uv` / `pip`, and Node.js 18+ with `bun`

### Environment

Copy `.env.example` to `backend/.env` and fill in:

```
MISTRAL_API_KEY=your_key_here
```

### Docker Compose

```yaml
# docker-compose.yaml (already exists — extend it)
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    volumes: ["./backend/data:/app/data"]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [backend]
```

### Local Dev (no Docker)

```bash
# Backend
cd backend && pip install -e . && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && bun install && bun run dev
```

---

## 8. Demo Script → SSE Event Mapping

| Demo Moment                              | SSE Event(s) Emitted                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Agent is thinking..."                   | `agent_start { agent: "interface" }` — Interface evaluates the question                                                                             |
| Interface decides to retrieve data       | `handoff { from: "interface", to: "scavenger" }` + `agent_start { agent: "scavenger" }`                                                             |
| `Tool called: search_notion_docs(...)`   | `tool_call { tool: "read_notion_mock", query: "login system" }`                                                                                     |
| `Tool called: search_slack_history(...)` | `tool_call { tool: "read_slack_mock", query: "login system auth" }`                                                                                 |
| `Synthesizing conflicts...`              | `handoff { from: "scavenger", to: "synthesizer" }` + `agent_start { agent: "synthesizer" }`                                                         |
| Synthesis complete, returning to UI      | `handoff { from: "synthesizer", to: "interface" }` + `agent_start { agent: "interface" }`                                                           |
| Final answer streams in                  | `token` × N, then `done`                                                                                                                            |
| Follow-up uses memory                    | Interface receives full `SESSION_HISTORY`, answers directly — only `agent_start { agent: "interface" }` + `token` × N + `done`, no handoffs emitted |
