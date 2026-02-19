package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the puzzle-generator service.
type Config struct {
	Server  ServerConfig
	Lichess LichessConfig
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// LichessConfig holds Lichess API settings.
type LichessConfig struct {
	BaseURL  string
	APIToken string // optional
	Timeout  time.Duration
}

// Load reads configuration from environment variables and returns a Config.
// Sensible defaults are provided for every field.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  parseDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: parseDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
		},
		Lichess: LichessConfig{
			BaseURL:  getEnv("LICHESS_BASE_URL", "https://lichess.org"),
			APIToken: getEnv("LICHESS_API_TOKEN", ""),
			Timeout:  parseDuration("LICHESS_TIMEOUT", 10*time.Second),
		},
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	port, err := strconv.Atoi(c.Server.Port)
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("config: invalid SERVER_PORT %q", c.Server.Port)
	}
	return nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
