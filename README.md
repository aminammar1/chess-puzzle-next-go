# Chess Puzzle Next

Next-level chess puzzle trainer powered by microservices, AI, and real-time session tracking.

Fresh puzzles from **multiple sources** — Lichess API, a 4M+ puzzle dataset, and an **AI-powered RAG pipeline** that picks the perfect puzzle for your request. Solve by clicking pieces, or just **speak your move**. Your voice is transcribed and converted into accurate chess notation automatically.

---

## Architecture

```
                          ┌──────────────────────────┐
                          │        Redis 8            │
                          │  Sessions · Daily Cache   │
                          │  Stats · LRU Eviction     │
                          └────────────┬─────────────┘
                                       │
  ┌─────────────────┐     ┌────────────┴─────────────┐     ┌───────────────────────┐
  │                 │     │                          │     │  NVIDIA Inference API  │
  │  Next.js 16     │────▶│   Puzzle Generator (Go)  │────▶│  Llama 3.3 70B        │
  │  React 19       │ REST│   Echo · Swagger · Redis  │     └───────────────────────┘
  │  Tailwind 4     │     │                          │
  └─────────────────┘     │                          │     ┌───────────────────────┐
                          │                          │────▶│  HuggingFace Datasets │
  ┌─────────────────┐     │                          │     │  Lichess/chess-puzzles │
  │  Voice-to-Move  │◀───│                          │     │  (~4M real puzzles)    │
  │  Python FastAPI  │     └──────────────────────────┘     └───────────────────────┘
  └─────────────────┘              │
                                   │
                          ┌────────┴─────────────────┐
                          │     Lichess API           │
                          │  Daily · By ID · By Diff  │
                          └──────────────────────────┘
```

---

## Puzzle Sources

| Source | Endpoint | Description |
|--------|----------|-------------|
| **Lichess API** | `GET /puzzle?difficulty=` | Real-time puzzles from Lichess, filtered by difficulty |
| **Lichess Daily** | `GET /puzzle/daily` | Puzzle of the day |
| **HuggingFace Dataset** | `GET /puzzle/dataset?difficulty=` | Random puzzle from the 4M+ Lichess/chess-puzzles dataset |
| **AI RAG** | `POST /puzzle/ai` | AI-selected puzzle using Retrieval-Augmented Generation (premium) |

---

## AI Feature — RAG Pipeline

The AI puzzle generator does **not** ask an LLM to invent chess positions (which would produce invalid puzzles). Instead, it uses a **Retrieval-Augmented Generation (RAG)** approach that guarantees every puzzle is real and validated.

### How It Works

```
User prompt: "a nice fork puzzle"
        │
        ▼
┌─── Step 1: Retrieval ────────────────────────────────────┐
│  Fetch 8 candidate puzzles from HuggingFace              │
│  Dataset: Lichess/chess-puzzles (~4M puzzles)             │
│  Filtered by requested difficulty (easy/medium/hard)      │
│  API: HuggingFace datasets-server (rows endpoint)        │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌─── Step 2: AI Selection ─────────────────────────────────┐
│  Send candidates (rating + themes only) to NVIDIA API     │
│  Model: meta/llama-3.3-70b-instruct                      │
│  Prompt: "Pick the best match" → {"selected_index": N}    │
│  Temperature: 0.2 · Max tokens: 128 · Timeout: 30s       │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌─── Step 3: Return ───────────────────────────────────────┐
│  Return the selected real Lichess puzzle                   │
│  Includes: FEN, moves, rating, themes, popularity         │
│  Fallback: first candidate if AI parsing fails            │
└──────────────────────────────────────────────────────────┘
```

### Why RAG?

- **100% valid puzzles** — every puzzle comes from the Lichess database, not AI hallucination
- **Fast** — ~3s total (1.5s retrieval + 1.5s inference), no heavy generation
- **Accurate** — the LLM only selects from pre-validated candidates, it doesn't generate positions
- **Lightweight prompt** — only rating + themes are sent (no FEN/moves), keeping token usage minimal

### Model

| Property | Value |
|----------|-------|
| Provider | NVIDIA Inference API |
| Model | `meta/llama-3.3-70b-instruct` |
| Parameters | 70B |
| Temperature | 0.2 |
| Max tokens | 128 |
| Timeout | 30s |
| API format | OpenAI-compatible (`/v1/chat/completions`) |

---

## Redis — Session & Cache Layer

Redis powers all stateful features. The service degrades gracefully if Redis is unavailable (puzzles still work, sessions don't).

### What Redis Stores

| Key Pattern | Data | TTL | Purpose |
|-------------|------|-----|---------|
| `session:{uuid}` | Full session state (FEN, moves, progress, hints, solved/failed) | 2 hours | Track puzzle-solving sessions |
| `daily-puzzle` | Cached daily puzzle from Lichess | Configurable | Avoid hitting Lichess API repeatedly |
| `stats:{metric}` | Integer counters | Permanent | Track usage statistics |

### Why Redis?

- **Speed** — sub-millisecond reads/writes for session updates during gameplay
- **TTL** — sessions auto-expire after 2 hours, no cleanup needed
- **Persistence** — AOF (Append Only File) enabled so data survives container restarts
- **Memory-safe** — capped at 128MB with LRU eviction policy
- **Optional** — the service prints `⚠ Redis unavailable — sessions disabled` and continues without it

### Session Lifecycle

```
POST /session         → Create session (UUID, puzzle data, timestamps)
GET  /session/:id     → Read session state
PUT  /session/:id     → Update progress (move index, solved, failed, hints)
DELETE /session/:id   → End session early
                        Auto-expires after 2h via Redis TTL
```

---

## Services

### puzzle-generator
**Go 1.25 · Echo · Swagger · Redis**

Smart puzzle orchestration service that fetches, filters, and serves puzzles from multiple sources. Handles session management, AI RAG pipeline, difficulty filtering, and duplicate avoidance.

Key packages:
- `pkg/nvidia` — NVIDIA Inference API client (OpenAI-compatible)
- `pkg/huggingface` — HuggingFace datasets-server client with batch fetching
- `pkg/lichess` — Lichess API client (daily, by-ID, by-difficulty)
- `pkg/redis` — Redis client for sessions, caching, and stats
- `internal/services` — RAG pipeline orchestration, prompt building, response parsing
- `internal/middleware` — Request logging, premium access control

### voice-to-move
**Python · FastAPI** — Spoken moves → legal chess moves with AI (work in progress)

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- A Lichess API token (optional but recommended)
- An NVIDIA API key (required for AI feature)

### Setup

```bash
# Clone the repo
git clone https://github.com/aminammar1/chess-puzzle-next-go.git
cd chess-puzzle-next-go

# Copy and fill in your API keys
cp services/puzzle-generator/.env.exemple services/puzzle-generator/.env

# Start everything
make docker-up          # attached (see logs)
make docker-up-detach   # or detached
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LICHESS_API_TOKEN` | No | — | Lichess API token for higher rate limits |
| `NVIDIA_API_KEY` | Yes (for AI) | — | NVIDIA Inference API key |
| `NVIDIA_MODEL` | No | `meta/llama-3.3-70b-instruct` | NVIDIA model to use |
| `NVIDIA_TIMEOUT` | No | `30s` | NVIDIA API timeout |
| `HUGGINGFACE_BASE_URL` | No | `https://datasets-server.huggingface.co` | HuggingFace datasets server |
| `HUGGINGFACE_DATASET` | No | `Lichess/chess-puzzles` | Dataset name |
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection URL |

### Makefile Commands

```bash
make help              # Show all targets
make docker-up         # Build and start (attached)
make docker-up-detach  # Build and start (detached)
make docker-down       # Stop containers
make docker-logs       # Tail logs
make redis-cli         # Open Redis CLI
make build             # Build Go binary locally
make test              # Run Go tests
make swagger           # Generate Swagger docs
```

### API Documentation

Swagger UI is available at `http://localhost:8080/swagger/index.html` when the service is running.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Zustand, Framer Motion |
| Backend | Go 1.25, Echo framework, Swagger |
| AI | NVIDIA Inference API, Llama 3.3 70B Instruct |
| Data | HuggingFace Datasets Server, Lichess API |
| Cache | Redis 8 (Alpine) with AOF persistence |
| Infra | Docker Compose, multi-stage Go builds |
| Voice | Python, FastAPI (WIP) |