package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// HealthResponse is the response body for the health endpoint.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

// RootResponse is the response body for the root endpoint.
type RootResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
	Hint    string `json:"hint"`
}

// Health handles GET /health – used by Docker and load balancers.
// @Summary Service health
// @Description Health probe endpoint
// @Tags health
// @Produce json
// @Success 200 {object} handlers.HealthResponse
// @Router /health [get]
func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, HealthResponse{
		Status:  "ok",
		Service: "puzzle-generator",
		Version: "0.1.0",
	})
}

// Root handles GET / and provides a friendly discovery payload.
func Root(c echo.Context) error {
	return c.JSON(http.StatusOK, RootResponse{
		Status:  "ok",
		Service: "puzzle-generator",
		Version: "0.1.0",
		Hint:    "Use /api/v1 for API endpoints or /swagger/index.html for docs",
	})
}
