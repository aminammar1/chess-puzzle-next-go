package models

// DifficultyLevel represents the difficulty of a puzzle.
type DifficultyLevel string

const (
	DifficultyEasy   DifficultyLevel = "easy"
	DifficultyMedium DifficultyLevel = "medium"
	DifficultyHard   DifficultyLevel = "hard"
)

// DifficultyRatingBounds maps difficulty levels to Lichess puzzle rating ranges.
var DifficultyRatingBounds = map[DifficultyLevel][2]int{
	DifficultyEasy:   {0, 1299},
	DifficultyMedium: {1300, 1799},
	DifficultyHard:   {1800, 9999},
}

// LichessDifficultyParam maps our difficulty levels to Lichess API difficulty strings.
var LichessDifficultyParam = map[DifficultyLevel]string{
	DifficultyEasy:   "easiest",
	DifficultyMedium: "normal",
	DifficultyHard:   "hardest",
}

// RatingToDifficulty converts a puzzle rating into our DifficultyLevel.
func RatingToDifficulty(rating int) DifficultyLevel {
	for level, bounds := range DifficultyRatingBounds {
		if rating >= bounds[0] && rating <= bounds[1] {
			return level
		}
	}
	return DifficultyHard
}
