"""
Voice router
=============
Accepts an audio file upload (push-to-talk) or a WebSocket audio stream,
transcribes speech using a configurable cloud STT provider, parses the
transcript into a chess move (SAN / UCI), and returns the result.

Supported audio formats: WAV, OGG, MP3, WEBM, FLAC (converted via ffmpeg).
"""

import json
import tempfile
import logging
import subprocess

from fastapi import APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, status, Query
from pydantic import BaseModel

from app.parser.move_parser import parse_transcript, ParsedMove
from app.services.stt import (
    STTError,
    get_default_provider,
    get_enabled_providers,
    transcribe_with_fallback,
    transcribe_with_provider,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])

# Supported MIME → file extension mapping
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


class STTBenchmarkItem(BaseModel):
    provider: str
    ok: bool
    transcript: str | None = None
    confidence: float | None = None
    latency_ms: int | None = None
    parsed_san: str | None = None
    parsed_uci: str | None = None
    error: str | None = None


class STTBenchmarkResponse(BaseModel):
    default_provider: str
    best_provider: str | None = None
    best_transcript: str | None = None
    best_confidence: float | None = None
    providers_tested: list[STTBenchmarkItem]


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------


def _audio_to_wav_bytes(audio_bytes: bytes, source_format: str) -> bytes:
    """Convert any supported audio format to WAV PCM bytes in memory."""
    with tempfile.NamedTemporaryFile(suffix=f".{source_format}", delete=True) as src:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as dst:
            src.write(audio_bytes)
            src.flush()

            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                src.name,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                dst.name,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                stderr = (result.stderr or "").strip()
                raise RuntimeError(stderr or "ffmpeg conversion failed")

            dst.seek(0)
            return dst.read()


def _boost_wav_for_soft_speech(wav_bytes: bytes) -> bytes:
    """
    Boost and normalize already-converted WAV for very quiet voices.
    Returns original bytes if enhancement fails.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as src:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as dst:
            src.write(wav_bytes)
            src.flush()

            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                src.name,
                "-af",
                "highpass=f=120,lowpass=f=3800,volume=2.4",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                dst.name,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.warning("Soft-speech boost skipped (ffmpeg): %s", (result.stderr or "").strip())
                return wav_bytes

            dst.seek(0)
            return dst.read()


def _normalize_wav_for_variable_volume(wav_bytes: bytes) -> bytes:
    """
    Normalize dynamics for users who alternate between very soft/loud speech.
    Returns original bytes if enhancement fails.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as src:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as dst:
            src.write(wav_bytes)
            src.flush()

            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                src.name,
                "-af",
                "highpass=f=120,lowpass=f=3800,acompressor=threshold=-24dB:ratio=3:attack=5:release=60,alimiter=limit=0.97",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                dst.name,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.warning("Variable-volume normalize skipped (ffmpeg): %s", (result.stderr or "").strip())
                return wav_bytes

            dst.seek(0)
            return dst.read()


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
    """Run cloud STT with fast-first behavior and selective enhancement fallback."""
    boosted_wav = _boost_wav_for_soft_speech(wav_bytes)
    normalized_wav = _normalize_wav_for_variable_volume(wav_bytes)
    candidates = [wav_bytes]
    if boosted_wav != wav_bytes:
        candidates.append(boosted_wav)
    if normalized_wav not in candidates:
        candidates.append(normalized_wav)

    results: list[tuple[str, float | None]] = []
    for index, candidate in enumerate(candidates):
        result = transcribe_with_fallback(candidate)
        if result.transcript:
            item = (result.transcript, result.confidence)
            results.append(item)
            if index == 0:
                # Fast path: keep latency low for common cases.
                # If confidence is unavailable (provider doesn't return it), accept first hit.
                # If confidence is strong enough, avoid extra enhancement passes.
                if result.confidence is None or result.confidence >= 0.58:
                    return item

    if not results:
        return "", None

    return max(results, key=lambda item: (item[1] if item[1] is not None else 0.45, len(item[0])))


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
    fast: bool = Query(False, description="Use low-latency single-pass STT for wake-word style commands"),
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
        if fast:
            result = transcribe_with_fallback(wav_bytes)
            transcript, confidence = result.transcript, result.confidence
        else:
            transcript, confidence = _transcribe_wav(wav_bytes)
        if not transcript:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "No speech detected. Try speaking more clearly.")
        logger.info("Transcript: %r (confidence=%.3f)", transcript, confidence or 0.0)
        return TranscriptResponse(
            raw_transcript=transcript,
            confidence=round(confidence, 4) if confidence else None,
        )
    except STTError as exc:
        logger.error("STT provider error: %s", exc)
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


@router.post(
    "/voice/stt-benchmark",
    response_model=STTBenchmarkResponse,
    status_code=status.HTTP_200_OK,
    summary="Benchmark all configured STT providers on one audio clip",
)
async def benchmark_stt(
    audio: UploadFile = File(..., description="Audio file (WAV, OGG, MP3, WEBM, FLAC)"),
) -> STTBenchmarkResponse:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded audio file is empty.")

    fmt = _detect_format(audio.content_type, audio.filename)
    try:
        wav_bytes = _audio_to_wav_bytes(audio_bytes, fmt)
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Could not decode audio. Ensure it is a valid {fmt.upper()} file.") from exc

    boosted_wav = _boost_wav_for_soft_speech(wav_bytes)
    normalized_wav = _normalize_wav_for_variable_volume(wav_bytes)
    variant = normalized_wav if normalized_wav != wav_bytes else boosted_wav

    enabled = get_enabled_providers()
    if not enabled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No STT provider configured. Set OPENAI_API_KEY, ASSEMBLYAI_API_KEY, or DEEPGRAM_API_KEY.",
        )

    items: list[STTBenchmarkItem] = []

    def score_candidate(transcript: str, confidence: float | None, latency_ms: int | None) -> float:
        parsed: ParsedMove = parse_transcript(transcript)
        parse_bonus = 0.25 if (parsed.san or parsed.uci) else 0.0
        confidence_base = confidence if confidence is not None else 0.45
        latency_penalty = (latency_ms or 0) / 25000
        return confidence_base + parse_bonus - latency_penalty

    best_provider: str | None = None
    best_transcript: str | None = None
    best_confidence: float | None = None
    best_score = -10.0

    for provider in enabled:
        try:
            primary = transcribe_with_provider(wav_bytes, provider)
            chosen = primary
            if not primary.transcript and variant != wav_bytes:
                alt = transcribe_with_provider(variant, provider)
                chosen = alt if alt.transcript else primary

            parsed = parse_transcript(chosen.transcript)
            item = STTBenchmarkItem(
                provider=provider,
                ok=True,
                transcript=chosen.transcript,
                confidence=chosen.confidence,
                latency_ms=chosen.latency_ms,
                parsed_san=parsed.san,
                parsed_uci=parsed.uci,
            )
            items.append(item)

            current_score = score_candidate(chosen.transcript, chosen.confidence, chosen.latency_ms)
            if current_score > best_score:
                best_score = current_score
                best_provider = provider
                best_transcript = chosen.transcript
                best_confidence = chosen.confidence
        except Exception as exc:
            items.append(STTBenchmarkItem(provider=provider, ok=False, error=str(exc)))

    return STTBenchmarkResponse(
        default_provider=get_default_provider(),
        best_provider=best_provider,
        best_transcript=best_transcript,
        best_confidence=best_confidence,
        providers_tested=items,
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
