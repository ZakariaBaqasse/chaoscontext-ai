import json
import logging
from pathlib import Path

from mistralai import Mistral

from .config import settings
from .tools import TOOL_SCHEMAS

logger = logging.getLogger(__name__)

_AGENT_IDS_FILE = Path(__file__).parent.parent / ".agent_ids.json"

# ---------------------------------------------------------------------------
# Module-level state — populated once at startup via setup_agents()
# ---------------------------------------------------------------------------

client: Mistral = None  # type: ignore[assignment]

AGENTS: dict[str, str] = {}  # name → agent_id
AGENT_ID_TO_NAME: dict[str, str] = {}  # agent_id → name

# Model used for all agents
_MODEL = "mistral-medium-latest"

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_INTERFACE_PROMPT = """You are an AI assistant acting as an invisible project manager. \
You are the entry point for every user message AND the agent that delivers the final \
response to the user.

## Your decision on every turn

Read the user's message and the full conversation history, then choose ONE of two paths:

**Path A — Respond directly** (no handoff)
Use this when the question can be fully answered from the existing conversation history \
without consulting any external source. Examples: follow-up questions, clarifications, \
"what library should I use for that?", "can you summarise what you just said?".
Simply reply concisely and factually. Do NOT call any tools or trigger a handoff.

**Path B — Retrieve fresh data** (handoff to Scavenger)
Use this when the question requires looking up project documentation or Slack history \
that has not yet been retrieved in this conversation. Examples: first questions about a \
feature, spec, decision, or any topic not already present in the conversation history.
Do NOT attempt to answer. Instead, hand off immediately to the Scavenger agent without \
adding any commentary. The Scavenger will retrieve the data, the Synthesizer will \
reconcile it, and control will return to you with the findings — at which point you \
present the result clearly to the user.

## When presenting a Synthesizer result

You will recognise this situation because the conversation will contain a synthesis \
summary produced by the Synthesizer agent. Present that summary to the user in clear, \
developer-friendly language. Be concise and direct. Do not add filler phrases."""

_SCAVENGER_PROMPT = """You are a data retrieval agent. You are called exclusively when \
the Interface agent has determined that fresh data is needed to answer the user's question.

## Your job

Call BOTH available tools — read_notion_mock and read_slack_mock — for every query, \
regardless of what either returns. Use the user's original question as the search query \
for both tools.

## Rules

- Do NOT summarise, interpret, or add any commentary to the tool results.
- Do NOT attempt to answer the user's question yourself.
- Return the raw tool output exactly as received.
- Once both tools have been called, hand off immediately to the Synthesizer agent."""

_SYNTHESIZER_PROMPT = """You are a synthesis agent. You are called after the Scavenger \
agent has retrieved raw data from Notion and Slack.

## Your job

1. Compare the two raw results present in the conversation context.
2. Identify any conflicts or discrepancies between them.
3. Determine which source is more recent.
4. Produce a single concise "Source of Truth" summary that states:
   - What the original spec said.
   - What changed (if anything), citing the source and date.
   - The current authoritative recommendation.

## Rules

- Be direct and factual. No filler phrases.
- Do NOT address the user directly or add conversational framing — the Interface agent \
will handle that.
- Once your summary is written, hand off immediately to the Interface agent."""


# ---------------------------------------------------------------------------
# Startup function
# ---------------------------------------------------------------------------


async def setup_agents() -> None:
    """Create the three Mistral agents and wire their handoffs.

    Idempotent: if `.agent_ids.json` exists and the stored IDs are still valid
    on Mistral, the agents are reused and no new ones are created. New agents
    are only created when the file is absent or the stored IDs have been deleted.

    Called once from the FastAPI lifespan startup handler.
    """
    global client

    client = Mistral(api_key=settings.MISTRAL_API_KEY)

    # --- Try to reuse previously created agents ---
    if _AGENT_IDS_FILE.exists():
        try:
            saved = json.loads(_AGENT_IDS_FILE.read_text())
            # Verify each ID is still alive on Mistral
            for name in ("scavenger", "synthesizer", "interface"):
                client.beta.agents.get(agent_id=saved[name])
            # All valid — populate dicts and return early
            AGENTS.update(saved)
            AGENT_ID_TO_NAME.update({v: k for k, v in saved.items()})
            logger.info(
                "Reusing existing agents — scavenger=%s  synthesizer=%s  interface=%s",
                saved["scavenger"],
                saved["synthesizer"],
                saved["interface"],
            )
            return
        except Exception as exc:
            logger.warning("Stored agent IDs invalid (%s). Creating new agents.", exc)
            _AGENT_IDS_FILE.unlink(missing_ok=True)

    # --- Create fresh agents ---

    # 1. Scavenger — has both tools
    scavenger = client.beta.agents.create(
        model=_MODEL,
        name="Scavenger",
        instructions=_SCAVENGER_PROMPT,
        tools=TOOL_SCHEMAS,
    )
    logger.info("Scavenger agent created: %s", scavenger.id)

    # 2. Synthesizer — no tools
    synthesizer = client.beta.agents.create(
        model=_MODEL,
        name="Synthesizer",
        instructions=_SYNTHESIZER_PROMPT,
        tools=[],
    )
    logger.info("Synthesizer agent created: %s", synthesizer.id)

    # 3. Interface — no tools, orchestrator and terminal agent
    interface = client.beta.agents.create(
        model=_MODEL,
        name="Interface",
        instructions=_INTERFACE_PROMPT,
        tools=[],
    )
    logger.info("Interface agent created: %s", interface.id)

    # 4. Wire handoffs: Interface → Scavenger (entry point delegates retrieval)
    client.beta.agents.update(
        agent_id=interface.id,
        handoffs=[scavenger.id],
    )

    # 5. Wire handoffs: Scavenger → Synthesizer
    client.beta.agents.update(
        agent_id=scavenger.id,
        handoffs=[synthesizer.id],
    )

    # 6. Wire handoffs: Synthesizer → Interface (closes the loop)
    client.beta.agents.update(
        agent_id=synthesizer.id,
        handoffs=[interface.id],
    )

    # 7. Populate lookup dicts
    AGENTS["scavenger"] = scavenger.id
    AGENTS["synthesizer"] = synthesizer.id
    AGENTS["interface"] = interface.id

    AGENT_ID_TO_NAME[scavenger.id] = "scavenger"
    AGENT_ID_TO_NAME[synthesizer.id] = "synthesizer"
    AGENT_ID_TO_NAME[interface.id] = "interface"

    # 8. Persist IDs so subsequent startups skip creation
    _AGENT_IDS_FILE.write_text(
        json.dumps(
            {
                "scavenger": scavenger.id,
                "synthesizer": synthesizer.id,
                "interface": interface.id,
            },
            indent=2,
        )
    )

    logger.info(
        "All agents ready — scavenger=%s  synthesizer=%s  interface=%s",
        scavenger.id,
        synthesizer.id,
        interface.id,
    )
