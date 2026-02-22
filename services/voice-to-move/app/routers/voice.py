"""
Voice router
=============
Accepts an audio file upload, transcribes it using the SpeechRecognition
library (Google free tier), and returns the raw transcript text.

Supported formats: WAV, OGG, MP3, WEBM, FLAC (converted via pydub/ffmpeg).
"""

import io
import tempfile
import logging

import speech_recognition as sr
from pydub import AudioSegment
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])

# Supported MIME → pydub format mapping
_MIME_TO_FORMAT: dict[str, str] = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
}

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TranscriptResponse(BaseModel):
    """Raw speech-to-text result returned to the client."""

    raw_transcript: str
    confidence: float | None = None  # 0.0 – 1.0


class MoveResponse(BaseModel):
    """Parsed chess move returned to the client (future use)."""

    raw_transcript: str
    uci: str | None = None  # e.g. "e2e4"
    san: str | None = None  # e.g. "e4"
    confidence: float | None = None  # 0.0 – 1.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _audio_to_wav_bytes(audio_bytes: bytes, source_format: str) -> bytes:
    """Convert any supported audio format to WAV PCM bytes in memory."""
    segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=source_format)
    # Ensure 16-bit mono 16 kHz – optimal for speech recognition
    segment = segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    buf = io.BytesIO()
    segment.export(buf, format="wav")
    return buf.getvalue()


def _detect_format(content_type: str | None, filename: str | None) -> str:
    """Resolve the audio format from MIME type or file extension."""
    if content_type and content_type in _MIME_TO_FORMAT:
        return _MIME_TO_FORMAT[content_type]

    if filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in ("wav", "ogg", "mp3", "flac", "webm", "mp4"):
            return ext

    # Default fallback – let pydub/ffmpeg guess
    return "wav"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/voice/transcribe",
    response_model=TranscriptResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe an audio file to text",
    description=(
        "Upload a WAV, OGG, MP3, WEBM or FLAC audio clip. "
        "The service will transcribe the audio using Google Speech Recognition "
        "and return the raw text."
    ),
)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file (WAV, OGG, MP3, WEBM, FLAC)"),
) -> TranscriptResponse:
    """
    1. Read the uploaded audio file.
    2. Convert to WAV PCM if needed (via pydub + ffmpeg).
    3. Transcribe using Google Speech Recognition (free tier).
    4. Return the raw transcript and confidence score.
    """
    # --- Read upload ---
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    logger.info(
        "Received audio: filename=%s  content_type=%s  size=%d bytes",
        audio.filename,
        audio.content_type,
        len(audio_bytes),
    )

    # --- Convert to WAV ---
    fmt = _detect_format(audio.content_type, audio.filename)
    try:
        wav_bytes = _audio_to_wav_bytes(audio_bytes, fmt)
    except Exception as exc:
        logger.error("Audio conversion failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not decode audio file. Ensure it is a valid {fmt.upper()} file.",
        )

    # --- Transcribe ---
    recognizer = sr.Recognizer()
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
            tmp.write(wav_bytes)
            tmp.flush()
            with sr.AudioFile(tmp.name) as source:
                audio_data = recognizer.record(source)

        # Use Google free STT – returns best transcript
        result = recognizer.recognize_google(
            audio_data, language="en-US", show_all=True
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Speech recognition returned no results. Try speaking more clearly.",
            )

        # result is a dict with "alternative" list when show_all=True
        best = result["alternative"][0]
        transcript = best.get("transcript", "")
        confidence = best.get("confidence", None)

        logger.info("Transcript: %r (confidence=%.3f)", transcript, confidence or 0.0)

        return TranscriptResponse(
            raw_transcript=transcript,
            confidence=round(confidence, 4) if confidence else None,
        )

    except sr.UnknownValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not understand the audio. Please speak clearly and try again.",
        )
    except sr.RequestError as exc:
        logger.error("Google Speech API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech recognition service unavailable: {exc}",
        )


@router.post(
    "/voice/move",
    response_model=MoveResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert a voice recording to a chess move",
    description=(
        "Upload a WAV/OGG audio clip containing a spoken chess move. "
        "The service will transcribe the audio and return the corresponding "
        "UCI and SAN notation. (Move parsing coming in a future milestone.)"
    ),
)
async def voice_to_move(
    audio: UploadFile = File(..., description="Audio file (WAV or OGG)"),
) -> MoveResponse:
    """
    Transcribes the audio and returns raw transcript.
    Move parsing (UCI/SAN) will be added in a future iteration.
    """
    result = await transcribe_audio(audio)
    return MoveResponse(
        raw_transcript=result.raw_transcript,
        confidence=result.confidence,
        # UCI/SAN parsing will be implemented next
        uci=None,
        san=None,
    )
