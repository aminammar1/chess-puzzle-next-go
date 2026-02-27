# ♔ Chess Puzzle Next

> Next-level chess puzzle trainer powered by microservices, AI, voice control, and real-time session tracking.

Fresh puzzles from **multiple sources** — Lichess API, a 4M+ puzzle dataset, and an **AI-powered RAG pipeline** that picks the perfect puzzle for your request. Solve by clicking pieces, or just **speak your move** — your voice is transcribed and converted into accurate chess notation automatically.

---

## Table of Contents

- [Architecture](#architecture)
- [Puzzle Generator Diagram](#puzzle-generator-diagram)
- [Puzzle Sources](#puzzle-sources)
- [AI Feature — RAG Pipeline](#ai-feature--rag-pipeline)
- [Voice-to-Move](#voice-to-move--how-it-works)
- [API Gateway](#api-gateway)
- [Redis — Session & Cache](#redis--session--cache-layer)
- [Services](#services)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Makefile Commands](#makefile-commands)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## Architecture

```
                         ┌─────────────────────────┐
                         │       Client (Web)      │
                         │   Next.js 16 · React 19 │
                         │   Tailwind 4            │
                         └────────────┬────────────┘
                                      │ HTTPS
                         ┌────────────▼────────────┐
                         │       API Gateway       │
                         │        Nginx            │
                         └────────────┬────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
  ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
  │ Puzzle Service│           │ Voice Service │           │  Future Svc   │
  │ Go · Echo     │           │ Python        │           │  (optional)   │
  │ Swagger       │           │ FastAPI       │           │               │
  └───────┬───────┘           └───────┬───────┘           └───────────────┘
          │                           │
          └───────────────┬───────────┘
                          │
                  ┌───────────────┐
                  │    Redis 8    │
                  │ Sessions      │
                  │ Cache (LRU)   │
                  │ Stats         │
                  └───────────────┘


                 ───────── External Providers ─────────

        ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
        │ Hugging Face  │   │ NVIDIA Inference│   │ Lichess API    │
        │ ~4M puzzles   │   │ Llama 3.3 70B   │   │ Games / Data   │
        └───────────────┘   └────────────────┘   └────────────────┘
```

## Puzzle Generator Diagram

![Puzzle Generator Diagram](./puzzle-generator-app.excalidraw.png)

---

## Puzzle Sources

| Source | Endpoint | Description |
|--------|----------|-------------|
| **Lichess API** | `GET /api/v1/puzzle?difficulty=` | Real-time puzzles from Lichess, filtered by difficulty |
| **Lichess Daily** | `GET /api/v1/puzzle/daily` | Puzzle of the day |
| **HuggingFace Dataset** | `GET /api/v1/puzzle/dataset?difficulty=` | Random puzzle from the 4M+ Lichess/chess-puzzles dataset |
| **AI RAG** | `POST /api/v1/puzzle/ai` | AI-selected puzzle using Retrieval-Augmented Generation (premium) |

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

- **100% valid puzzles** — every puzzle comes from the Lichess database
- **Fast** — ~3s total (1.5s retrieval + 1.5s inference)
- **Accurate** — the LLM selects from pre-validated candidates
- **Lightweight** — only rating + themes are sent, minimal token usage

### Model

| Property | Value |
|----------|-------|
| Provider | NVIDIA Inference API |
| Model | `meta/llama-3.3-70b-instruct` |
| Parameters | 70B |
| Temperature | 0.2 |
| Max tokens | 128 |

---

## Voice-to-Move — How It Works

The voice system lets you play chess by speaking: say **"knight to f3"** and the piece moves. It supports two speech-to-text paths and a custom NLP parser that converts natural language into SAN/UCI notation.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                        │
│                                                              │
│   Path A: Browser STT                Path B: Server STT      │
│   ┌──────────────────────┐          ┌──────────────────────┐ │
│   │ webkitSpeechRecognition│         │ MediaRecorder API    │ │
│   │ (Chrome/Edge)         │         │ (records WebM audio) │ │
│   └──────────┬───────────┘         └──────────┬───────────┘ │
│              │ text                            │ audio blob   │
│              ▼                                 ▼              │
│   POST /voice/parse              POST /voice/move            │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│              Voice-to-Move Service (FastAPI)                  │
│                                                              │
│  /voice/parse  ──→  move_parser.parse_transcript(text)       │
│  /voice/move   ──→  ffmpeg → Cloud STT → parse_transcript   │
│  /voice/ws     ──→  WebSocket real-time push-to-talk         │
│  /voice/stt-benchmark ─→ compare OpenAI/AssemblyAI/Deepgram │
└──────────────────────────────────────────────────────────────┘
```

### Two STT Paths

| Path | When Used | How |
|------|-----------|-----|
| **Browser STT** (Path A) | Default on Chrome/Edge | Uses `webkitSpeechRecognition` for real-time transcription |
| **Server STT** (Path B) | Fallback (Firefox, no HTTPS) | Records audio via `MediaRecorder`, uploads to server |

The client auto-detects capability and switches automatically.

### Move Parser

The NLP engine (`move_parser.py`) converts free-form English into chess notation using a **two-pass regex pipeline**:

**Pass 1 — Normalization:**
- Filler word removal: "um", "please", "play the" → stripped
- Number words → digits: "four" → "4"
- Piece synonyms: "horse" / "night" / "tower" → standard names
- NATO phonetic: "alpha" → "a", "echo" → "e"
- Accent-friendly variants: "eh", "si", "tree", "ait"

**Pass 2 — Pattern matching** (most specific → least specific):
1. Castling: "castle king side", "short castle" → `O-O`
2. `{square} to {square}` → UCI (e.g. "e2 to e4" → `e2e4`)
3. `{piece} {square} to {square}` → UCI + SAN
4. `{piece} takes {square}` → SAN capture
5. `{file} takes {square}` → pawn capture
6. `{piece} {square}` → SAN
7. `{square}` alone → pawn move
8. Promotion: "promote to queen" → `=Q`
9. Check/Checkmate annotations

### Supported Voice Commands

| Spoken Phrase | Parsed SAN | Parsed UCI |
|---------------|-----------|-----------|
| "e2 to e4" | e4 | e2e4 |
| "knight to f3" | Nf3 | — |
| "bishop takes d5" | Bxd5 | — |
| "castle king side" | O-O | e1g1 |
| "queen h5 check" | Qh5+ | — |
| "rook a1 to a8" | Ra8 | a1a8 |
| "a takes b4" | axb4 | — |
| "promote to queen" | =Q | — |

### Listening Modes

| Mode | Behavior |
|------|----------|
| **Push-to-talk** | Tap mic → speak → result. One move at a time. |
| **Auto / Continuous** | Auto-starts when puzzle begins, pauses on recognized move, reactivates for next move. |

### Accessibility

- ARIA live regions announce move results to screen readers
- Auto-listen mode enables hands-free play for visually impaired users
- Keyboard navigable: all controls are focusable and operable
- Voice examples provided as guidance text

### Voice API Endpoints

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| `POST` | `/voice/v1/voice/transcribe` | Audio file (multipart) | `{ raw_transcript, confidence }` |
| `POST` | `/voice/v1/voice/move` | Audio file (multipart) | `{ raw_transcript, san, uci, promotion, confidence }` |
| `POST` | `/voice/v1/voice/parse` | `{ text }` (JSON) | `{ raw_transcript, san, uci, promotion, confidence }` |
| `WS`   | `/voice/v1/voice/ws` | Binary audio frames | JSON move result per turn |

---

## API Gateway

All client requests flow through a single **nginx-based API gateway** (port 3100) that handles:

- **Reverse proxy** routing to puzzle-generator and voice-to-move services
- **CORS** headers (configured globally)
- **WebSocket** upgrade for real-time voice streaming
- **Health** endpoint at `/health`

### Routes

| Gateway Path | Target Service | Description |
|-------------|----------------|-------------|
| `/api/v1/*` | puzzle-generator:8080 | Puzzle, session, and health endpoints |
| `/voice/v1/*` | voice-to-move:8001 | Voice transcription and parsing |
| `/voice/v1/voice/ws` | voice-to-move:8001 | WebSocket voice stream |
| `/swagger/*` | puzzle-generator:8080 | Swagger UI |
| `/voice/docs` | voice-to-move:8001 | FastAPI docs |
| `/health` | (gateway itself) | Gateway health check |

### Future Services

The gateway config includes placeholder blocks for:
- **Game Service** — real-time chess games
- **Chat Service** — player communication
- **History Service** — game/puzzle history

---

## Redis — Session & Cache Layer

Redis powers all stateful features. The service degrades gracefully if Redis is unavailable.

### What Redis Stores

| Key Pattern | Data | TTL | Purpose |
|-------------|------|-----|---------|
| `session:{uuid}` | Full session state | 2 hours | Track puzzle-solving sessions |
| `daily-puzzle` | Cached daily puzzle | Configurable | Avoid repeated Lichess API calls |
| `stats:{metric}` | Integer counters | Permanent | Track usage statistics |

### Session Lifecycle

```
POST /session         → Create session (UUID, puzzle data)
GET  /session/:id     → Read session state
PUT  /session/:id     → Update progress
DELETE /session/:id   → End session early
                        Auto-expires after 2h via Redis TTL
```

---

## Services

### puzzle-generator
**Go 1.25 · Echo · Swagger · Redis**

Smart puzzle orchestration. Key packages:
- `pkg/nvidia` — NVIDIA Inference API client
- `pkg/huggingface` — HuggingFace datasets-server client
- `pkg/lichess` — Lichess API client
- `pkg/redis` — Redis client for sessions/caching
- `internal/services` — RAG pipeline orchestration

### voice-to-move
**Python 3.14 · FastAPI · ffmpeg · OpenAI/AssemblyAI/Deepgram STT**

Voice-to-chess-move pipeline with accent-aware NLP parsing, noise filtering, and dual STT support (browser + server).

### api-gateway
**nginx 1.27** — Reverse proxy gateway. Single entry point for all services.

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** (required)
- **Node.js 22+** (for local client dev)
- **Go 1.25+** (for local puzzle-generator dev)
- **Python 3.14+** (for local voice-to-move dev)
- A Lichess API token (optional, for higher rate limits)
- An NVIDIA API key (required for AI feature)

### Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/aminammar1/chess-puzzle-next-go.git
cd chess-puzzle-next-go

# Copy and fill in your API keys
cp services/puzzle-generator/.env.exemple services/puzzle-generator/.env
# Edit .env and add your NVIDIA_API_KEY

# Start everything (Redis + Puzzle Generator + Voice + Gateway)
make docker-up          # attached (see logs)
make docker-up-detach   # or detached

# Start the Next.js client (separate terminal)
make client-dev
```

### Local Development (without Docker)

```bash
# 1. Puzzle Generator
make build && make run

# 2. Voice-to-Move
make voice-install && make voice-dev

# 3. Next.js Client
cd client && npm install && npm run dev

# Or run all three in parallel:
make dev
```

### Verify Setup

```bash
make check-env          # Check required .env files exist
curl localhost:8080/health    # Puzzle service
curl localhost:8001/health    # Voice service
curl localhost:3100/health    # API Gateway (Docker only)
```

---

## Environment Variables

### Puzzle Generator (`services/puzzle-generator/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LICHESS_API_TOKEN` | No | — | Lichess API token for higher rate limits |
| `NVIDIA_API_KEY` | Yes (for AI) | — | NVIDIA Inference API key |
| `NVIDIA_MODEL` | No | `meta/llama-3.3-70b-instruct` | Model to use |
| `NVIDIA_TIMEOUT` | No | `30s` | API timeout |
| `HUGGINGFACE_BASE_URL` | No | `https://datasets-server.huggingface.co` | Datasets server |
| `HUGGINGFACE_DATASET` | No | `Lichess/chess-puzzles` | Dataset name |
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection URL |

### Client (`client/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8080/api/v1` | Direct puzzle API URL |
| `NEXT_PUBLIC_VOICE_URL` | No | `http://localhost:8001` | Direct voice API URL |
| `NEXT_PUBLIC_GATEWAY_URL` | No | — | Gateway URL (overrides direct URLs) |

### Voice-to-Move (`services/voice-to-move/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STT_PROVIDER` | No | `deepgram` | Preferred server STT provider (`openai`, `assemblyai`, `deepgram`) |
| `STT_TIMEOUT_SECONDS` | No | `30` | Timeout for STT HTTP calls |
| `OPENAI_API_KEY` | Yes* | — | OpenAI API key for `/audio/transcriptions` |
| `OPENAI_STT_MODEL` | No | `whisper-1` | OpenAI STT model |
| `OPENAI_STT_PROMPT` | No | Chess prompt | Prompt to bias recognition toward chess terms |
| `ASSEMBLYAI_API_KEY` | Yes* | — | AssemblyAI API key |
| `ASSEMBLYAI_MODELS` | No | `universal-3-pro,universal-2` | Priority list of AssemblyAI speech models |
| `ASSEMBLYAI_LANGUAGE` | No | `en_us` | AssemblyAI language code |
| `DEEPGRAM_API_KEY` | Yes* | — | Deepgram API key |
| `DEEPGRAM_MODEL` | No | `nova-3` | Deepgram model |
| `DEEPGRAM_LANGUAGE` | No | `en` | Deepgram language |
| `DEEPGRAM_KEYTERMS` | No | chess terms | Keyterm hints for chess vocabulary |

\*At least one provider API key is required.

### Docker Compose

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `3100` | Gateway exposed port |
| `PUZZLE_GENERATOR_PORT` | `8080` | Puzzle service exposed port |
| `VOICE_PORT` | `8001` | Voice service exposed port |
| `REDIS_PORT` | `6379` | Redis exposed port |

---

## Makefile Commands

```bash
# ─── Docker ────────────────────────────
make docker-build        # Build all Docker images
make docker-up           # Build and start (attached)
make docker-up-detach    # Build and start (detached)
make docker-down         # Stop containers
make docker-logs         # Tail all logs
make gateway-logs        # Tail API gateway logs
make redis-cli           # Open Redis CLI

# ─── Go (Puzzle Generator) ────────────
make build               # Build Go binary locally
make run                 # Run locally
make test                # Run Go tests
make vet                 # Run go vet
make tidy                # Run go mod tidy
make swagger             # Generate Swagger docs

# ─── Python (Voice-to-Move) ───────────
make voice-install       # Create venv + install deps
make voice-dev           # Run with auto-reload
make voice-run           # Run production
make voice-pytest        # Run Python tests
make voice-lint          # Lint with ruff
make voice-fmt           # Format with ruff
make voice-docs          # Print docs URL
make voice-test          # Curl health endpoint

# ─── Next.js (Client) ─────────────────
make client-dev          # Start dev server
make client-build        # Build for production
make client-lint         # Lint
make client-fmt          # Format with prettier

# ─── Cross-cutting ────────────────────
make lint                # Lint everything (Go + Python + JS)
make fmt                 # Format everything (Python + JS)
make build-all           # Build everything
make test-all            # Test everything (Go + Python)
make check-env           # Verify .env files exist
make dev                 # Start all services locally in parallel
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
| Voice | Python 3.14, FastAPI, OpenAI/AssemblyAI/Deepgram STT, Custom NLP |
| Gateway | nginx 1.27 (reverse proxy, CORS, WebSocket) |
| Infra | Docker Compose, multi-stage builds |

---

## Project Structure

```
chess-puzzle-next/
├── client/                      # Next.js frontend
│   ├── app/                     # App Router pages
│   │   ├── page.tsx             # Landing page
│   │   ├── daily/               # Daily puzzle
│   │   ├── pricing/             # Pricing page
│   │   ├── puzzles/             # Puzzle sources (lichess, dataset, ai)
│   │   └── voice-test/          # Voice Lab (standalone voice playground)
│   ├── components/
│   │   ├── board/               # ChessBoard, MoveHistory, PlayerIndicator
│   │   ├── home/                # HeroSection, AnimatedBoard, FeatureCarousel
│   │   ├── layout/              # Navbar
│   │   ├── puzzle/              # PuzzleSolver, PuzzleControls, DifficultyPicker
│   │   ├── ui/                  # Button, Card, Chip, Badge, Tooltip, Switch
│   │   └── voice/               # VoiceButton (push-to-talk + auto-listen)
│   └── lib/
│       ├── api.ts               # Axios client (puzzle + session APIs)
│       ├── store.ts             # Zustand store (game state, voice, sessions)
│       ├── types.ts             # TypeScript interfaces
│       └── utils.ts             # Helpers
│
├── services/
│   ├── api-gateway/             # nginx reverse proxy
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── puzzle-generator/        # Go puzzle service
│   │   ├── Dockerfile
│   │   ├── cmd/server/          # Entry point
│   │   ├── internal/            # Handlers, services, middleware
│   │   ├── pkg/                 # External clients (lichess, nvidia, redis)
│   │   └── docs/                # Swagger
│   └── voice-to-move/           # Python voice service
│       ├── Dockerfile
│       ├── app/
│       │   ├── main.py          # FastAPI app
│       │   ├── parser/          # Chess move NLP parser
│       │   └── routers/         # HTTP/WS endpoints
│       └── tests/               # pytest tests
│
├── docker-compose.yml           # Full stack orchestration
├── Makefile                     # Dev commands
└── README.md
```

---

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Run linting before committing: `make lint`
4. Run tests: `make test-all`
5. Commit your changes: `git commit -m 'Add my feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Open a Pull Request

---

**Built with passion for chess and clean code.**
