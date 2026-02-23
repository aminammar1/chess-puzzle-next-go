"""
Tests for the chess move parser.

Run with:  pytest tests/test_parser.py -v
"""

import pytest
from app.parser.move_parser import parse_transcript, ParsedMove


# ---------------------------------------------------------------------------
# Square-to-square moves (UCI style)
# ---------------------------------------------------------------------------

class TestSquareToSquare:
    def test_e2_to_e4(self):
        r = parse_transcript("e2 to e4")
        assert r.uci == "e2e4"
        assert r.san == "e2e4"  # plain square-to-square

    def test_e2_e4_no_to(self):
        r = parse_transcript("e2 e4")
        assert r.uci == "e2e4"

    def test_pawn_e2_to_e4(self):
        r = parse_transcript("pawn e2 to e4")
        assert r.uci == "e2e4"

    def test_knight_g1_to_f3(self):
        r = parse_transcript("knight g1 to f3")
        assert r.uci == "g1f3"
        assert "N" in (r.san or "")

    def test_bishop_c1_takes_f4(self):
        r = parse_transcript("bishop c1 takes f4")
        assert r.uci == "c1f4"
        assert "x" in (r.san or "")

    def test_promotion_e7_to_e8_promote_queen(self):
        r = parse_transcript("e7 to e8 promote queen")
        assert r.uci == "e7e8q"
        assert r.promotion == "q"
        assert "=Q" in (r.san or "")


# ---------------------------------------------------------------------------
# Piece-to-square moves (SAN style)
# ---------------------------------------------------------------------------

class TestPieceToSquare:
    def test_knight_to_f3(self):
        r = parse_transcript("knight to f3")
        assert r.san == "Nf3"

    def test_bishop_takes_d5(self):
        r = parse_transcript("bishop takes d5")
        assert r.san == "Bxd5"

    def test_queen_h5(self):
        r = parse_transcript("queen h5")
        assert r.san == "Qh5"

    def test_rook_to_a8(self):
        r = parse_transcript("rook to a8")
        assert r.san == "Ra8"

    def test_horse_to_c3(self):
        """'horse' is a common alias for knight."""
        r = parse_transcript("horse to c3")
        assert r.san == "Nc3"

    def test_king_to_e1(self):
        r = parse_transcript("king to e1")
        assert r.san == "Ke1"


# ---------------------------------------------------------------------------
# Castling
# ---------------------------------------------------------------------------

class TestCastling:
    def test_castle_kingside(self):
        r = parse_transcript("castle king side")
        assert r.san == "O-O"
        assert r.uci == "e1g1"

    def test_castle_queenside(self):
        r = parse_transcript("castle queen side")
        assert r.san == "O-O-O"
        assert r.uci == "e1c1"

    def test_short_castle(self):
        r = parse_transcript("short castle")
        assert r.san == "O-O"

    def test_long_castle(self):
        r = parse_transcript("long castle")
        assert r.san == "O-O-O"

    def test_castles_kingside(self):
        r = parse_transcript("castles kingside")
        assert r.san == "O-O"


# ---------------------------------------------------------------------------
# Pawn moves
# ---------------------------------------------------------------------------

class TestPawnMoves:
    def test_pawn_to_e4(self):
        r = parse_transcript("pawn to e4")
        assert r.san == "e4"

    def test_bare_e4(self):
        r = parse_transcript("e4")
        assert r.san == "e4"

    def test_pawn_d5(self):
        r = parse_transcript("pawn d5")
        assert r.san == "d5"


# ---------------------------------------------------------------------------
# Pawn captures
# ---------------------------------------------------------------------------

class TestPawnCaptures:
    def test_a_takes_b4(self):
        r = parse_transcript("a takes b4")
        assert r.san == "axb4"

    def test_d_captures_e5(self):
        r = parse_transcript("d captures e5")
        assert r.san == "dxe5"


# ---------------------------------------------------------------------------
# Check / Checkmate
# ---------------------------------------------------------------------------

class TestCheckAnnotations:
    def test_knight_f3_check(self):
        r = parse_transcript("knight to f3 check")
        assert r.san is not None
        assert r.san.endswith("+")

    def test_queen_h7_checkmate(self):
        r = parse_transcript("queen h7 checkmate")
        assert r.san is not None
        assert r.san.endswith("#")


# ---------------------------------------------------------------------------
# Spoken numbers / NATO alphabet
# ---------------------------------------------------------------------------

class TestSpokenNumbers:
    def test_spoken_numbers(self):
        r = parse_transcript("e two to e four")
        assert r.uci == "e2e4"

    def test_nato_alpha(self):
        r = parse_transcript("echo four")
        assert r.san == "e4"


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_garbage_returns_none(self):
        r = parse_transcript("hello world how are you")
        assert r.san is None
        assert r.uci is None
        assert r.confidence == 0.0

    def test_empty_string(self):
        r = parse_transcript("")
        assert r.san is None
        assert r.uci is None

    def test_mixed_case(self):
        r = parse_transcript("Knight TO F3")
        assert r.san == "Nf3"

    def test_extra_whitespace(self):
        r = parse_transcript("  e2   to    e4  ")
        assert r.uci == "e2e4"
