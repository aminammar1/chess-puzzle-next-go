package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/middleware"
	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/labstack/echo/v4"
)

// puzzleProvider is the dependency PuzzleHandler needs from the service layer.
type puzzleProvider interface {
	GetByDifficulty(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error)
	GetByID(ctx context.Context, id string) (*models.Puzzle, error)
	GetDaily(ctx context.Context) (*models.Puzzle, error)
	GenerateFromAI(ctx context.Context, req models.AIPuzzleRequest) (*models.Puzzle, error)
	GenerateFromDataset(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error)
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

	// AI puzzle generation is a premium feature
	g.POST("/puzzle/ai", h.GeneratePuzzleFromAI, middleware.PremiumCheck())

	g.GET("/puzzle/dataset", h.GetPuzzleFromDataset)
}

// GetPuzzle handles GET /puzzle?difficulty=easy|medium|hard
// @Summary Get puzzle by difficulty
// @Description Returns a random puzzle (Lichess source) filtered by difficulty
// @Tags puzzle
// @Produce json
// @Param difficulty query string false "easy|medium|hard" Enums(easy,medium,hard)
// @Success 200 {object} models.Puzzle
// @Failure 400 {object} models.ErrorResponse
// @Failure 502 {object} models.ErrorResponse
// @Router /puzzle [get]
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
// @Summary Get daily puzzle
// @Description Returns Lichess daily puzzle
// @Tags puzzle
// @Produce json
// @Success 200 {object} models.Puzzle
// @Failure 502 {object} models.ErrorResponse
// @Router /puzzle/daily [get]
func (h *PuzzleHandler) GetDailyPuzzle(c echo.Context) error {
	puzzle, err := h.svc.GetDaily(c.Request().Context())
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}

// GetPuzzleByID handles GET /puzzle/:id
// @Summary Get puzzle by ID
// @Description Returns a puzzle by Lichess puzzle identifier
// @Tags puzzle
// @Produce json
// @Param id path string true "Puzzle ID"
// @Success 200 {object} models.Puzzle
// @Failure 400 {object} models.ErrorResponse
// @Failure 502 {object} models.ErrorResponse
// @Router /puzzle/{id} [get]
func (h *PuzzleHandler) GetPuzzleByID(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	puzzle, err := h.svc.GetByID(c.Request().Context(), id)
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}

// GeneratePuzzleFromAI handles POST /puzzle/ai
// @Summary Generate puzzle from AI (RAG)
// @Description Uses a RAG pipeline: fetches candidate puzzles from the Lichess dataset and asks the NVIDIA model to select the best match for the user's prompt
// @Tags puzzle
// @Accept json
// @Produce json
// @Param request body models.AIPuzzleRequest true "AI puzzle request"
// @Success 200 {object} models.Puzzle
// @Failure 400 {object} models.ErrorResponse
// @Failure 502 {object} models.ErrorResponse
// @Router /puzzle/ai [post]
func (h *PuzzleHandler) GeneratePuzzleFromAI(c echo.Context) error {
	var req models.AIPuzzleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "invalid request",
			Details: "invalid JSON body",
		})
	}

	if req.Difficulty == "" {
		req.Difficulty = models.DifficultyMedium
	}

	puzzle, err := h.svc.GenerateFromAI(c.Request().Context(), req)
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}

// GetPuzzleFromDataset handles GET /puzzle/dataset
// @Summary Get puzzle from dataset
// @Description Returns one random puzzle from Hugging Face Lichess dataset
// @Tags puzzle
// @Produce json
// @Param difficulty query string false "easy|medium|hard" Enums(easy,medium,hard)
// @Success 200 {object} models.Puzzle
// @Failure 400 {object} models.ErrorResponse
// @Failure 502 {object} models.ErrorResponse
// @Router /puzzle/dataset [get]
func (h *PuzzleHandler) GetPuzzleFromDataset(c echo.Context) error {
	raw := strings.ToLower(strings.TrimSpace(c.QueryParam("difficulty")))
	difficulty := models.DifficultyLevel(raw)

	puzzle, err := h.svc.GenerateFromDataset(c.Request().Context(), difficulty)
	if err != nil {
		return h.handleServiceError(c, err)
	}
	return c.JSON(http.StatusOK, puzzle)
}
