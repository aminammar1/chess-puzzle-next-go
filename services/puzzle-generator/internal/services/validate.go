package services

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

var puzzleIDRe = regexp.MustCompile(`^[a-zA-Z0-9]{5,8}$`)

func validPuzzleID(id string) bool {
	return puzzleIDRe.MatchString(strings.TrimSpace(id))
}

func validateDifficulty(d models.DifficultyLevel) error {
	switch d {
	case models.DifficultyEasy, models.DifficultyMedium, models.DifficultyHard, "":
		return nil
	default:
		return fmt.Errorf("puzzle: unknown difficulty %q; valid values: easy, medium, hard", d)
	}
}

// extractFENFromPGN parses the [FEN "..."] header from a PGN string.
func extractFENFromPGN(pgn string) string {
	re := regexp.MustCompile(`\[FEN "([^"]+)"\]`)
	if m := re.FindStringSubmatch(pgn); len(m) > 1 {
		return m[1]
	}
	return ""
}
