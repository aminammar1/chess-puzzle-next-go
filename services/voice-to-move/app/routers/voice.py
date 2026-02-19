"""
Voice router – skeleton
========================
These endpoints are placeholders. The full implementation (audio transcription,
move parsing, UCI/SAN normalisation) is planned for a future milestone.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel

router = APIRouter(tags=["voice"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class MoveResponse(BaseModel):
    """Parsed chess move returned to the client."""

    raw_transcript: str
    uci: str | None = None  # e.g. "e2e4"
    san: str | None = None  # e.g. "e4"
    confidence: float | None = None  # 0.0 – 1.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/voice/move",
    response_model=MoveResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert a voice recording to a chess move",
    description=(
        "**Not yet implemented.** "
        "Upload a WAV/OGG audio clip containing a spoken chess move. "
        "The service will transcribe the audio and return the corresponding "
        "UCI and SAN notation."
    ),
)
async def voice_to_move(
    audio: UploadFile = File(..., description="Audio file (WAV or OGG)"),
) -> MoveResponse:
    """
    TODO (future milestone):
      1. Accept audio upload (WAV / OGG / MP3).
      2. Transcribe with Whisper or a similar STT model.
      3. Parse the transcript into a legal chess move.
      4. Return UCI + SAN representations.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Voice-to-move processing is not yet implemented.",
    )
