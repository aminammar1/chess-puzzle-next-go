package main

import (
"fmt"
"strings"
"github.com/notnil/chess"
)

func main() {
	pgn := `[Event "FIDE World Cup 2017"]
[Site "Tbilisi GEO"]
[Date "2017.09.09"]
[Round "4.3"]
[White "Carlsen,M"]
[Black "Bu Xiangzhi"]
[Result "1/2-1/2"]
[WhiteElo "2827"]
[BlackElo "2710"]
[EventDate "2017.09.03"]
[ECO "C55"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 h6 5. O-O d6 6. c3 g6 7. Re1 Bg7 8.
Nbd2 O-O 9. Bb3 Re8 10. h3 Be6 11. Bc2 d5 12. a4 a6 13. a5 Qd7 14. b4 Rad8
15. Qe2 Nh5 16. Nb3 Qc8 17. Nc5 d4 18. Ba4 dxc3 19. Bxc6 bxc6 20. Qc2 Bxh3
21. gxh3 Qg4+ 22. Kh2 Qxf3 23. Rg1 Nf4 24. Rg3 Qh5 25. Nxa6 Ne2 26. Re3 Nd4
27. Qxc3 f5 28. Bb2 f4 29. Qc4+ Kh7 30. Rh3 Qe2 31. Bxd4 Rxd4 32. Qf7 Rf8
33. Qxc7 Qxf2+ 34. Kh1 f3 35. Rg1 Rxd3 36. Qxc6 Rf6 37. Qc4 Rd2 38. Qf1 Qd4
39. Rxf3 Qxe4 40. Rg3 Rd3 41. Kg2 Rd2+ 42. Kh1 Rd3 43. Kg2 Rd2+ 44. Kh1 1/2-1/2`

	pgnReader, _ := chess.PGN(strings.NewReader(pgn))
	game := chess.NewGame(pgnReader)
	fmt.Println(game.Position().String())
}
