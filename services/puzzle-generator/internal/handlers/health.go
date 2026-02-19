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

// Health handles GET /health – used by Docker and load balancers.
func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, HealthResponse{
		Status:  "ok",
		Service: "puzzle-generator",
		Version: "0.1.0",
	})
}
