package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
)

// LichessAPI defines the subset of lichess.Client used by PuzzleService.
type LichessAPI interface {
	HasToken() bool
	GetDailyPuzzle(ctx context.Context) (*models.LichessPuzzleResponse, error)
	GetPuzzleByID(ctx context.Context, id string) (*models.LichessPuzzleResponse, error)
	GetNextPuzzle(ctx context.Context, difficulty string) (*models.LichessPuzzleResponse, error)
}

// PuzzleService orchestrates puzzle retrieval and enrichment.
type PuzzleService struct {
	lichess LichessAPI

	mu        sync.Mutex
	recentIDs map[models.DifficultyLevel][]string
}

// New returns a PuzzleService backed by the given Lichess client.
func New(lc LichessAPI) *PuzzleService {
	return &PuzzleService{
		lichess: lc,
		recentIDs: map[models.DifficultyLevel][]string{
			models.DifficultyEasy:   {},
			models.DifficultyMedium: {},
			models.DifficultyHard:   {},
		},
	}
}

// GetByDifficulty returns a puzzle filtered by difficulty.
func (s *PuzzleService) GetByDifficulty(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error) {
	if err := validateDifficulty(difficulty); err != nil {
		return nil, err
	}

	lichessDiff := models.LichessDifficultyParam[difficulty]
	const maxAttempts = 4

	var last *models.LichessPuzzleResponse
	for i := 0; i < maxAttempts; i++ {
		raw, err := s.lichess.GetNextPuzzle(ctx, lichessDiff)
		if err != nil {
			return nil, fmt.Errorf("puzzle: fetch from Lichess: %w", err)
		}

		last = raw
		id := raw.Puzzle.ID
		if id == "" {
			break
		}

		if !s.seenRecently(difficulty, id) {
			s.remember(difficulty, id)
			return s.enrich(raw), nil
		}
	}

	if last != nil && last.Puzzle.ID != "" {
		s.remember(difficulty, last.Puzzle.ID)
	}
	if last == nil {
		return nil, fmt.Errorf("puzzle: empty response from Lichess")
	}

	return s.enrich(last), nil
}

// GetByID returns a specific puzzle by its Lichess puzzle ID.
func (s *PuzzleService) GetByID(ctx context.Context, id string) (*models.Puzzle, error) {
	if !validPuzzleID(id) {
		return nil, fmt.Errorf("puzzle: invalid ID format %q", id)
	}

	raw, err := s.lichess.GetPuzzleByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("puzzle: fetch by id %q: %w", id, err)
	}

	return s.enrich(raw), nil
}

// GetDaily returns the Lichess puzzle of the day.
func (s *PuzzleService) GetDaily(ctx context.Context) (*models.Puzzle, error) {
	raw, err := s.lichess.GetDailyPuzzle(ctx)
	if err != nil {
		return nil, fmt.Errorf("puzzle: fetch daily: %w", err)
	}
	return s.enrich(raw), nil
}

func (s *PuzzleService) enrich(raw *models.LichessPuzzleResponse) *models.Puzzle {
	p := raw.ToCanonical()
	if fen := extractFENFromPGN(raw.Game.Pgn); fen != "" {
		p.FEN = fen
	}
	return p
}

const recentWindowSize = 30

func (s *PuzzleService) seenRecently(difficulty models.DifficultyLevel, id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	ids := s.recentIDs[difficulty]
	for _, seen := range ids {
		if seen == id {
			return true
		}
	}
	return false
}

func (s *PuzzleService) remember(difficulty models.DifficultyLevel, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ids := append(s.recentIDs[difficulty], id)
	if len(ids) > recentWindowSize {
		ids = ids[len(ids)-recentWindowSize:]
	}
	s.recentIDs[difficulty] = ids
}
