package handlers

import (
	"net/http"
	"time"

	"github.com/chess-puzzle-next/puzzle-generator/pkg/redis"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// SessionHandler manages puzzle session CRUD via Redis.
type SessionHandler struct {
	redis      *redis.Client
	sessionTTL time.Duration
}

// NewSessionHandler creates a SessionHandler.
func NewSessionHandler(r *redis.Client, ttl time.Duration) *SessionHandler {
	return &SessionHandler{redis: r, sessionTTL: ttl}
}

// Register mounts session routes.
func (h *SessionHandler) Register(g *echo.Group) {
	g.POST("/session", h.CreateSession)
	g.GET("/session/:id", h.GetSession)
	g.PUT("/session/:id", h.UpdateSession)
	g.DELETE("/session/:id", h.DeleteSession)
}

// createSessionRequest is the body for POST /session.
type createSessionRequest struct {
	PuzzleID   string   `json:"puzzle_id"`
	Source     string   `json:"source"`
	Difficulty string   `json:"difficulty"`
	FEN        string   `json:"fen"`
	Moves      []string `json:"moves"`
}

// CreateSession handles POST /api/v1/session
func (h *SessionHandler) CreateSession(c echo.Context) error {
	if h.redis == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Session service unavailable (Redis not connected)",
		})
	}

	var req createSessionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	session := &redis.Session{
		ID:         uuid.New().String(),
		PuzzleID:   req.PuzzleID,
		Source:     req.Source,
		Difficulty: req.Difficulty,
		FEN:        req.FEN,
		Moves:      req.Moves,
		MoveIndex:  0,
		StartedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := h.redis.SaveSession(c.Request().Context(), session, h.sessionTTL); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create session"})
	}

	return c.JSON(http.StatusCreated, session)
}

// GetSession handles GET /api/v1/session/:id
func (h *SessionHandler) GetSession(c echo.Context) error {
	if h.redis == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Session service unavailable",
		})
	}

	session, err := h.redis.GetSession(c.Request().Context(), c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get session"})
	}
	if session == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "session not found"})
	}

	return c.JSON(http.StatusOK, session)
}

// updateSessionRequest is the body for PUT /session/:id.
type updateSessionRequest struct {
	MoveIndex int  `json:"move_index"`
	Solved    bool `json:"solved"`
	Failed    bool `json:"failed"`
	HintsUsed int  `json:"hints_used"`
}

// UpdateSession handles PUT /api/v1/session/:id
func (h *SessionHandler) UpdateSession(c echo.Context) error {
	if h.redis == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Session service unavailable",
		})
	}

	session, err := h.redis.GetSession(c.Request().Context(), c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get session"})
	}
	if session == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "session not found"})
	}

	var req updateSessionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	session.MoveIndex = req.MoveIndex
	session.Solved = req.Solved
	session.Failed = req.Failed
	session.HintsUsed = req.HintsUsed

	if err := h.redis.SaveSession(c.Request().Context(), session, h.sessionTTL); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update session"})
	}

	return c.JSON(http.StatusOK, session)
}

// DeleteSession handles DELETE /api/v1/session/:id
func (h *SessionHandler) DeleteSession(c echo.Context) error {
	if h.redis == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Session service unavailable",
		})
	}

	if err := h.redis.DeleteSession(c.Request().Context(), c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete session"})
	}

	return c.NoContent(http.StatusNoContent)
}
