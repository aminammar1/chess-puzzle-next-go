export interface CarouselSlide {
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

export const carouselSlides: CarouselSlide[] = [
  {
    title: "Lichess Daily Puzzles",
    description:
      "Fresh puzzles every day from real Lichess games. Challenge yourself with difficulty-rated tactics.",
    icon: "♞",
    gradient: "from-green-600/20 to-emerald-900/20",
  },
  {
    title: "AI-Generated Challenges",
    description:
      "Describe the puzzle you want — queen sacrifice, fork, discovered attack — and AI creates it for you.",
    icon: "♛",
    gradient: "from-purple-600/20 to-violet-900/20",
  },
  {
    title: "Millions of Puzzles",
    description:
      "Access the entire Lichess puzzle database on HuggingFace. Every theme, every rating, every tactic.",
    icon: "♜",
    gradient: "from-blue-600/20 to-cyan-900/20",
  },
  {
    title: "Voice Control",
    description:
      'Say "e2 to e4" and watch pieces move. Hands-free puzzle solving with speech recognition.',
    icon: "🎤",
    gradient: "from-amber-600/20 to-orange-900/20",
  },
];
