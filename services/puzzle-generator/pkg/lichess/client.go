// Package lichess provides an HTTP client for the Lichess public API.
package lichess

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

const (
	defaultBaseURL = "https://lichess.org"
	defaultTimeout = 10 * time.Second
)

// Client wraps the Lichess REST API.
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiToken   string // optional; enables authenticated endpoints
}

// Option is a functional option for Client.
type Option func(*Client)

// WithAPIToken configures the client with a Lichess personal API token.
// Required for /api/puzzle/next with difficulty filtering.
func WithAPIToken(token string) Option {
	return func(c *Client) { c.apiToken = token }
}

// WithBaseURL overrides the Lichess base URL (useful for testing).
func WithBaseURL(u string) Option {
	return func(c *Client) { c.baseURL = u }
}

// WithTimeout overrides the HTTP timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = d }
}

// New returns a ready-to-use Lichess client.
func New(opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: defaultTimeout},
		baseURL:    defaultBaseURL,
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// HasToken reports whether the client was configured with an API token.
func (c *Client) HasToken() bool { return c.apiToken != "" }

// GetDailyPuzzle fetches the Lichess puzzle of the day (no auth required).
func (c *Client) GetDailyPuzzle(ctx context.Context) (*models.LichessPuzzleResponse, error) {
	return c.fetchPuzzle(ctx, "/api/puzzle/daily", nil, true)
}

// GetPuzzleByID fetches a puzzle by its Lichess puzzle ID (no auth required).
func (c *Client) GetPuzzleByID(ctx context.Context, id string) (*models.LichessPuzzleResponse, error) {
	return c.fetchPuzzle(ctx, "/api/puzzle/"+id, nil, true)
}

// GetNextPuzzle fetches a random puzzle from /api/puzzle/next.
// When difficulty is non-empty the Lichess difficulty param is forwarded.
// This request is intentionally anonymous because authenticated requests can be
// sticky to the same unsolved puzzle unless puzzle results are posted.
func (c *Client) GetNextPuzzle(ctx context.Context, difficulty string) (*models.LichessPuzzleResponse, error) {
	params := url.Values{}
	if difficulty != "" {
		params.Set("difficulty", difficulty)
	}
	return c.fetchPuzzle(ctx, "/api/puzzle/next", params, false)
}

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

func (c *Client) fetchPuzzle(ctx context.Context, path string, params url.Values, withAuth bool) (*models.LichessPuzzleResponse, error) {
	endpoint := c.baseURL + path
	if len(params) > 0 {
		endpoint += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("lichess: build request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if withAuth && c.apiToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("lichess: http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("lichess: read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("lichess: unexpected status %d: %s", resp.StatusCode, truncate(string(body), 200))
	}

	var puzzle models.LichessPuzzleResponse
	if err := json.Unmarshal(body, &puzzle); err != nil {
		return nil, fmt.Errorf("lichess: decode response: %w", err)
	}

	return &puzzle, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
