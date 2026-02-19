# Chess Puzzle Next

Next-level chess puzzle trainer powered by microservices.

Fresh puzzles from **multiple sources** — real games, composed problems, datasets, and more. Solve by clicking pieces, or just **speak your move**. Your voice is transcribed and converted into accurate chess notation automatically.

### Services
- **puzzle-generator**
  Golang + Echo — smart puzzle fetching, filtering, and serving from multiple sources (starting with the Lichess API, with more coming)
- **voice-to-move**
  Python + FastAPI — spoken moves → legal chess moves with AI (work in progress)