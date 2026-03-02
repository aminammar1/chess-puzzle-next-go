export const sourceAccents = {
  green: {
    border: "border-green-500/15 hover:border-green-500/40",
    icon: "bg-green-500/10 text-green-400",
    chipColor: "green" as const,
    glow: "hover:shadow-green-500/10",
  },
  blue: {
    border: "border-blue-500/15 hover:border-blue-500/40",
    icon: "bg-blue-500/10 text-blue-400",
    chipColor: "blue" as const,
    glow: "hover:shadow-blue-500/10",
  },
  purple: {
    border: "border-purple-500/15 hover:border-purple-500/40",
    icon: "bg-purple-500/10 text-purple-400",
    chipColor: "purple" as const,
    glow: "hover:shadow-purple-500/10",
  },
};

export const challengeSources = [
  {
    icon: "♞",
    title: "Lichess Puzzles",
    description:
      "Real puzzles from Lichess rated games. Difficulty-filtered with unique deduplication.",
    accent: "green" as const,
    tag: "Popular",
    href: "/puzzles/lichess",
  },
  {
    icon: "♜",
    title: "Dataset Puzzles",
    description:
      "From the Lichess puzzle database on HuggingFace. Millions of rated puzzles.",
    accent: "blue" as const,
    tag: "4M+ Puzzles",
    href: "/puzzles/dataset",
  },
  {
    icon: "♛",
    title: "AI Generated",
    description: "Custom puzzles created by AI. Describe the theme and difficulty you want.",
    accent: "purple" as const,
    tag: "Pro",
    href: "/puzzles/ai",
  },
];

export const homeFeatures = [
  {
    icon: "♟",
    title: "Drag & Click",
    description: "Intuitive piece movement — drag or click to move",
    href: "",
  },
  {
    icon: "🎤",
    title: "Voice Control",
    description: 'Say "e2 to e4" — try the Voice Lab!',
    href: "/voice-test",
  },
  {
    icon: "✦",
    title: "Smart Hints",
    description: "Visual hints that highlight the source square",
    href: "",
  },
  {
    icon: "♔",
    title: "Daily Challenge",
    description: "New Lichess puzzle every day with calendar view",
    href: "/daily",
  },
];

export const howItWorksSteps = [
  {
    step: "01",
    title: "Pick a Source",
    desc: "Choose Lichess, Dataset, or AI-generated puzzles. Filter by difficulty or theme.",
    icon: "🎯",
  },
  {
    step: "02",
    title: "Solve & Learn",
    desc: "Drag, click, or speak your moves. Get instant feedback with hints when stuck.",
    icon: "🧩",
  },
  {
    step: "03",
    title: "Track Progress",
    desc: "Review your solving history, improve your rating, and tackle daily challenges.",
    icon: "📈",
  },
];

export const footerPartners = ["Lichess", "HuggingFace", "AI"];
