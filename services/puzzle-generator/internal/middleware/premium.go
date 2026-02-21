package middleware

import (
"net/http"

"github.com/chess-puzzle-next/puzzle-generator/internal/models"
"github.com/labstack/echo/v4"
)

// PremiumCheck is a middleware that checks if the user has a premium subscription.
// For now, it checks for a specific header "X-Premium-User" with value "true".
func PremiumCheck() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			isPremium := c.Request().Header.Get("X-Premium-User")
			if isPremium != "true" {
				return c.JSON(http.StatusPaymentRequired, models.ErrorResponse{
Error:   "premium required",
Details: "This feature requires a premium subscription",
})
			}
			return next(c)
		}
	}
}
