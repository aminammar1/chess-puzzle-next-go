package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the puzzle-generator service.
type Config struct {
	Server      ServerConfig
	Redis       RedisConfig
	Lichess     LichessConfig
	NVIDIA      NVIDIAConfig
	HuggingFace HuggingFaceConfig
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

type NVIDIAConfig struct {
	BaseURL string
	APIKey  string
	Model   string
	Timeout time.Duration
}

type HuggingFaceConfig struct {
	BaseURL string
	Dataset string
	Config  string
	Split   string
	Timeout time.Duration
}

// RedisConfig holds Redis connection settings.
type RedisConfig struct {
	URL            string
	SessionTTL     time.Duration
	DailyPuzzleTTL time.Duration
}

// Load reads configuration from environment variables and returns a Config.
// Sensible defaults are provided for every field.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  parseDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: parseDuration("SERVER_WRITE_TIMEOUT", 120*time.Second),
		},
		Redis: RedisConfig{
			URL:            getEnv("REDIS_URL", "redis://localhost:6379"),
			SessionTTL:     parseDuration("REDIS_SESSION_TTL", 24*time.Hour),
			DailyPuzzleTTL: parseDuration("REDIS_DAILY_PUZZLE_TTL", 25*time.Hour),
		},
		Lichess: LichessConfig{
			BaseURL:  getEnv("LICHESS_BASE_URL", "https://lichess.org"),
			APIToken: getEnvOrFile("LICHESS_API_TOKEN", ""),
			Timeout:  parseDuration("LICHESS_TIMEOUT", 10*time.Second),
		},
		NVIDIA: NVIDIAConfig{
			BaseURL: getEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
			APIKey:  getEnvOrFile("NVIDIA_API_KEY", ""),
			Model:   getEnv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct"),
			Timeout: parseDuration("NVIDIA_TIMEOUT", 30*time.Second),
		},
		HuggingFace: HuggingFaceConfig{
			BaseURL: getEnv("HUGGINGFACE_BASE_URL", "https://datasets-server.huggingface.co"),
			Dataset: getEnv("HUGGINGFACE_DATASET", "Lichess/chess-puzzles"),
			Config:  getEnv("HUGGINGFACE_DATASET_CONFIG", "default"),
			Split:   getEnv("HUGGINGFACE_DATASET_SPLIT", "train"),
			Timeout: parseDuration("HUGGINGFACE_TIMEOUT", 15*time.Second),
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

func getEnvOrFile(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}

	filePath := strings.TrimSpace(os.Getenv(key + "_FILE"))
	if filePath == "" {
		return fallback
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return fallback
	}

	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return fallback
	}

	return trimmed
}
