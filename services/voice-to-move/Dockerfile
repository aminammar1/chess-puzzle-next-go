# ---- Build / Runtime stage ----
FROM python:3.14-slim AS runtime

# Install system deps: ffmpeg for audio conversion, plus common audio libs
RUN apt-get update && \
  apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv for blazing-fast dependency management
RUN pip install --no-cache-dir uv

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -m appuser

WORKDIR /app

# Install Python dependencies (cached layer — only re-runs when requirements change)
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# Copy application source
COPY . .

# Switch to non-root user
USER appuser

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8001/health || exit 1

# Run with uvicorn — production settings
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--log-level", "info"]
