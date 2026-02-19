# ---- Build stage ----
FROM golang:1.25.7-alpine3.22 AS builder

# Install git (needed for go mod download with VCS)
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Cache dependency downloads separately from source build
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /puzzle-generator \
    ./cmd/server

# ---- Runtime stage ----
FROM alpine:3.22

# wget for Docker healthcheck; ca-certificates for outbound HTTPS to Lichess
RUN apk add --no-cache ca-certificates wget && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /puzzle-generator /puzzle-generator

USER appuser

EXPOSE 8080

ENTRYPOINT ["/puzzle-generator"]
