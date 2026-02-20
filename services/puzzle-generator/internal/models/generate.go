package models

type AIPuzzleRequest struct {
	Prompt     string          `json:"prompt"`
	Difficulty DifficultyLevel `json:"difficulty"`
}
