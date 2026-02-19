package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
)

// RequestLogger returns an Echo middleware that logs each request with
// method, path, status, latency, and remote IP.
func RequestLogger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			err := next(c)

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

			if err != nil {
				c.Logger().Errorf("request error: %v (level=%d)", err, log.ERROR)
			}

			return err
		}
	}
}
