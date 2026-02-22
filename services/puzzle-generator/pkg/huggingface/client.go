package huggingface

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	crand "crypto/rand"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

type Client struct {
	httpClient *http.Client
	baseURL    string
	dataset    string
	config     string
	split      string
}

type Option func(*Client)

type datasetSizeResponse struct {
	Size struct {
		Config string `json:"config"`
		Splits []struct {
			Split   string `json:"split"`
			NumRows int    `json:"num_rows"`
		} `json:"splits"`
	} `json:"size"`
}

type rowsResponse struct {
	Rows []struct {
		Row map[string]any `json:"row"`
	} `json:"rows"`
}

func WithBaseURL(v string) Option {
	return func(c *Client) { c.baseURL = strings.TrimRight(v, "/") }
}

func WithDataset(v string) Option {
	return func(c *Client) { c.dataset = v }
}

func WithConfig(v string) Option {
	return func(c *Client) { c.config = v }
}

func WithSplit(v string) Option {
	return func(c *Client) { c.split = v }
}

func WithTimeout(v time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = v }
}

func New(opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		baseURL:    "https://datasets-server.huggingface.co",
		dataset:    "Lichess/chess-puzzles",
		config:     "default",
		split:      "train",
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) GetRandomPuzzle(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error) {
	totalRows, err := c.getRowsCount(ctx)
	if err != nil {
		return nil, err
	}
	if totalRows == 0 {
		return nil, fmt.Errorf("huggingface: dataset split is empty")
	}

	maxAttempts := 20
	if difficulty == "" {
		maxAttempts = 1
	}

	for i := 0; i < maxAttempts; i++ {
		offset, err := randomInt(totalRows)
		if err != nil {
			return nil, fmt.Errorf("huggingface: random offset: %w", err)
		}

		row, err := c.fetchRow(ctx, offset)
		if err != nil {
			return nil, err
		}

		puzzle, err := toPuzzle(row)
		if err != nil {
			continue
		}
		if difficulty != "" && puzzle.Difficulty != difficulty {
			continue
		}
		return puzzle, nil
	}

	if difficulty != "" {
		return nil, fmt.Errorf("huggingface: no puzzle found for difficulty %q after retries", difficulty)
	}
	return nil, fmt.Errorf("huggingface: no valid puzzle row found")
}

func (c *Client) getRowsCount(ctx context.Context) (int, error) {
	params := url.Values{}
	params.Set("dataset", c.dataset)

	endpoint := c.baseURL + "/size?" + params.Encode()
	body, status, err := c.doGet(ctx, endpoint)
	if err != nil {
		return 0, err
	}
	if status != http.StatusOK {
		return 0, fmt.Errorf("huggingface: size endpoint status %d: %s", status, truncate(body, 240))
	}

	var decoded datasetSizeResponse
	if err := json.Unmarshal([]byte(body), &decoded); err != nil {
		return 0, fmt.Errorf("huggingface: decode size response: %w", err)
	}

	for _, split := range decoded.Size.Splits {
		if split.Split == c.split {
			return split.NumRows, nil
		}
	}
	return 0, fmt.Errorf("huggingface: split %q not found in dataset", c.split)
}

func (c *Client) fetchRow(ctx context.Context, offset int) (map[string]any, error) {
	rows, err := c.fetchRows(ctx, offset, 1)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("huggingface: empty rows response")
	}
	return rows[0], nil
}

// fetchRows fetches `length` rows starting at `offset`.
func (c *Client) fetchRows(ctx context.Context, offset, length int) ([]map[string]any, error) {
	params := url.Values{}
	params.Set("dataset", c.dataset)
	params.Set("config", c.config)
	params.Set("split", c.split)
	params.Set("offset", strconv.Itoa(offset))
	params.Set("length", strconv.Itoa(length))

	endpoint := c.baseURL + "/rows?" + params.Encode()
	body, status, err := c.doGet(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("huggingface: rows endpoint status %d: %s", status, truncate(body, 240))
	}

	var decoded rowsResponse
	if err := json.Unmarshal([]byte(body), &decoded); err != nil {
		return nil, fmt.Errorf("huggingface: decode rows response: %w", err)
	}

	result := make([]map[string]any, 0, len(decoded.Rows))
	for _, r := range decoded.Rows {
		result = append(result, r.Row)
	}
	return result, nil
}

// GetCandidatePuzzles fetches a batch of random puzzles from the dataset,
// optionally filtering by difficulty. Used by the RAG pipeline.
func (c *Client) GetCandidatePuzzles(ctx context.Context, difficulty models.DifficultyLevel, count int) ([]*models.Puzzle, error) {
	totalRows, err := c.getRowsCount(ctx)
	if err != nil {
		return nil, err
	}
	if totalRows == 0 {
		return nil, fmt.Errorf("huggingface: dataset split is empty")
	}

	// Fetch a larger batch in one API call, then filter.
	batchSize := count * 10
	if batchSize > 100 {
		batchSize = 100
	}

	maxBound := totalRows - batchSize
	if maxBound < 1 {
		maxBound = 1
	}

	offset, err := randomInt(maxBound)
	if err != nil {
		return nil, fmt.Errorf("huggingface: random offset: %w", err)
	}

	rows, err := c.fetchRows(ctx, offset, batchSize)
	if err != nil {
		return nil, err
	}

	var puzzles []*models.Puzzle
	for _, row := range rows {
		puzzle, err := toPuzzle(row)
		if err != nil {
			continue
		}
		if difficulty != "" && puzzle.Difficulty != difficulty {
			continue
		}
		puzzles = append(puzzles, puzzle)
		if len(puzzles) >= count {
			break
		}
	}

	if len(puzzles) == 0 {
		return nil, fmt.Errorf("huggingface: no candidate puzzles found for difficulty %q", difficulty)
	}

	return puzzles, nil
}

func (c *Client) doGet(ctx context.Context, endpoint string) (string, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", 0, fmt.Errorf("huggingface: build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("huggingface: http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("huggingface: read body: %w", err)
	}

	return string(body), resp.StatusCode, nil
}

func toPuzzle(row map[string]any) (*models.Puzzle, error) {
	id := asString(row["PuzzleId"])
	fen := asString(row["FEN"])
	movesRaw := strings.Fields(asString(row["Moves"]))
	themesRaw := parseThemes(asString(row["Themes"]))
	rating := asInt(row["Rating"])

	if id == "" || fen == "" || len(movesRaw) == 0 {
		return nil, fmt.Errorf("huggingface: row missing required puzzle fields")
	}

	return &models.Puzzle{
		ID:              id,
		FEN:             fen,
		Moves:           movesRaw,
		InitialPly:      0,
		Rating:          rating,
		RatingDeviation: asInt(row["RatingDeviation"]),
		Popularity:      asInt(row["Popularity"]),
		NbPlays:         asInt(row["NbPlays"]),
		Themes:          themesRaw,
		GameURL:         asString(row["GameUrl"]),
		Difficulty:      models.RatingToDifficulty(rating),
		Source:          "huggingface-lichess",
	}, nil
}

func parseThemes(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	parts := strings.Fields(raw)
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		cleaned := strings.TrimSpace(part)
		cleaned = strings.TrimPrefix(cleaned, "[")
		cleaned = strings.TrimSuffix(cleaned, "]")
		cleaned = strings.Trim(cleaned, "'\"")
		if cleaned != "" {
			out = append(out, cleaned)
		}
	}
	return out
}

func asString(v any) string {
	if v == nil {
		return ""
	}
	switch cast := v.(type) {
	case string:
		return strings.TrimSpace(cast)
	case fmt.Stringer:
		return strings.TrimSpace(cast.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", v))
	}
}

func asInt(v any) int {
	switch cast := v.(type) {
	case float64:
		return int(cast)
	case int:
		return cast
	case int64:
		return int(cast)
	case json.Number:
		i, _ := cast.Int64()
		return int(i)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(cast))
		return i
	default:
		parsed, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprintf("%v", cast)))
		return parsed
	}
}

func randomInt(max int) (int, error) {
	if max <= 0 {
		return 0, fmt.Errorf("max must be > 0")
	}
	n, err := crand.Int(crand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
