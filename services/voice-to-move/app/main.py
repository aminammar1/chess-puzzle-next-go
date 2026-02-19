"""
Voice-to-Move Service – skeleton
=================================
Full implementation is part of a future milestone.
This module defines the FastAPI application instance and mounts all routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, voice

app = FastAPI(
    title="Voice to Move Service",
    description="Converts spoken chess moves to standard notation (UCI / SAN).",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(voice.router, prefix="/api/v1")
