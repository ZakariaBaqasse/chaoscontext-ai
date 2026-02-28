import json
from pathlib import Path
from typing import Callable

DATA_DIR = Path(__file__).parent.parent / "data"


def read_notion_mock(query: str) -> str:
    """Search mock Notion docs for content matching the query keywords."""
    with open(DATA_DIR / "mock_notion.json", encoding="utf-8") as f:
        data = json.load(f)

    keywords = query.lower().split()
    for doc in data["docs"]:
        haystack = (doc["title"] + " " + doc["content"]).lower()
        if any(kw in haystack for kw in keywords):
            return (
                f"[Notion | {doc['title']} | Last updated: {doc['last_updated']}] "
                f"{doc['content']}"
            )

    return f"No relevant Notion document found for query: {query}"


def read_slack_mock(query: str) -> str:
    """Search mock Slack messages for content matching the query keywords."""
    with open(DATA_DIR / "mock_slack.json", encoding="utf-8") as f:
        data = json.load(f)

    keywords = query.lower().split()
    for msg in data["messages"]:
        haystack = msg["text"].lower()
        if any(kw in haystack for kw in keywords):
            return (
                f"[Slack | {msg['channel']} | {msg['user']} | {msg['date']}] "
                f"{msg['text']}"
            )

    return f"No relevant Slack message found for query: {query}"


# ---------------------------------------------------------------------------
# Tool dispatcher
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, Callable[[str], str]] = {
    "read_notion_mock": read_notion_mock,
    "read_slack_mock": read_slack_mock,
}


def execute_tool(name: str, query: str) -> str:
    fn = TOOL_REGISTRY.get(name)
    if not fn:
        return f"Unknown tool: {name}"
    return fn(query)


# ---------------------------------------------------------------------------
# JSON tool schemas — passed to Mistral on agent creation
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "read_notion_mock",
            "description": (
                "Search the Notion documentation for pages matching the given query. "
                "Returns the most relevant document content or a not-found message."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords to search for in Notion docs.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_slack_mock",
            "description": (
                "Search the Slack message history for messages matching the given query. "
                "Returns the most relevant message or a not-found message."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords to search for in Slack messages.",
                    }
                },
                "required": ["query"],
            },
        },
    },
]
