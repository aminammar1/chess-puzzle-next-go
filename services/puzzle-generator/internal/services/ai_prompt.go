package services

import (
	"fmt"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/nvidia"
)

// buildRAGSelectionPrompt creates the messages for the RAG puzzle-selection
// pipeline. The AI receives a list of real candidate puzzles from the dataset
// and must pick the one that best matches the user's intent.
func buildRAGSelectionPrompt(req models.AIPuzzleRequest, candidates []*models.Puzzle) []nvidia.Message {
	difficulty := req.Difficulty
	if difficulty == "" {
		difficulty = models.DifficultyMedium
	}

	systemPrompt := `You are a chess puzzle selector. Given a user request and a numbered list of puzzles, pick the best match.
Return ONLY: {"selected_index": N}
No extra text.`

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("User wants: %s (%s difficulty)\n\nPuzzles:\n",
		strings.TrimSpace(req.Prompt), difficulty))

	for i, p := range candidates {
		sb.WriteString(fmt.Sprintf(
			"[%d] Rating:%d Themes:%s\n",
			i, p.Rating, strings.Join(p.Themes, ","),
		))
	}

	return []nvidia.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: sb.String()},
	}
}

// buildRAGRetryPrompt appends a correction turn when the first response
// could not be parsed.
func buildRAGRetryPrompt(req models.AIPuzzleRequest, candidates []*models.Puzzle, previousOutput string, previousErr error) []nvidia.Message {
	base := buildRAGSelectionPrompt(req, candidates)
	correction := fmt.Sprintf(
		"Your previous output was invalid (%v). Reply with ONLY the JSON object {\"selected_index\": N} and nothing else.",
		previousErr,
	)
	return append(base,
		nvidia.Message{Role: "assistant", Content: strings.TrimSpace(previousOutput)},
		nvidia.Message{Role: "user", Content: correction},
	)
}
