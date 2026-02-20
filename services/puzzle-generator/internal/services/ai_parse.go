package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

func parseAIPuzzleResponse(raw string, requestedDifficulty models.DifficultyLevel) (*models.Puzzle, error) {
	jsonPayload := extractJSONObject(raw)
	if jsonPayload == "" {
		return nil, fmt.Errorf("response does not contain a valid JSON object")
	}

	var parsed models.Puzzle
	if err := json.Unmarshal([]byte(jsonPayload), &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON payload: %w", err)
	}

	if strings.TrimSpace(parsed.FEN) == "" {
		return nil, fmt.Errorf("missing fen")
	}
	if !isLikelyFEN(parsed.FEN) {
		return nil, fmt.Errorf("fen is not in valid full FEN format")
	}
	if len(parsed.Moves) < 2 {
		return nil, fmt.Errorf("moves must contain at least 2 UCI moves")
	}

	if err := validateDifficulty(parsed.Difficulty); err != nil {
		if requestedDifficulty != "" {
			parsed.Difficulty = requestedDifficulty
		} else {
			parsed.Difficulty = models.DifficultyMedium
		}
	}

	for i := range parsed.Moves {
		parsed.Moves[i] = strings.TrimSpace(parsed.Moves[i])
		if !isLikelyUCIMove(parsed.Moves[i]) {
			return nil, fmt.Errorf("invalid uci move at index %d: %q", i, parsed.Moves[i])
		}
	}
	parsed.Themes = compactStrings(parsed.Themes)
	if len(parsed.Themes) == 0 {
		parsed.Themes = []string{"tactic"}
	}
	if parsed.Rating <= 0 {
		parsed.Rating = 1600
	}
	if parsed.RatingDeviation <= 0 {
		parsed.RatingDeviation = 100
	}

	return &parsed, nil
}

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

func compactStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

var uciMoveRe = regexp.MustCompile(`^[a-h][1-8][a-h][1-8][qrbn]?$`)

func isLikelyUCIMove(move string) bool {
	return uciMoveRe.MatchString(strings.ToLower(strings.TrimSpace(move)))
}

func isLikelyFEN(fen string) bool {
	parts := strings.Fields(strings.TrimSpace(fen))
	if len(parts) != 6 {
		return false
	}

	ranks := strings.Split(parts[0], "/")
	if len(ranks) != 8 {
		return false
	}
	for _, rank := range ranks {
		squares := 0
		for _, ch := range rank {
			if ch >= '1' && ch <= '8' {
				squares += int(ch - '0')
				continue
			}
			if strings.ContainsRune("pnbrqkPNBRQK", ch) {
				squares++
				continue
			}
			return false
		}
		if squares != 8 {
			return false
		}
	}

	if parts[1] != "w" && parts[1] != "b" {
		return false
	}
	if parts[2] != "-" {
		for _, ch := range parts[2] {
			if !strings.ContainsRune("KQkq", ch) {
				return false
			}
		}
	}
	if parts[3] != "-" && !regexp.MustCompile(`^[a-h][36]$`).MatchString(parts[3]) {
		return false
	}
	if _, err := strconv.Atoi(parts[4]); err != nil {
		return false
	}
	if _, err := strconv.Atoi(parts[5]); err != nil {
		return false
	}

	return true
}
