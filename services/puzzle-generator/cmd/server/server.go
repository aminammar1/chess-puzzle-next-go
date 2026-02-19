package main

import (
	"github.com/chess-puzzle-next/puzzle-generator/internal/config"
	"github.com/chess-puzzle-next/puzzle-generator/internal/handlers"
	custmw "github.com/chess-puzzle-next/puzzle-generator/internal/middleware"
	"github.com/chess-puzzle-next/puzzle-generator/internal/services"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/lichess"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
)

func newServer(cfg *config.Config) *echo.Echo {
	lichessOpts := []lichess.Option{
		lichess.WithBaseURL(cfg.Lichess.BaseURL),
		lichess.WithTimeout(cfg.Lichess.Timeout),
	}
	if cfg.Lichess.APIToken != "" {
		lichessOpts = append(lichessOpts, lichess.WithAPIToken(cfg.Lichess.APIToken))
	}

	puzzleHandler := handlers.NewPuzzleHandler(
		services.New(lichess.New(lichessOpts...)),
	)

	e := echo.New()
	e.HideBanner = true
	e.Logger.SetLevel(log.INFO)
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
	e.Use(custmw.RequestLogger())

	e.GET("/health", handlers.Health)
	puzzleHandler.Register(e.Group("/api/v1"))

	return e
}
