package main

import (
	"fmt"

	_ "github.com/chess-puzzle-next/puzzle-generator/docs"
	"github.com/chess-puzzle-next/puzzle-generator/internal/config"
	"github.com/chess-puzzle-next/puzzle-generator/internal/handlers"
	custmw "github.com/chess-puzzle-next/puzzle-generator/internal/middleware"
	"github.com/chess-puzzle-next/puzzle-generator/internal/services"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/huggingface"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/lichess"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/openrouter"
	redispkg "github.com/chess-puzzle-next/puzzle-generator/pkg/redis"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

func newServer(cfg *config.Config) *echo.Echo {
	lichessOpts := []lichess.Option{
		lichess.WithBaseURL(cfg.Lichess.BaseURL),
		lichess.WithTimeout(cfg.Lichess.Timeout),
	}
	if cfg.Lichess.APIToken != "" {
		lichessOpts = append(lichessOpts, lichess.WithAPIToken(cfg.Lichess.APIToken))
	}

	svc := services.New(
		lichess.New(lichessOpts...),
		openrouter.New(
			openrouter.WithBaseURL(cfg.OpenRouter.BaseURL),
			openrouter.WithAPIKey(cfg.OpenRouter.APIKey),
			openrouter.WithModel(cfg.OpenRouter.Model),
			openrouter.WithTimeout(cfg.OpenRouter.Timeout),
		),
		huggingface.New(
			huggingface.WithBaseURL(cfg.HuggingFace.BaseURL),
			huggingface.WithDataset(cfg.HuggingFace.Dataset),
			huggingface.WithConfig(cfg.HuggingFace.Config),
			huggingface.WithSplit(cfg.HuggingFace.Split),
			huggingface.WithTimeout(cfg.HuggingFace.Timeout),
		),
	)
	svc.SetFallbackModels(cfg.OpenRouter.FallbackModels)
	puzzleHandler := handlers.NewPuzzleHandler(svc)

	// Redis (optional — degrades gracefully)
	redisClient := redispkg.NewOptional(cfg.Redis.URL)
	if redisClient != nil {
		fmt.Println("✓ Redis connected")
	} else {
		fmt.Println("⚠ Redis unavailable — sessions disabled")
	}
	sessionHandler := handlers.NewSessionHandler(redisClient, cfg.Redis.SessionTTL)

	e := echo.New()
	e.HideBanner = true
	e.Logger.SetLevel(log.INFO)
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
	e.Use(custmw.RequestLogger())

	e.GET("/health", handlers.Health)
	e.GET("/api/v1/health", handlers.Health)
	e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
	puzzleHandler.Register(e.Group("/api/v1"))
	sessionHandler.Register(e.Group("/api/v1"))

	return e
}
