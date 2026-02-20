package services

import (
	"fmt"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/openrouter"
)

func buildAIPromptMessages(req models.AIPuzzleRequest) []openrouter.Message {
	difficulty := req.Difficulty
	if difficulty == "" {
		difficulty = models.DifficultyMedium
	}

	systemPrompt := `You are a chess puzzle composer.
Return exactly one valid JSON object and no extra text.

Required JSON schema:
{
	"id": "ai-custom-id",
	"fen": "<valid FEN with 6 space-separated fields>",
	"moves": ["e2e4", "e7e5"],
	"initialPly": 0,
	"rating": 1600,
	"ratingDeviation": 100,
	"popularity": 0,
	"nbPlays": 0,
	"themes": ["fork", "middlegame"],
	"gameUrl": "",
	"difficulty": "easy|medium|hard"
}

Rules:
1) Use only legal chess data.
2) fen must be a full FEN: piece placement, side to move, castling, en passant, halfmove, fullmove.
3) moves must be UCI moves only (e.g. e2e4, g7g8q), no SAN.
4) Provide at least 2 moves and maximum 8 moves.
5) themes must be concise lowercase tags.
6) difficulty must be exactly one of easy, medium, hard.
7) Do not use markdown fences or explanations.
8) If unsure, still return valid JSON following the schema.`

	userPrompt := fmt.Sprintf(
		"Create one %s custom chess puzzle. Intent: %s. Keep it tactical and solvable from the provided FEN by following the moves sequence.",
		difficulty,
		strings.TrimSpace(req.Prompt),
	)

	return []openrouter.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
}

func buildAICorrectionMessages(req models.AIPuzzleRequest, previousOutput string, previousErr error) []openrouter.Message {
	base := buildAIPromptMessages(req)
	correction := fmt.Sprintf(
		"Your previous output was invalid: %v. Rewrite the answer as ONE valid JSON object only. Critical: moves must be UCI format (e2e4, g7g8q), and fen must be full 6-field FEN.",
		previousErr,
	)

	return append(base,
		openrouter.Message{Role: "assistant", Content: strings.TrimSpace(previousOutput)},
		openrouter.Message{Role: "user", Content: correction},
	)
}
