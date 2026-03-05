"""Health router – used by Docker and load balancers."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="voice-to-move", version="0.2.0")


@router.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "voice-to-move",
        "version": "0.2.0",
        "hint": "Use /api/v1/voice/* endpoints or /docs for API docs",
    }
