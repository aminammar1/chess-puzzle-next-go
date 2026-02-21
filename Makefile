GO_SVC     := ./services/puzzle-generator
GO_VERSION := 1.25.7

.PHONY: help build run test vet tidy clean swagger swagger-install swagger-serve docker-up docker-up-detach docker-down docker-logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*##"}; {printf "  %-18s %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Local Go development
# ---------------------------------------------------------------------------

build: ## Build the Go binary
	cd $(GO_SVC) && go build -ldflags="-s -w" -o bin/puzzle-generator ./cmd/server

run: ## Run the service locally
	cd $(GO_SVC) && go run ./cmd/server

test: ## Run tests
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

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

docker-up: ## Build and start (attached)
	docker compose up --build

docker-up-detach: ## Build and start (detached)
	docker compose up --build -d

docker-down: ## Stop and remove containers
	docker compose down

docker-logs: ## Tail container logs
	docker compose logs -f

redis-cli: ## Open Redis CLI shell
	docker compose exec redis redis-cli

docker-logs: ## Tail service logs
	docker compose logs -f
