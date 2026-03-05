package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
)

// RequestLogger returns an Echo middleware that logs each request with
// method, path, status, latency, and remote IP.
func RequestLogger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			err := next(c)
			if err != nil {
				// Let Echo central error handler set the proper status/body first.
				c.Error(err)
			}

			req := c.Request()
			res := c.Response()
			latency := time.Since(start)

			c.Logger().Infof(
				"method=%s path=%s status=%d latency=%s ip=%s",
				req.Method,
				req.URL.Path,
				res.Status,
				latency.Round(time.Millisecond),
				c.RealIP(),
			)

			return nil
		}
	}
}
