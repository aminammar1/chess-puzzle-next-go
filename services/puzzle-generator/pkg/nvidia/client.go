package nvidia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Client communicates with the NVIDIA Inference API (OpenAI-compatible).
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
	model      string
}

// Option configures the Client.
type Option func(*Client)

// Message represents a chat message (OpenAI format).
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ---------------------------------------------------------------------------
// Request / Response types (NVIDIA chat/completions – OpenAI compatible)
// ---------------------------------------------------------------------------

type chatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stream      bool      `json:"stream"`
}

type chatCompletionResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// ---------------------------------------------------------------------------
// Option helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

// New creates an NVIDIA inference client with sensible defaults.
func New(opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    "https://integrate.api.nvidia.com/v1",
		model:      "meta/llama-3.3-70b-instruct",
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// IsConfigured returns true when both API key and model are set.
func (c *Client) IsConfigured() bool {
	return c.apiKey != "" && c.model != ""
}

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

// CreateCompletion sends a non-streaming chat completion request to NVIDIA.
// The thinking tags (<think>…</think>) are automatically stripped from the
// response content before returning.
func (c *Client) CreateCompletion(ctx context.Context, messages []Message) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("nvidia: missing API key")
	}

	payload := chatCompletionRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: 0.2,
		MaxTokens:   128,
		TopP:        0.9,
		Stream:      false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("nvidia: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("nvidia: build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("nvidia: http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("nvidia: read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("nvidia: unexpected status %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}

	var decoded chatCompletionResponse
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return "", fmt.Errorf("nvidia: decode response: %w", err)
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("nvidia: empty choices in response")
	}

	content := strings.TrimSpace(decoded.Choices[0].Message.Content)
	if content == "" {
		return "", fmt.Errorf("nvidia: empty content in response")
	}

	// Strip model-internal thinking blocks before returning.
	content = StripThinkingTags(content)

	return content, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var thinkingTagRe = regexp.MustCompile(`(?s)<think>.*?</think>`)

// StripThinkingTags removes <think>…</think> blocks that some models emit.
func StripThinkingTags(content string) string {
	content = thinkingTagRe.ReplaceAllString(content, "")
	return strings.TrimSpace(content)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
