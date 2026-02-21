package services

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/notnil/chess"
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

func validateAIPuzzleRequest(req models.AIPuzzleRequest) error {
	if strings.TrimSpace(req.Prompt) == "" {
		return fmt.Errorf("puzzle: prompt is required")
	}
	if len(strings.TrimSpace(req.Prompt)) < 8 {
		return fmt.Errorf("puzzle: prompt must be at least 8 characters")
	}
	if err := validateDifficulty(req.Difficulty); err != nil {
		return err
	}
	return nil
}

// extractFENFromPGN parses the [FEN "..."] header from a PGN string.
func extractFENFromPGN(pgn string) string {
	re := regexp.MustCompile(`\[FEN "([^"]+)"\]`)
	if m := re.FindStringSubmatch(pgn); len(m) > 1 {
		return m[1]
	}
	return ""
}

// extractPuzzlePosition parses a PGN, derives the FEN at the given ply, and
// extracts the setup move (the PGN move at that ply) in UCI notation.
//
// Lichess convention:
//   - initialPly  = number of half-moves already played when the puzzle starts.
//   - positions[initialPly] = board BEFORE the opponent's setup move.
//   - PGN move at index initialPly = the setup move that creates the tactic.
//   - puzzle.solution starts with the PLAYER's first move (after the setup).
//
// The caller must prepend setupMoveUCI to the solution to get the full
// move sequence expected by the frontend.
func extractPuzzlePosition(pgn string, ply int) (fen string, setupMoveUCI string) {
	// Strategy 1: notnil/chess PGN parser (most reliable).
	reader := strings.NewReader(pgn)
	pgnFunc, err := chess.PGN(reader)
	if err == nil {
		game := chess.NewGame(pgnFunc)
		positions := game.Positions()
		moves := game.Moves()

		if ply < len(positions) {
			fen = positions[ply].String()
		} else if len(positions) > 0 {
			fen = positions[len(positions)-1].String()
		}

		// The setup move sits at index `ply` in the moves slice.
		if ply < len(moves) {
			setupMoveUCI = moves[ply].String()
		}

		if fen != "" {
			return fen, setupMoveUCI
		}
	}

	// Strategy 2: manual tokenisation fallback (cannot extract the setup move).
	fen = fenAtPlyManual(pgn, ply)
	return fen, ""
}

// fenAtPlyManual strips PGN headers, tokenises move-text, and replays via
// notnil/chess AlgebraicNotation. Used as a fallback when the PGN reader
// cannot parse the input.
func fenAtPlyManual(pgn string, ply int) string {
	lines := strings.Split(pgn, "\n")
	var moveText []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l == "" || strings.HasPrefix(l, "[") {
			continue
		}
		moveText = append(moveText, l)
	}
	raw := strings.Join(moveText, " ")

	// Tokenise: strip move numbers (e.g. "1.", "12.", "1...", "1...") and results.
	moveNumRe := regexp.MustCompile(`^\d+\.+$`)
	tokens := strings.Fields(raw)
	var sans []string
	for _, t := range tokens {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		// Pure move number like "1." or "1..."
		if moveNumRe.MatchString(t) {
			continue
		}
		// Move number glued to SAN like "1.e4" or "1...e5"
		if idx := strings.LastIndex(t, "."); idx != -1 {
			before := t[:idx+1]
			after := t[idx+1:]
			if moveNumRe.MatchString(before) || regexp.MustCompile(`^\d+\.+`).MatchString(t) {
				if after != "" {
					sans = append(sans, after)
				}
				continue
			}
		}
		// Result markers
		if t == "1-0" || t == "0-1" || t == "1/2-1/2" || t == "*" {
			continue
		}
		sans = append(sans, t)
	}

	game := chess.NewGame(chess.UseNotation(chess.AlgebraicNotation{}))
	limit := ply
	if limit > len(sans) {
		limit = len(sans)
	}
	for i := 0; i < limit; i++ {
		if err := game.MoveStr(sans[i]); err != nil {
			if i > 0 {
				return game.Position().String()
			}
			return ""
		}
	}
	return game.Position().String()
}
