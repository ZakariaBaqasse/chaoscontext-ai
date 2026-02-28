from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SSEEvent(BaseModel):
    event: str
    data: dict
