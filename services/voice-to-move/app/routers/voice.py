"""
Voice router
=============
Accepts an audio file upload (push-to-talk) or a WebSocket audio stream,
transcribes speech using SpeechRecognition (Google free tier), parses the
transcript into a chess move (SAN / UCI), and returns the result.

Supported audio formats: WAV, OGG, MP3, WEBM, FLAC (converted via pydub/ffmpeg).
"""

import io
import json
import tempfile
import logging

import speech_recognition as sr
from pydub import AudioSegment
from fastapi import APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.parser.move_parser import parse_transcript, ParsedMove

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
    """Parsed chess move returned to the client."""

    raw_transcript: str
    san: str | None = None   # e.g. "Nf3", "e4", "O-O"
    uci: str | None = None   # e.g. "e2e4", "e1g1"
    promotion: str | None = None  # "q", "r", "b", "n"
    confidence: float | None = None  # 0.0 – 1.0


class ParseTextRequest(BaseModel):
    """Plain text to parse into a chess move (no audio)."""

    text: str


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------


def _audio_to_wav_bytes(audio_bytes: bytes, source_format: str) -> bytes:
    """Convert any supported audio format to WAV PCM bytes in memory."""
    segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=source_format)
    # 16-bit mono 16 kHz – optimal for speech recognition
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
    return "wav"


def _transcribe_wav(wav_bytes: bytes) -> tuple[str, float | None]:
    """Run Google Speech Recognition on raw WAV bytes. Returns (transcript, confidence)."""
    recognizer = sr.Recognizer()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        tmp.write(wav_bytes)
        tmp.flush()
        with sr.AudioFile(tmp.name) as source:
            audio_data = recognizer.record(source)

    result = recognizer.recognize_google(audio_data, language="en-US", show_all=True)
    if not result:
        return "", None

    best = result["alternative"][0]
    transcript = best.get("transcript", "")
    confidence = best.get("confidence", None)
    return transcript, confidence


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/voice/transcribe",
    response_model=TranscriptResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe an audio file to text",
)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file (WAV, OGG, MP3, WEBM, FLAC)"),
) -> TranscriptResponse:
    """Upload an audio clip → get the raw transcript."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded audio file is empty.")

    logger.info("Received audio: filename=%s  type=%s  size=%d",
                audio.filename, audio.content_type, len(audio_bytes))

    fmt = _detect_format(audio.content_type, audio.filename)
    try:
        wav_bytes = _audio_to_wav_bytes(audio_bytes, fmt)
    except Exception as exc:
        logger.error("Audio conversion failed: %s", exc)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Could not decode audio. Ensure it is a valid {fmt.upper()} file.")

    try:
        transcript, confidence = _transcribe_wav(wav_bytes)
        if not transcript:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "No speech detected. Try speaking more clearly.")
        logger.info("Transcript: %r (confidence=%.3f)", transcript, confidence or 0.0)
        return TranscriptResponse(
            raw_transcript=transcript,
            confidence=round(confidence, 4) if confidence else None,
        )
    except sr.UnknownValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Could not understand the audio.")
    except sr.RequestError as exc:
        logger.error("Google Speech API error: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            f"Speech recognition service unavailable: {exc}")


@router.post(
    "/voice/move",
    response_model=MoveResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe audio and parse chess move (push-to-talk)",
)
async def voice_to_move(
    audio: UploadFile = File(..., description="Audio file (WAV, OGG, MP3, WEBM, FLAC)"),
) -> MoveResponse:
    """Upload an audio clip → get the parsed chess move (SAN + UCI)."""
    result = await transcribe_audio(audio)
    parsed = parse_transcript(result.raw_transcript)

    return MoveResponse(
        raw_transcript=result.raw_transcript,
        san=parsed.san,
        uci=parsed.uci,
        promotion=parsed.promotion,
        confidence=result.confidence,
    )


@router.post(
    "/voice/parse",
    response_model=MoveResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse plain text into a chess move (no audio)",
)
async def parse_text(body: ParseTextRequest) -> MoveResponse:
    """
    Send raw text (e.g. from the browser's own SpeechRecognition)
    and get back the parsed chess move.
    """
    parsed = parse_transcript(body.text)
    return MoveResponse(
        raw_transcript=body.text,
        san=parsed.san,
        uci=parsed.uci,
        promotion=parsed.promotion,
        confidence=parsed.confidence,
    )


# ---------------------------------------------------------------------------
# WebSocket – real-time push-to-talk
# ---------------------------------------------------------------------------


@router.websocket("/voice/ws")
async def voice_ws(ws: WebSocket):
    """
    Real-time voice-to-move over WebSocket.

    Protocol
    --------
    1. Client connects to  ws://.../api/v1/voice/ws
    2. Client sends a JSON config message (optional):
       {"format": "webm", "sampleRate": 16000}
    3. Client sends raw audio bytes (binary frames) while user is speaking.
    4. Client sends a JSON text frame: {"action": "end"}  when user stops.
    5. Server responds with a JSON frame containing the parsed move:
       {"raw_transcript": "...", "san": "Nf3", "uci": null, "confidence": 0.92}
    6. Loop back to step 3 for the next move, or close the connection.
    """
    await ws.accept()
    logger.info("WebSocket client connected")

    audio_format = "webm"  # default; browser MediaRecorder usually sends webm

    try:
        while True:
            audio_chunks: list[bytes] = []

            # --- Receive audio frames until "end" signal ---
            while True:
                message = await ws.receive()

                if message.get("type") == "websocket.disconnect":
                    return

                # Text frame – could be config or end signal
                if "text" in message:
                    data = json.loads(message["text"])
                    if data.get("action") == "end":
                        break
                    # Config message
                    if "format" in data:
                        audio_format = data["format"]
                        logger.info("WS audio format set to: %s", audio_format)
                    continue

                # Binary frame – audio data
                if "bytes" in message:
                    audio_chunks.append(message["bytes"])

            if not audio_chunks:
                await ws.send_json({"error": "No audio data received."})
                continue

            raw_audio = b"".join(audio_chunks)
            logger.info("WS received %d bytes of %s audio", len(raw_audio), audio_format)

            # Convert & transcribe
            try:
                wav_bytes = _audio_to_wav_bytes(raw_audio, audio_format)
                transcript, confidence = _transcribe_wav(wav_bytes)
            except Exception as exc:
                logger.error("WS transcription error: %s", exc)
                await ws.send_json({"error": f"Transcription failed: {exc}"})
                continue

            if not transcript:
                await ws.send_json({"error": "No speech detected."})
                continue

            # Parse move
            parsed = parse_transcript(transcript)
            await ws.send_json({
                "raw_transcript": transcript,
                "san": parsed.san,
                "uci": parsed.uci,
                "promotion": parsed.promotion,
                "confidence": round(confidence, 4) if confidence else None,
            })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        await ws.close(code=1011, reason=str(exc))
