package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chess-puzzle-next/puzzle-generator/internal/config"
	"github.com/labstack/gommon/log"
)

// @title Puzzle Generator API
// @version 1.0
// @description Chess puzzle generator service (Lichess, AI via OpenRouter, and Hugging Face dataset).
// @BasePath /api/v1
// @schemes http https

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	e := newServer(cfg)

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		e.Logger.Infof("puzzle-generator listening on :%s", cfg.Server.Port)
		if cfg.Lichess.APIToken != "" {
			e.Logger.Info("Lichess API token configured difficulty filtering enabled")
		} else {
			e.Logger.Warn("No LICHESS_API_TOKEN set using anonymous random puzzles (repeats may still occur)")
		}
		if err := e.StartServer(srv); err != nil && !errors.Is(err, http.ErrServerClosed) {
			e.Logger.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	e.Logger.Info("shutting down server…")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		e.Logger.Errorf("graceful shutdown failed: %v", err)
	}
}
