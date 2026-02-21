package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps a Redis connection for puzzle session management.
type Client struct {
	rdb *redis.Client
}

// Session represents an active puzzle-solving session.
type Session struct {
	ID         string    `json:"id"`
	PuzzleID   string    `json:"puzzle_id"`
	Source     string    `json:"source"`
	Difficulty string    `json:"difficulty"`
	FEN        string    `json:"fen"`
	Moves      []string  `json:"moves"`
	MoveIndex  int       `json:"move_index"`
	Solved     bool      `json:"solved"`
	Failed     bool      `json:"failed"`
	HintsUsed  int       `json:"hints_used"`
	StartedAt  time.Time `json:"started_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// DailyPuzzle represents a cached daily puzzle.
type DailyPuzzle struct {
	PuzzleID string `json:"puzzle_id"`
	FEN      string `json:"fen"`
	Moves    string `json:"moves"`
	Rating   int    `json:"rating"`
	Themes   string `json:"themes"`
	GameURL  string `json:"game_url"`
	Date     string `json:"date"`
}

// New creates a new Redis client from a Redis URL.
func New(redisURL string) (*Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("redis: invalid URL %q: %w", redisURL, err)
	}
	rdb := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis: ping failed: %w", err)
	}
	return &Client{rdb: rdb}, nil
}

// NewOptional tries to connect to Redis but returns nil if it fails.
func NewOptional(redisURL string) *Client {
	c, err := New(redisURL)
	if err != nil {
		return nil
	}
	return c
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	if c == nil || c.rdb == nil {
		return nil
	}
	return c.rdb.Close()
}

func sessionKey(sessionID string) string {
	return "session:" + sessionID
}

// SaveSession stores a puzzle session with the given TTL.
func (c *Client) SaveSession(ctx context.Context, s *Session, ttl time.Duration) error {
	if c == nil {
		return nil
	}
	s.UpdatedAt = time.Now()
	data, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("redis: marshal session: %w", err)
	}
	return c.rdb.Set(ctx, sessionKey(s.ID), data, ttl).Err()
}

// GetSession retrieves a session by ID. Returns nil if not found.
func (c *Client) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	if c == nil {
		return nil, nil
	}
	data, err := c.rdb.Get(ctx, sessionKey(sessionID)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("redis: get session: %w", err)
	}
	var s Session
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("redis: unmarshal session: %w", err)
	}
	return &s, nil
}

// DeleteSession removes a session.
func (c *Client) DeleteSession(ctx context.Context, sessionID string) error {
	if c == nil {
		return nil
	}
	return c.rdb.Del(ctx, sessionKey(sessionID)).Err()
}

const dailyPuzzleKey = "daily-puzzle"

// CacheDailyPuzzle stores the daily puzzle with a TTL.
func (c *Client) CacheDailyPuzzle(ctx context.Context, puzzle *DailyPuzzle, ttl time.Duration) error {
	if c == nil {
		return nil
	}
	data, err := json.Marshal(puzzle)
	if err != nil {
		return fmt.Errorf("redis: marshal daily puzzle: %w", err)
	}
	return c.rdb.Set(ctx, dailyPuzzleKey, data, ttl).Err()
}

// GetDailyPuzzle retrieves the cached daily puzzle. Returns nil if not cached.
func (c *Client) GetDailyPuzzle(ctx context.Context) (*DailyPuzzle, error) {
	if c == nil {
		return nil, nil
	}
	data, err := c.rdb.Get(ctx, dailyPuzzleKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("redis: get daily puzzle: %w", err)
	}
	var p DailyPuzzle
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("redis: unmarshal daily puzzle: %w", err)
	}
	return &p, nil
}

// IncrementStat increments a counter.
func (c *Client) IncrementStat(ctx context.Context, key string) error {
	if c == nil {
		return nil
	}
	return c.rdb.Incr(ctx, "stats:"+key).Err()
}

// GetStat retrieves a counter value.
func (c *Client) GetStat(ctx context.Context, key string) (int64, error) {
	if c == nil {
		return 0, nil
	}
	val, err := c.rdb.Get(ctx, "stats:"+key).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return val, err
}

// Healthy checks if Redis is reachable.
func (c *Client) Healthy(ctx context.Context) bool {
	if c == nil {
		return false
	}
	return c.rdb.Ping(ctx).Err() == nil
}
