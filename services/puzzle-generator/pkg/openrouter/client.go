package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
	model      string
}

type Option func(*Client)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func WithBaseURL(v string) Option {
	return func(c *Client) { c.baseURL = strings.TrimRight(v, "/") }
}

func WithAPIKey(v string) Option {
	return func(c *Client) { c.apiKey = v }
}

func WithModel(v string) Option {
	return func(c *Client) { c.model = v }
}

func WithTimeout(v time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = v }
}

func New(opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 20 * time.Second},
		baseURL:    "https://openrouter.ai/api/v1",
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) IsConfigured() bool {
	return c.apiKey != "" && c.model != ""
}

func (c *Client) CreateCompletion(ctx context.Context, messages []Message) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("openrouter: missing API key or model")
	}

	payload := chatCompletionRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: 0.7,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("openrouter: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("openrouter: build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("HTTP-Referer", "https://github.com/aminammar1/chess-puzzle-next-go")
	req.Header.Set("X-Title", "chess-puzzle-next")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openrouter: http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("openrouter: read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openrouter: unexpected status %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}

	var decoded chatCompletionResponse
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return "", fmt.Errorf("openrouter: decode response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("openrouter: empty choices in response")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	if content == "" {
		return "", fmt.Errorf("openrouter: empty content in response")
	}

	return content, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
