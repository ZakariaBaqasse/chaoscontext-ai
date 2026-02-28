import asyncio
import json
import logging
import threading
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Callable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from . import agents as _agents
from .agents import AGENTS, setup_agents
from .config import settings
from .schemas import ChatRequest
from .tools import execute_tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory chat history  { session_id → [{"role": ..., "content": ...}, ...] }
# ---------------------------------------------------------------------------
SESSION_HISTORY: dict[str, list[dict[str, str]]] = {}


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — run startup logic before yielding."""
    logger.info("Starting up: creating Mistral agents...")
    await setup_agents()
    logger.info("Startup complete.")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    debug=settings.DEBUG,
    version=settings.PROJECT_VERSION,
    description="ChaosContext AI Backend",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------


def _sse(event_type: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event_type, "data": json.dumps(data)}


# ---------------------------------------------------------------------------
# Per-agent helpers (synchronous — called from background thread)
# ---------------------------------------------------------------------------


def _run_scavenger(user_message: str, emit: Callable) -> str:
    """Call the Scavenger agent, executing tool calls until it finishes.

    Returns the concatenated raw tool results (passed to Synthesizer).
    """
    messages: list[dict] = [{"role": "user", "content": user_message}]
    results_parts: list[str] = []

    while True:
        tool_calls_collected: list[Any] = []

        for chunk in _agents.client.agents.stream(
            agent_id=AGENTS["scavenger"],
            messages=messages,
        ):
            choice = chunk.data.choices[0]
            if choice.delta.tool_calls:
                tool_calls_collected.extend(choice.delta.tool_calls)
            finish_reason = choice.finish_reason
            if finish_reason and finish_reason != "tool_calls":
                # Scavenger produced a text conclusion — stop the loop
                return "\n\n".join(results_parts)

        if not tool_calls_collected:
            break  # nothing more to do

        # Append assistant turn with tool-call requests
        messages.append(
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls_collected
                ],
            }
        )

        # Execute each tool and emit SSE events
        for tc in tool_calls_collected:
            name: str = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, TypeError):
                args = {}
            query: str = args.get("query", "")

            emit("tool_call", {"agent": "scavenger", "tool": name, "query": query})
            result = execute_tool(name, query)
            emit("tool_result", {"agent": "scavenger", "tool": name, "result": result})
            results_parts.append(result)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": result,
                }
            )

    return "\n\n".join(results_parts)


def _run_synthesizer(scavenger_output: str) -> str:
    """Call the Synthesizer agent synchronously and return its text output."""
    resp = _agents.client.agents.complete(
        agent_id=AGENTS["synthesizer"],
        messages=[
            {
                "role": "user",
                "content": (
                    "Here is the raw data retrieved from Notion and Slack:\n\n"
                    f"{scavenger_output}\n\n"
                    "Please synthesize this data and produce a Source of Truth summary."
                ),
            }
        ],
    )
    return resp.choices[0].message.content or ""


def _run_interface(
    history: list[dict[str, str]],
    user_message: str,
    emit: Callable,
    synthesis: str | None = None,
) -> list[str]:
    """Stream the Interface agent's final response.

    When *synthesis* is provided (Path B), it is injected into the user
    message so Interface can present the synthesized findings.
    Returns the assembled token list for saving to history.
    """
    history_messages = [{"role": m["role"], "content": m["content"]} for m in history]

    if synthesis:
        user_content = (
            f"{user_message}\n\n"
            f"[Synthesizer Report — data retrieved from Notion and Slack]\n"
            f"{synthesis}"
        )
    else:
        user_content = user_message

    messages = [*history_messages, {"role": "user", "content": user_content}]

    tokens: list[str] = []
    for chunk in _agents.client.agents.stream(
        agent_id=AGENTS["interface"],
        messages=messages,
    ):
        choice = chunk.data.choices[0]
        if choice.delta.content:
            text = choice.delta.content
            tokens.append(text)
            emit("token", {"text": text})

    return tokens


# ---------------------------------------------------------------------------
# Synchronous orchestration loop (runs in a background thread)
# ---------------------------------------------------------------------------


def _sync_orchestrate(
    session_id: str,
    user_message: str,
    queue: asyncio.Queue,  # type: ignore[type-arg]
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Drive the full multi-agent pipeline and push SSE dicts into *queue*.

    Routing:
    - Path A (follow-up): SESSION_HISTORY non-empty → Interface answers directly.
    - Path B (fresh data needed): no prior history → full
      Interface → Scavenger → Synthesizer → Interface pipeline.
    """

    def emit(event_type: str, data: dict[str, Any]) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, _sse(event_type, data))

    history = SESSION_HISTORY.get(session_id, [])
    needs_pipeline = len(history) == 0

    try:
        if needs_pipeline:
            # ── Path B: full retrieval pipeline ──────────────────────────
            emit("agent_start", {"agent": "interface"})
            emit("handoff", {"from": "interface", "to": "scavenger"})
            emit("agent_start", {"agent": "scavenger"})

            scavenger_output = _run_scavenger(user_message, emit)

            emit("handoff", {"from": "scavenger", "to": "synthesizer"})
            emit("agent_start", {"agent": "synthesizer"})

            synthesis = _run_synthesizer(scavenger_output)

            emit("handoff", {"from": "synthesizer", "to": "interface"})
            emit("agent_start", {"agent": "interface"})

            tokens = _run_interface(history, user_message, emit, synthesis=synthesis)
        else:
            # ── Path A: Interface answers from conversation history ───────
            emit("agent_start", {"agent": "interface"})
            tokens = _run_interface(history, user_message, emit)

        # Persist turn to session history
        assembled = "".join(tokens)
        if assembled:
            turn_history = SESSION_HISTORY.setdefault(session_id, [])
            turn_history.append({"role": "user", "content": user_message})
            turn_history.append({"role": "assistant", "content": assembled})

    except Exception as exc:
        logger.exception("Orchestration error: %s", exc)
        emit("error", {"message": str(exc)})

    emit("done", {})
    loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel → consumer stops


# ---------------------------------------------------------------------------
# Async generator wrapper (consumes the thread's queue)
# ---------------------------------------------------------------------------


async def orchestrate(
    session_id: str, user_message: str
) -> AsyncGenerator[dict[str, str], None]:
    """Async generator that drives the sync loop in a thread and yields SSE dicts."""
    queue: asyncio.Queue[dict[str, str] | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    thread = threading.Thread(
        target=_sync_orchestrate,
        args=(session_id, user_message, queue, loop),
        daemon=True,
    )
    thread.start()

    while True:
        item = await queue.get()
        if item is None:
            break
        yield item


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "message": "ChaosContext AI API",
        "version": settings.PROJECT_VERSION,
        "docs": f"{settings.API_V1_STR}/docs",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
async def chat(request: ChatRequest) -> EventSourceResponse:
    """Stream a multi-agent response as Server-Sent Events.

    Each SSE frame carries an ``event`` type and a JSON ``data`` payload.
    See ``SPECS.md §4.7`` for the full event schema.
    """
    return EventSourceResponse(
        orchestrate(request.session_id, request.message),
        media_type="text/event-stream",
    )
