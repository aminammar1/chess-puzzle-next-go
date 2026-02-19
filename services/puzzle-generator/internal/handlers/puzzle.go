package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/labstack/echo/v4"
)

// puzzleProvider is the dependency PuzzleHandler needs from the service layer.
type puzzleProvider interface {
	GetByDifficulty(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error)
	GetByID(ctx context.Context, id string) (*models.Puzzle, error)
	GetDaily(ctx context.Context) (*models.Puzzle, error)
}

// PuzzleHandler groups all puzzle-related HTTP handlers.
type PuzzleHandler struct {
	svc puzzleProvider
}

// NewPuzzleHandler constructs a PuzzleHandler.
func NewPuzzleHandler(svc puzzleProvider) *PuzzleHandler {
	return &PuzzleHandler{svc: svc}
}

// Register mounts all puzzle routes onto the given Echo group.
func (h *PuzzleHandler) Register(g *echo.Group) {
	g.GET("/puzzle", h.GetPuzzle)
	g.GET("/puzzle/daily", h.GetDailyPuzzle)
	g.GET("/puzzle/:id", h.GetPuzzleByID)
}

// GetPuzzle handles GET /puzzle?difficulty=easy|medium|hard
func (h *PuzzleHandler) GetPuzzle(c echo.Context) error {
	raw := strings.ToLower(strings.TrimSpace(c.QueryParam("difficulty")))
	difficulty := models.DifficultyMedium
	if raw != "" {
		difficulty = models.DifficultyLevel(raw)
	}
	puzzle, err := h.svc.GetByDifficulty(c.Request().Context(), difficulty)
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}

// GetDailyPuzzle handles GET /puzzle/daily
func (h *PuzzleHandler) GetDailyPuzzle(c echo.Context) error {
	puzzle, err := h.svc.GetDaily(c.Request().Context())
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}

// GetPuzzleByID handles GET /puzzle/:id
func (h *PuzzleHandler) GetPuzzleByID(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	puzzle, err := h.svc.GetByID(c.Request().Context(), id)
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}
