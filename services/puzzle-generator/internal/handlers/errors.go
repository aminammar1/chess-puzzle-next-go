package handlers

import (
	"net/http"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/labstack/echo/v4"
)

func (h *PuzzleHandler) handleServiceError(c echo.Context, err error) error {
	c.Logger().Errorf("service error: %v", err)
	if isValidationError(err) {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error:   "invalid request",
			Details: err.Error(),
		})
	}
	return c.JSON(http.StatusBadGateway, models.ErrorResponse{
		Error:   "upstream error",
		Details: err.Error(),
	})
}

func isValidationError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "unknown difficulty") ||
		strings.Contains(msg, "invalid ID format") ||
		strings.Contains(msg, "prompt is required") ||
		strings.Contains(msg, "prompt must be")
}
