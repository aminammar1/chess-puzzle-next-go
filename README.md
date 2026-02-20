# Chess Puzzle Next

Next-level chess puzzle trainer powered by microservices.


Fresh puzzles from **multiple sources** — real games, composed problems, datasets, and more. Solve by clicking pieces, or just **speak your move**. Your voice is transcribed and converted into accurate chess notation automatically.

### Architecture

```
  ┌─────────────────┐          ┌─────────────────────┐          ┌──────────────────────────┐
  │                 │          │                     │  HTTP/REST│   [Go]                   │
  │  Next.js Client │─────────▶│    API  Gateway     │──────────▶│  Puzzle Generator Service│
  │                 │ HTTP/REST│                     │          │                          │
  └─────────────────┘          │                     │          └──────────────────────────┘
                               │                     │
                               │                     │          ┌──────────────────────────┐
                               │                     │  HTTP/REST│   [Python]               │
                               │                     │──────────▶│  Voice To Move Service   │
                               └─────────────────────┘          │                          │
                                                                 └──────────────────────────┘
```

### Services
- **puzzle-generator**
  Golang + Echo — smart puzzle fetching, filtering, and serving from multiple sources (starting with the Lichess API, with more coming)
- **voice-to-move**
  Python + FastAPI — spoken moves → legal chess moves with AI (work in progress)

### Environment variables
- Docker uses `./services/puzzle-generator/.env` via `env_file`.
- Set API credentials directly in that file:
  - `LICHESS_API_TOKEN`
  - `OPEN_ROUTER_API_KEY`