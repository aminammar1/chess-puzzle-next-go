"""
Chess move parser
==================
Converts natural-language voice transcripts into UCI and SAN chess notation.

Supported phrases (examples):
    "e2 to e4"          → UCI: e2e4,  SAN: e4
    "knight to f3"      → UCI: None,  SAN: Nf3
    "bishop takes d5"   → UCI: None,  SAN: Bxd5
    "pawn to e4"        → UCI: None,  SAN: e4
    "castle king side"  → UCI: e1g1,  SAN: O-O
    "queen d1"          → UCI: None,  SAN: Qd1
    "rook a1 to a8"     → UCI: a1a8,  SAN: Ra8
    "knight b1 c3"      → UCI: b1c3,  SAN: Nc3
    "a takes b4"        → UCI: None,  SAN: axb4
    "promote to queen"  → appended =Q
    "knight b to d2"    → SAN: Nbd2  (disambiguated)
    "rook 1 to a5"      → SAN: R1a5  (rank disambiguation)

The parser works in two passes:
  1. Normalise & clean the transcript (numbers → ranks, synonyms → standard).
  2. Try multiple regex patterns from most specific to least specific.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

@dataclass
class ParsedMove:
    """A parsed chess move."""

    raw: str  # original transcript
    san: str | None = None  # e.g. "Nf3", "O-O", "e4"
    uci: str | None = None  # e.g. "e2e4", "e1g1"
    promotion: str | None = None  # "q", "r", "b", "n"
    confidence: float = 1.0


# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------

_PIECE_WORDS: dict[str, str] = {
    "king": "K",
    "queen": "Q",
    "rook": "R",
    "bishop": "B",
    "knight": "N",
    "horse": "N",  # common alias
    "night": "N",  # accent/ASR variant
    "nite": "N",
    "pawn": "",
    # Accent-friendly aliases
    "tower": "R",  # common in many languages
    "castle": "R",  # careful: only as piece name, not "castling"
    # ASR misheard variants
    "note": "N",
    "nice": "N",
    "knife": "N",
    "rock": "R",
    "brook": "R",
    "look": "R",
    "bishup": "B",
    "dish up": "B",
    "kin": "K",
    "keen": "K",
    "clean": "Q",
    "cream": "Q",
}

_FILE_WORDS: dict[str, str] = {
    # NATO phonetic alphabet
    "alpha": "a",
    "alfa": "a",
    "bravo": "b",
    "charlie": "c",
    "delta": "d",
    "echo": "e",
    "foxtrot": "f",
    "golf": "g",
    "hotel": "h",
    # common mis-hearings & accent variants
    "ay": "a",
    "eh": "a",
    "hey": "a",
    "be": "b",
    "bee": "b",
    "bea": "b",
    "see": "c",
    "sea": "c",
    "cee": "c",
    "si": "c",
    "dee": "d",
    "de": "d",
    "he": "e",
    "ee": "e",
    "yi": "e",
    "ef": "f",
    "eff": "f",
    "f.": "f",
    "gee": "g",
    "ji": "g",
    "ge": "g",
    "age": "h",
    "aitch": "h",
    "ach": "h",
    "h.": "h",
    "each": "h",
    # More ASR variants
    "aye": "a",
    "bay": "b",
    "day": "d",
    "fee": "f",
    "jay": "g",
    "hay": "h",
}

_SPOKEN_NUMBERS: dict[str, str] = {
    "one": "1",
    "won": "1",
    "wan": "1",
    "two": "2",
    "to": "",  # handled contextually — "to" is usually the separator
    "too": "2",
    "tu": "2",
    "three": "3",
    "tree": "3",
    "free": "3",
    "four": "4",
    "for": "4",
    "fore": "4",
    "foe": "4",
    "five": "5",
    "fife": "5",
    "six": "6",
    "sicks": "6",
    "sex": "6",
    "seven": "7",
    "sev": "7",
    "eight": "8",
    "ate": "8",
    "ait": "8",
}

_PROMOTION_WORDS: dict[str, str] = {
    "queen": "q",
    "rook": "r",
    "bishop": "b",
    "knight": "n",
    "horse": "n",
}

_CAPTURE_WORDS = {"takes", "captures", "take", "capture", "x", "by", "grabs", "eats"}

_CASTLING_KINGSIDE = {"castle kingside", "castle king side", "castles kingside",
                      "castles king side", "short castle", "king side castle",
                      "kingside castle", "o-o", "castling kingside",
                      "castling king side", "short castling",
                      "king side castling", "castle short",
                      "small castle", "castling short",
                      "casle kingside", "casle king side",  # typo-friendly
                      "kassle kingside", "kassle king side"}

_CASTLING_QUEENSIDE = {"castle queenside", "castle queen side", "castles queenside",
                       "castles queen side", "long castle", "queen side castle",
                       "queenside castle", "o-o-o", "castling queenside",
                       "castling queen side", "long castling",
                       "queen side castling", "castle long",
                       "big castle", "castling long",
                       "casle queenside", "casle queen side",
                       "kassle queenside", "kassle queen side"}

_PIECE_CAPTURE_PATTERN = (
    r"king|queen|rook|bishop|knight|horse|night|nite|tower|"
    r"rock|brook|look|note|nice|knife|bishup|dish\s+up|kin|keen|clean|cream"
)


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Lower-case, strip punctuation, normalise spoken numbers and filler words."""
    text = text.lower().strip()
    # remove punctuation except hyphens
    text = re.sub(r"[^\w\s-]", "", text)
    # remove common speech filler words & ASR artifacts
    _FILLER_WORDS = {
        "um", "uh", "ah", "er", "like", "please", "move", "play",
        "the", "my", "an", "go", "put", "place", "do",
        "i", "want", "would", "make", "okay", "so", "then",
    }
    words = text.split()
    _TYPO_FIXES = {
        "kngith": "knight",
        "knigth": "knight",
        "kngiht": "knight",
        "knigt": "knight",
        "nigth": "knight",
        "ngith": "knight",
        "kight": "knight",
        "knightt": "knight",
    }
    words = [_TYPO_FIXES.get(w, w) for w in words]
    words = [w for w in words if w not in _FILLER_WORDS]
    text = " ".join(words)
    # collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _replace_file_words(text: str) -> str:
    """Replace NATO / spoken file letters."""
    words = text.split()
    result = []
    for w in words:
        if w in _FILE_WORDS:
            result.append(_FILE_WORDS[w])
        else:
            result.append(w)
    return " ".join(result)


def _replace_number_words(text: str) -> str:
    """Replace spoken numbers but be careful with 'to' (separator vs '2')."""
    words = text.split()
    result = []
    for i, w in enumerate(words):
        if w == "to":
            # "to" between two squares is a separator, not "2"
            # e.g. "e2 to e4" — keep as separator
            # but "pawn to e4" — also separator
            result.append("to")
        elif w in _SPOKEN_NUMBERS:
            result.append(_SPOKEN_NUMBERS[w])
        else:
            result.append(w)
    return " ".join(result)


def _merge_split_squares(text: str) -> str:
    """
    Merge a lone file letter followed by a digit into a square.
    e.g. "e 2 to e 4" → "e2 to e4", "echo 4" → (after file-word replace) "e 4" → "e4"
    """
    words = text.split()
    merged: list[str] = []
    i = 0
    while i < len(words):
        # If current word is a single file letter and next is a rank digit
        if (
            i + 1 < len(words)
            and len(words[i]) == 1
            and words[i] in "abcdefgh"
            and len(words[i + 1]) == 1
            and words[i + 1] in "12345678"
        ):
            merged.append(words[i] + words[i + 1])
            i += 2
        else:
            merged.append(words[i])
            i += 1
    return " ".join(merged)


# ---------------------------------------------------------------------------
# Square / piece helpers
# ---------------------------------------------------------------------------

_SQUARE_RE = re.compile(r"[a-h][1-8]")


def _is_square(s: str) -> bool:
    return bool(_SQUARE_RE.fullmatch(s))


def _piece_letter(word: str) -> str | None:
    return _PIECE_WORDS.get(word)


# ---------------------------------------------------------------------------
# Pattern matchers (ordered most specific → least specific)
# ---------------------------------------------------------------------------

def _try_castling(text: str) -> ParsedMove | None:
    for phrase in _CASTLING_KINGSIDE:
        if phrase in text:
            return ParsedMove(raw=text, san="O-O", uci="e1g1")
    for phrase in _CASTLING_QUEENSIDE:
        if phrase in text:
            return ParsedMove(raw=text, san="O-O-O", uci="e1c1")
    return None


def _try_square_to_square(text: str) -> ParsedMove | None:
    """Match: [piece] <sq1> [to|takes] <sq2> [promote queen]"""
    pattern = re.compile(
        r"(?:(king|queen|rook|bishop|knight|horse|night|nite|tower|rock|brook|look|note|nice|knife|bishup|dish\s+up|kin|keen|clean|cream|pawn)\s+)?"
        r"([a-h][1-8])\s+"
        r"(?:to\s+|on\s+|at\s+|into\s+|takes?\s+|captures?\s+|x\s+|grabs?\s+|eats?\s+|by\s+)?"
        r"([a-h][1-8])"
        r"(?:\s+promote(?:s|d)?\s+(?:to\s+)?(queen|rook|bishop|knight|horse))?"
    )
    m = pattern.search(text)
    if not m:
        return None

    piece_word = m.group(1)
    sq_from = m.group(2)
    sq_to = m.group(3)
    promo_word = m.group(4)

    piece = _PIECE_WORDS.get(piece_word, "") if piece_word else ""
    capture = any(w in text[m.start():m.end()] for w in _CAPTURE_WORDS)
    sep = "x" if capture else ""
    promo = ""
    promo_uci = ""
    if promo_word:
        promo = "=" + _PROMOTION_WORDS[promo_word].upper()
        promo_uci = _PROMOTION_WORDS[promo_word]

    san = f"{piece}{sq_from}{sep}{sq_to}{promo}" if piece else f"{sq_from}{sep}{sq_to}{promo}"
    uci = f"{sq_from}{sq_to}{promo_uci}"

    return ParsedMove(raw=text, san=san, uci=uci, promotion=promo_uci or None)


def _try_piece_disambiguated(text: str) -> ParsedMove | None:
    """Match disambiguated piece moves: 'knight b to d2' → Nbd2, 'rook 1 to a5' → R1a5"""
    pattern = re.compile(
        r"(king|queen|rook|bishop|knight|horse|night|nite|tower|rock|brook|look|note|nice|knife|bishup|dish\s+up|kin|keen|clean|cream)\s+"
        r"([a-h]|[1-8])\s+"
        r"(?:to\s+|on\s+|at\s+|into\s+|takes?\s+|captures?\s+|x\s+|grabs?\s+|eats?\s+|by\s+)?"
        r"([a-h][1-8])"
        r"(?:\s+promote(?:s|d)?\s+(?:to\s+)?(queen|rook|bishop|knight|horse))?"
    )
    m = pattern.search(text)
    if not m:
        return None

    piece_word = m.group(1)
    disambig = m.group(2)
    sq_to = m.group(3)
    promo_word = m.group(4)

    piece = _PIECE_WORDS[piece_word]
    if not piece:
        return None  # pawn disambiguation handled elsewhere

    capture = any(w in text[m.start():m.end()] for w in _CAPTURE_WORDS)
    sep = "x" if capture else ""
    promo = ""
    if promo_word:
        promo = "=" + _PROMOTION_WORDS[promo_word].upper()

    san = f"{piece}{disambig}{sep}{sq_to}{promo}"
    return ParsedMove(raw=text, san=san, uci=None, promotion=promo.lstrip("=").lower() or None)


def _try_piece_to_square(text: str) -> ParsedMove | None:
    """Match: <piece> [takes] <sq>  e.g. 'knight to f3', 'bishop takes d5'"""
    pattern = re.compile(
        rf"({_PIECE_CAPTURE_PATTERN})\s+"
        r"(?:to\s+|on\s+|at\s+|into\s+|takes?\s+|captures?\s+|x\s+|grabs?\s+|eats?\s+|by\s+)?"
        rf"(?:(?:the\s+)?(?:{_PIECE_CAPTURE_PATTERN}|pawn)\s+)?"
        r"(?:on\s+|at\s+)?"
        r"([a-h][1-8])"
        r"(?:\s+promote(?:s|d)?\s+(?:to\s+)?(queen|rook|bishop|knight|horse))?"
    )
    m = pattern.search(text)
    if not m:
        return None

    piece_word = m.group(1)
    sq_to = m.group(2)
    promo_word = m.group(3)

    piece = _PIECE_WORDS.get(piece_word, "")
    if piece is None:
        return None
    capture = any(w in text[m.start():m.end()] for w in _CAPTURE_WORDS)
    sep = "x" if capture else ""
    promo = ""
    if promo_word:
        promo = "=" + _PROMOTION_WORDS[promo_word].upper()

    san = f"{piece}{sep}{sq_to}{promo}"
    return ParsedMove(raw=text, san=san, uci=None, promotion=promo.lstrip("=").lower() or None)


def _try_compact_piece_to_square(text: str) -> ParsedMove | None:
        """
        Match compact piece notation emitted by STT, e.g.:
            "nb5", "n b5", "qc7", "k e2"
        """
        pattern = re.compile(r"\b([kqrbn])\s*([a-h][1-8])\b")
        m = pattern.search(text)
        if not m:
                return None

        piece_letter = m.group(1).upper()
        sq_to = m.group(2)
        return ParsedMove(raw=text, san=f"{piece_letter}{sq_to}", uci=None)


def _try_take_with_piece(text: str) -> ParsedMove | None:
    """
    Match capture-first phrasing where the moving piece is spoken at the end, e.g.:
        "take d5 with knight" -> Nxd5
        "capture bishop on e6 with rook" -> Rxe6
    """
    pattern = re.compile(
        rf"(?:take|takes|capture|captures|x|grab|grabs|eat|eats)\s+"
        rf"(?:(?:the\s+)?(?:{_PIECE_CAPTURE_PATTERN}|pawn)\s+)?"
        r"(?:on\s+|at\s+)?"
        r"([a-h][1-8])\s+"
        rf"(?:with\s+)?({_PIECE_CAPTURE_PATTERN})"
    )
    m = pattern.search(text)
    if not m:
        return None

    sq_to = m.group(1)
    piece_word = m.group(2)
    piece = _PIECE_WORDS.get(piece_word)
    if not piece:
        return None

    return ParsedMove(raw=text, san=f"{piece}x{sq_to}", uci=None)


def _try_pawn_move(text: str) -> ParsedMove | None:
    """Match: pawn [to] <sq> or just <sq>  e.g. 'pawn to e4', 'e4'"""
    pattern = re.compile(
        r"(?:pawn\s+)?(?:to\s+)?\b([a-h][1-8])\b"
        r"(?:\s+promote(?:s|d)?\s+(?:to\s+)?(queen|rook|bishop|knight|horse))?"
    )
    m = pattern.search(text)
    if not m:
        return None
    sq_to = m.group(1)
    promo_word = m.group(2)
    promo = ""
    if promo_word:
        promo = "=" + _PROMOTION_WORDS[promo_word].upper()
    san = f"{sq_to}{promo}"
    return ParsedMove(raw=text, san=san, uci=None, promotion=promo.lstrip("=").lower() or None)


def _try_pawn_capture(text: str) -> ParsedMove | None:
    """Match: <file> takes <sq>  e.g. 'a takes b4', 'd takes e5'"""
    pattern = re.compile(
        r"([a-h])\s+(?:takes?\s+|captures?\s+|x\s+|grabs?\s+|eats?\s+|by\s+)([a-h][1-8])"
        r"(?:\s+promote(?:s|d)?\s+(?:to\s+)?(queen|rook|bishop|knight|horse))?"
    )
    m = pattern.search(text)
    if not m:
        return None
    file_from = m.group(1)
    sq_to = m.group(2)
    promo_word = m.group(3)
    promo = ""
    if promo_word:
        promo = "=" + _PROMOTION_WORDS[promo_word].upper()
    san = f"{file_from}x{sq_to}{promo}"
    return ParsedMove(raw=text, san=san, uci=None, promotion=promo.lstrip("=").lower() or None)


def _try_check_checkmate(result: ParsedMove | None, text: str) -> ParsedMove | None:
    """Append + or # if the user said 'check' or 'checkmate'."""
    if result is None or result.san is None:
        return result
    if "checkmate" in text or "check mate" in text:
        result.san += "#"
    elif "check" in text:
        result.san += "+"
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_transcript(transcript: str) -> ParsedMove:
    """
    Parse a voice transcript into a chess move.

    Returns a ParsedMove with at least ``san`` or ``uci`` populated
    if the transcript could be understood, otherwise both are None.
    """
    raw = transcript
    text = _normalise(transcript)
    text = _replace_file_words(text)
    text = _replace_number_words(text)
    text = _merge_split_squares(text)

    # Try each pattern in order of specificity
    for parser in (
        _try_castling,
        _try_square_to_square,
        _try_piece_disambiguated,
        _try_take_with_piece,
        _try_piece_to_square,
        _try_compact_piece_to_square,
        _try_pawn_capture,
        _try_pawn_move,
    ):
        result = parser(text)
        if result is not None:
            result.raw = raw
            result = _try_check_checkmate(result, text)
            return result

    # Nothing matched
    return ParsedMove(raw=raw, san=None, uci=None, confidence=0.0)
