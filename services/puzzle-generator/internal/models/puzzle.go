package models

// Puzzle is the canonical puzzle representation returned by the API.
type Puzzle struct {
	ID              string          `json:"id"`
	FEN             string          `json:"fen"`
	Moves           []string        `json:"moves"`
	InitialPly      int             `json:"initialPly"`
	Rating          int             `json:"rating"`
	RatingDeviation int             `json:"ratingDeviation"`
	Popularity      int             `json:"popularity"`
	NbPlays         int             `json:"nbPlays"`
	Themes          []string        `json:"themes"`
	GameURL         string          `json:"gameUrl,omitempty"`
	Difficulty      DifficultyLevel `json:"difficulty"`
	Source          string          `json:"source"`
}

// LichessPuzzleResponse is the raw Lichess API puzzle response shape.
type LichessPuzzleResponse struct {
	Puzzle struct {
		ID              string   `json:"id"`
		InitialPly      int      `json:"initialPly"`
		Solution        []string `json:"solution"`
		Themes          []string `json:"themes"`
		Rating          int      `json:"rating"`
		RatingDeviation int      `json:"ratingDeviation"`
		Popularity      int      `json:"popularity"`
		NbPlays         int      `json:"nbPlays"`
	} `json:"puzzle"`
	Game struct {
		ID    string `json:"id"`
		Pgn   string `json:"pgn"`
		Clock string `json:"clock"`
		Perf  struct {
			Name string `json:"name"`
		} `json:"perf"`
		Rated   bool `json:"rated"`
		Players []struct {
			Name   string `json:"name"`
			Color  string `json:"color"`
			Rating int    `json:"rating"`
		} `json:"players"`
	} `json:"game"`
}

// ToCanonical converts a LichessPuzzleResponse into the canonical Puzzle model.
func (r *LichessPuzzleResponse) ToCanonical() *Puzzle {
	gameURL := ""
	if r.Game.ID != "" {
		gameURL = "https://lichess.org/" + r.Game.ID
	}
	return &Puzzle{
		ID:              r.Puzzle.ID,
		FEN:             "",
		Moves:           r.Puzzle.Solution,
		InitialPly:      r.Puzzle.InitialPly,
		Rating:          r.Puzzle.Rating,
		RatingDeviation: r.Puzzle.RatingDeviation,
		Popularity:      r.Puzzle.Popularity,
		NbPlays:         r.Puzzle.NbPlays,
		Themes:          r.Puzzle.Themes,
		GameURL:         gameURL,
		Difficulty:      RatingToDifficulty(r.Puzzle.Rating),
		Source:          "lichess",
	}
}

// ErrorResponse is the standard API error envelope.
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}
