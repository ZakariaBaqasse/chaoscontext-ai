# 📄 PRD: ChaosContext AI (Hackathon PoC)

## 1. The Core Objective

Build an "Invisible PM" that synthesizes chaotic, scattered startup communications (Slack) and outdated documentation (Notion) into a single, accurate source of truth for developers, eliminating the need for manual ticketing systems.

## 2. The "Golden Demo" Scenario (Defines "Done")

This is the exact 60-second interaction to record for the final pitch video.

* **User (You):** Opens the React UI and types: *"I'm starting on the login system. What's the final spec?"*
* **The UI (Streaming State):**
* Shows: `Agent is thinking...`
* Shows: `Tool called: search_notion_docs("login system")`
* Shows: `Tool called: search_slack_history("login system auth")`
* Shows: `Synthesizing conflicts...`


* **The AI Output:** *"According to the Notion spec from last month, we were supposed to build Email/Password auth. However, based on a Slack message from the CEO yesterday in the #engineering channel, the requirement changed to **Google OAuth only** for the MVP. I recommend building the Google OAuth. I have saved this decision to your context memory."*
* **User (Follow-up to prove Memory):** *"Got it. What library should I use for that?"*
* **The AI Output:** *"Since you are building the Google OAuth we just discussed, use `react-oauth/google` for the frontend and `authlib` for FastAPI."*

## 3. Architecture & Tech Stack

* **Frontend:** React (Vite) + Tailwind CSS.
* *Scope:* A simple, sleek chat interface. It must visually display the "Thought Process" (tool calls) separate from the final text answer.


* **Backend:** Python (FastAPI).
* *Scope:* One main `POST /chat` endpoint. It receives the prompt, orchestrates the Mistral Agent, and returns the response.


* **AI:** Mistral Agents API.
* *Scope:* Use the Mistral UI Agent Builder on La Plateforme to define the agent's instructions, then call it in FastAPI using its `agent_id`.


* **Database:** NONE.
* *Scope:* Use local JSON files to mock external APIs. Use a global Python dictionary (or React state) to hold the chat history (Memory).



## 4. The Mock Data Schema

Create a folder in your FastAPI project called `data/` and add these two files.

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

## 5. Agent Tools (FastAPI Functions)

You will write two simple Python functions in FastAPI and provide them as Tools to the Mistral Agent.

1. `read_notion_mock(query: str)`: Opens `mock_notion.json`, checks if the query matches the title or content, and returns the string.
2. `read_slack_mock(query: str)`: Opens `mock_slack.json`, checks for keyword matches, and returns the message string with the date.
