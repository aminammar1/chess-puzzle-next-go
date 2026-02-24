GO_SVC     := ./services/puzzle-generator
GO_VERSION := 1.25.7

PY_SVC     := ./services/voice-to-move
PY_VENV    := $(PY_SVC)/venv
PY_BIN     := $(PY_VENV)/bin
PY         := python3.14
PY_PORT    := 8001

GATEWAY_PORT := 3100

.PHONY: help build run test vet tidy clean swagger swagger-install swagger-serve \
        docker-up docker-up-detach docker-down docker-logs docker-build \
        voice-venv voice-install voice-run voice-dev voice-test voice-freeze voice-clean voice-docs \
        voice-lint voice-pytest voice-fmt voice-shell \
        client-dev client-build client-lint client-fmt \
        dev lint fmt build-all gateway-logs \
        redis-cli check-env

# ═══════════════════════════════════════════════
# Help
# ═══════════════════════════════════════════════

help: ## Show available targets
	@echo ""
	@echo "  Chess Puzzle Next — Makefile"
	@echo "  ════════════════════════════"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ═══════════════════════════════════════════════
# Local Go development (puzzle-generator)
# ═══════════════════════════════════════════════

build: ## Build the Go binary
	cd $(GO_SVC) && go build -ldflags="-s -w" -o bin/puzzle-generator ./cmd/server

run: ## Run the Go service locally
	cd $(GO_SVC) && go run ./cmd/server

test: ## Run Go tests
	cd $(GO_SVC) && go test ./...

vet: ## Run go vet
	cd $(GO_SVC) && go vet ./...

tidy: ## Run go mod tidy
	cd $(GO_SVC) && go mod tidy

swagger-install: ## Install swagger generator tool
	cd $(GO_SVC) && go install github.com/swaggo/swag/cmd/swag@v1.16.4

swagger: ## Generate Swagger docs
	cd $(GO_SVC) && go run github.com/swaggo/swag/cmd/swag@v1.16.4 init -g cmd/server/main.go -o docs

swagger-serve: swagger run ## Run service and open Swagger at /swagger/index.html

clean: ## Remove build artifacts
	rm -rf $(GO_SVC)/bin

# ═══════════════════════════════════════════════
# Docker Compose — full stack
# ═══════════════════════════════════════════════

docker-build: ## Build all Docker images without starting
	docker compose build

docker-up: ## Build and start all services (attached)
	docker compose up --build

docker-up-detach: ## Build and start all services (detached)
	docker compose up --build -d

docker-down: ## Stop and remove containers
	docker compose down

docker-logs: ## Tail all container logs
	docker compose logs -f

gateway-logs: ## Tail API gateway logs only
	docker compose logs -f api-gateway

redis-cli: ## Open Redis CLI shell
	docker compose exec redis redis-cli

# ═══════════════════════════════════════════════
# Voice-to-Move (Python / FastAPI)
# ═══════════════════════════════════════════════

voice-venv: ## Create Python 3.14 virtualenv
	$(PY) -m venv $(PY_VENV)

voice-install: voice-venv ## Install Python dependencies
	$(PY_BIN)/pip install --upgrade pip
	$(PY_BIN)/pip install -r $(PY_SVC)/requirements.txt

voice-run: ## Run voice service (production)
	cd $(PY_SVC) && $(CURDIR)/$(PY_BIN)/uvicorn app.main:app --host 0.0.0.0 --port $(PY_PORT)

voice-dev: ## Run voice service (dev with auto-reload)
	cd $(PY_SVC) && $(CURDIR)/$(PY_BIN)/uvicorn app.main:app --host 0.0.0.0 --port $(PY_PORT) --reload

voice-test: ## Test voice health endpoint
	@curl -s http://localhost:$(PY_PORT)/health | python3 -m json.tool

voice-freeze: ## Freeze current Python deps to requirements.txt
	$(PY_BIN)/pip freeze > $(PY_SVC)/requirements.txt

voice-clean: ## Remove Python virtualenv
	rm -rf $(PY_VENV)

voice-docs: ## Open voice service Swagger docs URL
	@echo "http://localhost:$(PY_PORT)/docs"

voice-pytest: ## Run Python tests
	cd $(PY_SVC) && $(CURDIR)/$(PY_BIN)/python -m pytest tests/ -v

voice-lint: ## Lint Python code with ruff
	$(PY_BIN)/pip install -q ruff 2>/dev/null; cd $(PY_SVC) && $(CURDIR)/$(PY_BIN)/ruff check .

voice-fmt: ## Format Python code with ruff
	$(PY_BIN)/pip install -q ruff 2>/dev/null; cd $(PY_SVC) && $(CURDIR)/$(PY_BIN)/ruff format .

voice-shell: ## Activate venv in a sub-shell
	@echo "Run: source $(PY_VENV)/bin/activate"

# ═══════════════════════════════════════════════
# Client (Next.js)
# ═══════════════════════════════════════════════

client-dev: ## Start Next.js dev server
	cd client && npm run dev

client-build: ## Build Next.js for production
	cd client && npm run build

client-lint: ## Lint Next.js project
	cd client && npm run lint

client-fmt: ## Format client code with prettier (if installed)
	cd client && npx prettier --write "**/*.{ts,tsx,css,json}" 2>/dev/null || echo "Install prettier: npm i -D prettier"

# ═══════════════════════════════════════════════
# Cross-cutting: lint, format, build all
# ═══════════════════════════════════════════════

lint: vet voice-lint client-lint ## Lint all services (Go + Python + Next.js)

fmt: voice-fmt client-fmt ## Format all code (Python + Next.js)

build-all: build docker-build client-build ## Build everything (Go binary + Docker images + Next.js)

test-all: test voice-pytest ## Run all tests (Go + Python)

check-env: ## Verify required env files exist
	@echo "Checking environment files..."
	@test -f $(GO_SVC)/.env && echo "  ✓ puzzle-generator/.env" || echo "  ✗ puzzle-generator/.env missing (copy from .env.exemple)"
	@test -f client/.env.local && echo "  ✓ client/.env.local" || echo "  ✗ client/.env.local missing (copy from .env.example)"
	@echo "Done."

# ═══════════════════════════════════════════════
# Run everything locally (development)
# ═══════════════════════════════════════════════

dev: ## Start Go + Python + Client in parallel (local dev)
	@echo "Starting all services in parallel..."
	@echo "  → Puzzle Generator  :8080"
	@echo "  → Voice-to-Move     :$(PY_PORT)"
	@echo "  → Next.js Client    :3000"
	@echo ""
	@$(MAKE) run &
	@$(MAKE) voice-dev &
	@$(MAKE) client-dev
