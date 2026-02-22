package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/chess-puzzle-next/puzzle-generator/internal/models"
	"github.com/chess-puzzle-next/puzzle-generator/pkg/nvidia"
)

// LichessAPI defines the subset of lichess.Client used by PuzzleService.
type LichessAPI interface {
	HasToken() bool
	GetDailyPuzzle(ctx context.Context) (*models.LichessPuzzleResponse, error)
	GetPuzzleByID(ctx context.Context, id string) (*models.LichessPuzzleResponse, error)
	GetNextPuzzle(ctx context.Context, difficulty string) (*models.LichessPuzzleResponse, error)
}

// AIAPI abstracts the LLM inference provider (NVIDIA).
type AIAPI interface {
	IsConfigured() bool
	CreateCompletion(ctx context.Context, messages []nvidia.Message) (string, error)
}

// DatasetAPI abstracts access to the HuggingFace puzzle dataset.
type DatasetAPI interface {
	GetRandomPuzzle(ctx context.Context, difficulty models.DifficultyLevel) (*models.Puzzle, error)
	GetCandidatePuzzles(ctx context.Context, difficulty models.DifficultyLevel, count int) ([]*models.Puzzle, error)
}

// PuzzleService orchestrates puzzle retrieval and enrichment.
type PuzzleService struct {
	lichess LichessAPI
	ai      AIAPI
	dataset DatasetAPI

	mu        sync.Mutex
	recentIDs map[models.DifficultyLevel][]string
}

// New returns a PuzzleService backed by the given clients.
func New(lc LichessAPI, ai AIAPI, dataset DatasetAPI) *PuzzleService {
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

// GenerateFromAI uses a RAG (Retrieval-Augmented Generation) pipeline:
//  1. Fetch candidate puzzles from the HuggingFace dataset.
//  2. Send the candidates + user prompt to the NVIDIA model.
//  3. The model selects the best-matching puzzle.
func (s *PuzzleService) GenerateFromAI(ctx context.Context, req models.AIPuzzleRequest) (*models.Puzzle, error) {
	if s.ai == nil || !s.ai.IsConfigured() {
		return nil, fmt.Errorf("puzzle: AI provider (NVIDIA) is not configured")
	}
	if s.dataset == nil {
		return nil, fmt.Errorf("puzzle: dataset provider is not configured (needed for RAG)")
	}
	if err := validateAIPuzzleRequest(req); err != nil {
		return nil, err
	}

	// --- Step 1: Retrieve candidate puzzles from the dataset ---
	const candidateCount = 8
	t0 := time.Now()
	candidates, err := s.dataset.GetCandidatePuzzles(ctx, req.Difficulty, candidateCount)
	if err != nil {
		return nil, fmt.Errorf("puzzle: fetch RAG candidates: %w", err)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("puzzle: no candidate puzzles found for RAG")
	}
	log.Printf("[RAG] fetched %d candidates in %s", len(candidates), time.Since(t0))

	// --- Step 2 & 3: Ask the AI to select the best match ---
	messages := buildRAGSelectionPrompt(req, candidates)

	const maxAttempts = 2
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		t1 := time.Now()
		content, err := s.ai.CreateCompletion(ctx, messages)
		log.Printf("[RAG] NVIDIA attempt=%d elapsed=%s err=%v content=%q", attempt, time.Since(t1), err, truncateStr(content, 200))

		if err != nil {
			lastErr = fmt.Errorf("nvidia completion: %w", err)
			break // API error — no point retrying the same request
		}

		puzzle, err := parseRAGSelectionResponse(content, candidates)
		if err == nil {
			puzzle.Source = "ai-rag"
			log.Printf("[RAG] selected puzzle index from AI, total=%s", time.Since(t0))
			return puzzle, nil
		}

		// Build correction prompt and retry.
		lastErr = err
		messages = buildRAGRetryPrompt(req, candidates, content, err)
	}

	// Fallback: if AI selection failed, return the first candidate.
	if len(candidates) > 0 {
		log.Printf("[RAG] falling back to first candidate, lastErr=%v, total=%s", lastErr, time.Since(t0))
		p := candidates[0]
		p.Source = "ai-rag-fallback"
		return p, nil
	}

	return nil, fmt.Errorf("puzzle: RAG pipeline failed: %w", lastErr)
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
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
