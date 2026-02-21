package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/openrouter"
)

// LichessAPI defines the subset of lichess.Client used by PuzzleService.
type LichessAPI interface {
	HasToken() bool
	GetDailyPuzzle(ctx context.Context) (*models.LichessPuzzleResponse, error)
	GetPuzzleByID(ctx context.Context, id string) (*models.LichessPuzzleResponse, error)
	GetNextPuzzle(ctx context.Context, difficulty string) (*models.LichessPuzzleResponse, error)
}

type OpenRouterAPI interface {
	IsConfigured() bool
	CreateCompletion(ctx context.Context, messages []openrouter.Message) (string, error)
	CreateCompletionWithModel(ctx context.Context, model string, messages []openrouter.Message) (string, error)
}

type DatasetAPI interface {
	GetRandomPuzzle(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error)
}

// PuzzleService orchestrates puzzle retrieval and enrichment.
type PuzzleService struct {
	lichess        LichessAPI
	ai             OpenRouterAPI
	dataset        DatasetAPI
	fallbackModels []string

	mu        sync.Mutex
	recentIDs map[models.DifficultyLevel][]string
}

// SetFallbackModels configures additional models to try if the primary fails.
func (s *PuzzleService) SetFallbackModels(models []string) {
	s.fallbackModels = models
}

// New returns a PuzzleService backed by the given Lichess client.
func New(lc LichessAPI, ai OpenRouterAPI, dataset DatasetAPI) *PuzzleService {
	return &PuzzleService{
		lichess: lc,
		ai:      ai,
		dataset: dataset,
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

func (s *PuzzleService) GenerateFromAI(ctx context.Context, req models.AIPuzzleRequest) (*models.Puzzle, error) {
	if s.ai == nil || !s.ai.IsConfigured() {
		return nil, fmt.Errorf("puzzle: AI provider is not configured")
	}
	if err := validateAIPuzzleRequest(req); err != nil {
		return nil, err
	}

	// Build the list of models to try: primary first, then fallbacks
	modelsToTry := []string{""} // empty string = use default model
	for _, m := range s.fallbackModels {
		modelsToTry = append(modelsToTry, m)
	}

	var lastErr error
	for _, model := range modelsToTry {
		messages := buildAIPromptMessages(req)
		var parseErr error
		var content string

		for attempt := 0; attempt < 2; attempt++ {
			var generated string
			var err error
			if model == "" {
				generated, err = s.ai.CreateCompletion(ctx, messages)
			} else {
				generated, err = s.ai.CreateCompletionWithModel(ctx, model, messages)
			}
			if err != nil {
				lastErr = fmt.Errorf("model %q: %w", model, err)
				break // try next model
			}
			content = generated

			puzzle, err := parseAIPuzzleResponse(content, req.Difficulty)
			if err == nil {
				if puzzle.ID == "" {
					puzzle.ID = fmt.Sprintf("ai-%d", time.Now().UnixNano())
				}
				puzzle.Source = "ai-openrouter"
				return puzzle, nil
			}

			parseErr = err
			messages = buildAICorrectionMessages(req, content, err)
		}

		if parseErr != nil {
			lastErr = fmt.Errorf("model %q parse failed: %w", model, parseErr)
		}
	}

	return nil, fmt.Errorf("puzzle: all models failed to generate valid puzzle: %w", lastErr)
}

func (s *PuzzleService) GenerateFromDataset(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error) {
	if err := validateDifficulty(difficulty); err != nil {
		return nil, err
	}
	if s.dataset == nil {
		return nil, fmt.Errorf("puzzle: dataset provider is not configured")
	}

	puzzle, err := s.dataset.GetRandomPuzzle(ctx, difficulty)
	if err != nil {
		return nil, fmt.Errorf("puzzle: fetch from dataset: %w", err)
	}

	return puzzle, nil
}

func (s *PuzzleService) enrich(raw *models.LichessPuzzleResponse) *models.Puzzle {
	p := raw.ToCanonical()

	if raw.Game.Pgn != "" {
		fen, setupMove := extractPuzzlePosition(raw.Game.Pgn, raw.Puzzle.InitialPly)
		if fen != "" {
			p.FEN = fen
		}
		// Lichess solution does NOT include the opponent's setup move.
		// The frontend expects moves[0] to be the computer's (opponent) setup
		// move, so we must prepend it.
		if setupMove != "" {
			p.Moves = append([]string{setupMove}, p.Moves...)
		}
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
