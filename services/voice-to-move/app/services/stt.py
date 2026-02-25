"""
Cloud speech-to-text providers for voice-to-move.

Supports OpenAI, AssemblyAI, and Deepgram with environment-driven selection
and fallback behavior.
"""

from __future__ import annotations

import os
import time
import logging
from dataclasses import dataclass
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

STTProvider = Literal["openai", "assemblyai", "deepgram"]


class STTError(Exception):
    """Raised when no STT provider can return a transcript."""


@dataclass
class STTResult:
    provider: STTProvider
    transcript: str
    confidence: float | None = None
    latency_ms: int | None = None


def _env(name: str, fallback: str | None = None) -> str | None:
    return os.getenv(name, fallback)


def get_default_provider() -> STTProvider:
    value = (_env("STT_PROVIDER", "deepgram") or "deepgram").strip().lower()
    if value in ("openai", "assemblyai", "deepgram"):
        return value
    logger.warning("Unsupported STT_PROVIDER=%s, defaulting to deepgram", value)
    return "deepgram"


def get_enabled_providers() -> list[STTProvider]:
    providers: list[STTProvider] = []
    openai_enabled = (_env("OPENAI_STT_ENABLED", "false") or "false").strip().lower() == "true"
    if openai_enabled and _env("OPENAI_API_KEY"):
        providers.append("openai")
    if _env("ASSEMBLYAI_API_KEY") or _env("AssemblyAI_API_KEY"):
        providers.append("assemblyai")
    if _env("DEEPGRAM_API_KEY"):
        providers.append("deepgram")
    return providers


def _as_audio_file_tuple(data: bytes, filename: str = "voice.wav") -> tuple[str, bytes, str]:
    return filename, data, "audio/wav"


def _transcribe_openai(wav_bytes: bytes, timeout_seconds: float) -> STTResult:
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        raise STTError("OPENAI_API_KEY missing")

    model = _env("OPENAI_STT_MODEL", "whisper-1")
    url = _env("OPENAI_STT_URL", "https://api.openai.com/v1/audio/transcriptions")
    prompt = _env("OPENAI_STT_PROMPT", "Chess moves, SAN and UCI notation, English commands")

    start = time.perf_counter()
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            data={
                "model": model,
                "language": "en",
                "response_format": "verbose_json",
                "prompt": prompt,
                "temperature": "0",
            },
            files={"file": _as_audio_file_tuple(wav_bytes)},
        )

    latency = int((time.perf_counter() - start) * 1000)
    if response.status_code >= 400:
        raise STTError(f"OpenAI STT error: {response.status_code} {response.text[:240]}")

    payload = response.json()
    transcript = (payload.get("text") or "").strip()
    if not transcript:
        raise STTError("OpenAI returned empty transcript")

    return STTResult(provider="openai", transcript=transcript, confidence=None, latency_ms=latency)


def _transcribe_assemblyai(wav_bytes: bytes, timeout_seconds: float) -> STTResult:
    api_key = _env("ASSEMBLYAI_API_KEY") or _env("AssemblyAI_API_KEY")
    if not api_key:
        raise STTError("ASSEMBLYAI_API_KEY missing")

    models_csv = _env("ASSEMBLYAI_MODELS", "universal-3-pro,universal-2") or "universal-3-pro,universal-2"
    speech_models = [item.strip() for item in models_csv.split(",") if item.strip()]
    language_code = _env("ASSEMBLYAI_LANGUAGE", "en_us")
    poll_interval = float(_env("ASSEMBLYAI_POLL_INTERVAL_SECONDS", "0.9") or "0.9")
    max_wait = float(_env("ASSEMBLYAI_MAX_WAIT_SECONDS", "25") or "25")

    headers = {"authorization": api_key}
    start = time.perf_counter()

    with httpx.Client(timeout=timeout_seconds) as client:
        upload = client.post(
            "https://api.assemblyai.com/v2/upload",
            headers=headers,
            content=wav_bytes,
        )
        if upload.status_code >= 400:
            raise STTError(f"AssemblyAI upload error: {upload.status_code} {upload.text[:240]}")

        audio_url = upload.json().get("upload_url")
        if not audio_url:
            raise STTError("AssemblyAI upload_url missing")

        create = client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers={**headers, "content-type": "application/json"},
            json={
                "audio_url": audio_url,
                "speech_models": speech_models,
                "language_code": language_code,
                "punctuate": True,
                "format_text": True,
            },
        )
        if create.status_code >= 400:
            raise STTError(f"AssemblyAI transcript create error: {create.status_code} {create.text[:240]}")

        transcript_id = create.json().get("id")
        if not transcript_id:
            raise STTError("AssemblyAI transcript id missing")

        deadline = time.perf_counter() + max_wait
        last_status = "queued"
        text = ""
        confidence = None

        while time.perf_counter() < deadline:
            poll = client.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers,
            )
            if poll.status_code >= 400:
                raise STTError(f"AssemblyAI poll error: {poll.status_code} {poll.text[:240]}")

            payload = poll.json()
            last_status = payload.get("status", "unknown")
            if last_status == "completed":
                text = (payload.get("text") or "").strip()
                confidence = payload.get("confidence")
                break
            if last_status == "error":
                err = payload.get("error") or "unknown AssemblyAI error"
                raise STTError(f"AssemblyAI transcription error: {err}")

            time.sleep(poll_interval)

        if not text:
            raise STTError(f"AssemblyAI timed out or empty transcript (status={last_status})")

    latency = int((time.perf_counter() - start) * 1000)
    return STTResult(provider="assemblyai", transcript=text, confidence=confidence, latency_ms=latency)


def _transcribe_deepgram(wav_bytes: bytes, timeout_seconds: float) -> STTResult:
    api_key = _env("DEEPGRAM_API_KEY")
    if not api_key:
        raise STTError("DEEPGRAM_API_KEY missing")

    model = _env("DEEPGRAM_MODEL", "nova-3")
    language = _env("DEEPGRAM_LANGUAGE", "en")
    endpointing = (_env("DEEPGRAM_ENDPOINTING", "false") or "false").lower()
    keyterms_csv = _env(
        "DEEPGRAM_KEYTERMS",
        "chess,castle,kingside,queenside,checkmate,knight,bishop,rook,queen,pawn",
    )
    keyterms = [item.strip() for item in keyterms_csv.split(",") if item.strip()]

    query: list[tuple[str, str]] = [
        ("model", model),
        ("language", language),
        ("punctuate", "true"),
        ("smart_format", "true"),
        ("endpointing", endpointing),
    ]
    for keyterm in keyterms:
        query.append(("keyterm", keyterm))

    start = time.perf_counter()
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(
            "https://api.deepgram.com/v1/listen",
            params=query,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "audio/wav",
            },
            content=wav_bytes,
        )

    latency = int((time.perf_counter() - start) * 1000)
    if response.status_code >= 400:
        raise STTError(f"Deepgram error: {response.status_code} {response.text[:240]}")

    payload = response.json()
    try:
        alternative = payload["results"]["channels"][0]["alternatives"][0]
    except (KeyError, IndexError, TypeError):
        raise STTError("Deepgram response missing transcript") from None

    transcript = (alternative.get("transcript") or "").strip()
    confidence = alternative.get("confidence")
    if not transcript:
        raise STTError("Deepgram returned empty transcript")

    return STTResult(provider="deepgram", transcript=transcript, confidence=confidence, latency_ms=latency)


def transcribe_with_provider(
    wav_bytes: bytes,
    provider: STTProvider,
    *,
    timeout_seconds: float | None = None,
) -> STTResult:
    timeout = timeout_seconds or float(_env("STT_TIMEOUT_SECONDS", "30") or "30")
    if provider == "openai":
        return _transcribe_openai(wav_bytes, timeout)
    if provider == "assemblyai":
        return _transcribe_assemblyai(wav_bytes, timeout)
    if provider == "deepgram":
        return _transcribe_deepgram(wav_bytes, timeout)
    raise STTError(f"Unsupported provider: {provider}")


def transcribe_with_fallback(wav_bytes: bytes) -> STTResult:
    preferred = get_default_provider()
    enabled = get_enabled_providers()
    if not enabled:
        raise STTError(
            "No STT provider configured. Set one of OPENAI_API_KEY, ASSEMBLYAI_API_KEY, or DEEPGRAM_API_KEY"
        )

    ordered = [preferred] + [p for p in enabled if p != preferred]
    errors: list[str] = []

    for provider in ordered:
        if provider not in enabled:
            continue
        try:
            return transcribe_with_provider(wav_bytes, provider)
        except Exception as exc:
            msg = f"{provider}: {exc}"
            logger.warning("STT provider failed: %s", msg)
            errors.append(msg)

    raise STTError("All STT providers failed. " + " | ".join(errors))
