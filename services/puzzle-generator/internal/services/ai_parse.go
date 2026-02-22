package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

// ---------------------------------------------------------------------------
// RAG selection parsing – the AI returns {"selected_index": N}
// ---------------------------------------------------------------------------

// ragSelection is the expected JSON shape from the RAG prompt.
type ragSelection struct {
	SelectedIndex int `json:"selected_index"`
}

// parseRAGSelectionResponse extracts the selected puzzle from the AI's reply.
// It handles JSON objects, plain numbers, and noisy outputs gracefully.
func parseRAGSelectionResponse(raw string, candidates []*models.Puzzle) (*models.Puzzle, error) {
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no candidate puzzles available")
	}

	content := strings.TrimSpace(raw)

	// 1) Try to extract a JSON object with selected_index.
	jsonPayload := extractJSONObject(content)
	if jsonPayload != "" {
		var sel ragSelection
		if err := json.Unmarshal([]byte(jsonPayload), &sel); err == nil {
			if sel.SelectedIndex >= 0 && sel.SelectedIndex < len(candidates) {
				return candidates[sel.SelectedIndex], nil
			}
		}
	}

	// 2) Try to find a bare integer in the response.
	re := regexp.MustCompile(`\b(\d+)\b`)
	if m := re.FindStringSubmatch(content); len(m) > 1 {
		if idx, err := strconv.Atoi(m[1]); err == nil {
			if idx >= 0 && idx < len(candidates) {
				return candidates[idx], nil
			}
		}
	}

	// 3) Fallback — return the first candidate.
	return candidates[0], nil
}

// ---------------------------------------------------------------------------
// Legacy helpers (kept for potential future use)
// ---------------------------------------------------------------------------

func extractJSONObject(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "```") {
		trimmed = strings.TrimPrefix(trimmed, "```")
		trimmed = strings.TrimPrefix(trimmed, "json")
		trimmed = strings.TrimSpace(strings.TrimSuffix(trimmed, "```"))
	}

	start := strings.Index(trimmed, "{")
	if start == -1 {
		return ""
	}
	depth := 0
	for i := start; i < len(trimmed); i++ {
		switch trimmed[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return trimmed[start : i+1]
			}
		}
	}
	return ""
}

var _ = regexp.MustCompile(`^[a-h][1-8][a-h][1-8][qrbn]?$`)
