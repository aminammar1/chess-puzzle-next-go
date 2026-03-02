"use client";

import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SkipBack,
  SkipForward,
  Undo2,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { getVoiceStatusConfig } from "@/lib/voice-ui";
import Navbar from "@/components/layout/Navbar";
import Tooltip from "@/components/ui/Tooltip";
import Chip from "@/components/ui/Chip";
import Card, { CardBody } from "@/components/ui/Card";
import Divider from "@/components/ui/Divider";
import VoiceStateIcon from "@/components/voice/VoiceStateIcon";
import { useVoiceTestController } from "@/hooks/useVoiceTestController";

export default function VoiceTestPage() {
  const { colors } = useTheme();
  const {
    game,
    orientation,
    browseFen,
    squareStyles,
    turnLabel,
    isGameOver,
    isLive,
    moveHistory,
    activeHistoryIdx,
    micStatus,
    autoMode,
    transcript,
    parsedSan,
    voiceError,
    handleDrop,
    handleCanDrag,
    handleSquareClick,
    handlePieceClick,
    goToStart,
    goBack,
    goForward,
    goToEnd,
    undoMove,
    resetBoard,
    setViewIndex,
    toggleAutoMode,
    stopListening,
    startListening,
  } = useVoiceTestController();

  const sc = getVoiceStatusConfig(micStatus, autoMode, parsedSan);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-center"
        >
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)] sm:text-3xl md:text-4xl">
            Voice{" "}
            <span className="bg-gradient-to-r from-[var(--accent-gold)] via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Lab
            </span>
          </h1>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] sm:text-sm">
            Play any move — drag, click, or speak it. Built for blind &amp; hands-free play.
          </p>
        </motion.div>

        <div className="flex flex-col items-start gap-6 lg:flex-row lg:justify-center lg:gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[560px] lg:max-w-[520px] xl:max-w-[560px] mx-auto lg:mx-0"
          >
            <div className="mb-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-transparent"
                  style={{
                    backgroundColor: game.turn() === "w" ? "#fff" : "#222",
                    boxShadow: game.turn() === "w" ? "0 0 8px rgba(255,255,255,0.3)" : "0 0 8px rgba(0,0,0,0.5)",
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{turnLabel} to move</span>
              </div>
              {isGameOver && (
                <Chip color="amber" variant="flat" size="sm">
                  {game.isCheckmate() ? "Checkmate!" : game.isDraw() ? "Draw" : "Game Over"}
                </Chip>
              )}
              {!isLive && !isGameOver && (
                <Chip color="amber" variant="dot" size="sm">Reviewing</Chip>
              )}
            </div>

            <div className="chess-board-wrapper overflow-hidden rounded-xl shadow-xl shadow-black/30">
              <Chessboard
                options={{
                  position: browseFen,
                  boardOrientation: orientation,
                  onPieceDrop: handleDrop,
                  canDragPiece: handleCanDrag,
                  onSquareClick: handleSquareClick,
                  onPieceClick: handlePieceClick,
                  animationDurationInMs: 200,
                  boardStyle: { borderRadius: "12px" },
                  darkSquareStyle: { backgroundColor: colors.boardDark },
                  lightSquareStyle: { backgroundColor: colors.boardLight },
                  squareStyles,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-center gap-1">
              {([
                { label: "Start (Home)", action: goToStart, disabled: moveHistory.length === 0, icon: <SkipBack size={14} /> },
                { label: "Back (←)", action: goBack, disabled: moveHistory.length === 0, icon: <ChevronLeft size={14} /> },
                { label: "Forward (→)", action: goForward, disabled: isLive || moveHistory.length === 0, icon: <ChevronRight size={14} /> },
                { label: "End", action: goToEnd, disabled: isLive || moveHistory.length === 0, icon: <SkipForward size={14} /> },
              ] as const).map((btn) => (
                <Tooltip key={btn.label} content={btn.label} side="top">
                  <button onClick={btn.action} disabled={btn.disabled} className="board-ctrl-btn">
                    {btn.icon}
                  </button>
                </Tooltip>
              ))}
              <Divider orientation="vertical" className="mx-1.5 h-5" />
              <Tooltip content="Undo" side="top">
                <button onClick={undoMove} disabled={moveHistory.length === 0} className="board-ctrl-btn">
                  <Undo2 size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Reset board" side="top">
                <button onClick={resetBoard} className="board-ctrl-btn">
                  <RotateCcw size={14} />
                </button>
              </Tooltip>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-[560px] lg:max-w-[340px] mx-auto lg:mx-0 space-y-4"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
              <div className="mb-5 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2">
                  <span className={`text-xs font-medium transition-colors ${!autoMode ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    Push to talk
                  </span>
                  <button
                    onClick={() => toggleAutoMode(!autoMode)}
                    disabled={isGameOver}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.06] transition-colors duration-200
                      ${autoMode ? "bg-emerald-600" : "bg-white/[0.08]"}
                      ${isGameOver ? "cursor-not-allowed opacity-40" : ""}
                    `}
                    role="switch"
                    aria-checked={autoMode}
                    aria-label="Toggle auto listening mode"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                        ${autoMode ? "translate-x-4" : "translate-x-0.5"}
                      `}
                    />
                  </button>
                  <span className={`text-xs font-medium transition-colors ${autoMode ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                    Auto
                  </span>
                  {autoMode && micStatus === "listening" && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <Tooltip
                  content={
                    autoMode
                      ? micStatus === "listening" ? "Listening… tap to stop" : "Auto mode active"
                      : micStatus === "listening" ? "Tap to stop" : "Tap to speak a move"
                  }
                  side="top"
                >
                  <button
                    onClick={() => {
                      if (autoMode) {
                        toggleAutoMode(false);
                      } else {
                        micStatus === "listening" ? stopListening() : startListening();
                      }
                    }}
                    disabled={isGameOver}
                    className={`
                      group relative flex h-16 w-16 items-center justify-center rounded-full
                      border border-white/[0.1] ring-[3px] ${sc.ring} ${sc.bg}
                      transition-all duration-300 ease-out
                      ${isGameOver ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-105 active:scale-95"}
                    `}
                    aria-label={micStatus === "listening" ? "Stop listening" : "Start listening"}
                  >
                    {micStatus === "listening" && (
                      <span className="absolute inset-[-6px] rounded-full border border-red-500/25 animate-ping pointer-events-none" />
                    )}
                    {micStatus === "stopped" && (
                      <span className="absolute inset-[-5px] rounded-full border border-blue-400/35 animate-pulse pointer-events-none" />
                    )}
                    <span className="relative z-10">
                      <VoiceStateIcon status={micStatus} size={24} idleClassName="text-[var(--accent-gold)] transition-colors group-hover:text-amber-300" />
                    </span>
                  </button>
                </Tooltip>

                <span className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${sc.text}`}>
                  {sc.label}
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={micStatus + transcript}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 flex min-h-[32px] items-center justify-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  {micStatus === "idle" && !transcript && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {autoMode ? (<>Auto mode — speak moves · say <span className="font-medium text-emerald-400/80">&quot;stop&quot;</span> to end</>) : (
                        <>Tap mic &amp; say <span className="font-medium text-[var(--text-secondary)]">&quot;e2 to e4&quot;</span> · say <span className="font-medium text-emerald-400/80">&quot;play&quot;</span> for auto</>
                      )}
                    </span>
                  )}
                  {micStatus === "listening" && (
                    <span className="flex items-center gap-2 text-[11px] font-medium text-red-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      {transcript ? `"${transcript}"` : "Listening…"}
                    </span>
                  )}
                  {micStatus === "processing" && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                      <span>Processing move</span>
                      <span className="inline-flex">
                        {[0, 140, 280].map((delay) => (
                          <span
                            key={delay}
                            className="mx-[1px] h-1 w-1 rounded-full bg-amber-400/90 animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                  {micStatus === "success" && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      ✓ {parsedSan}
                    </span>
                  )}
                  {micStatus === "error" && (
                    <span className="text-[11px] text-red-400/90">{voiceError}</span>
                  )}
                  {micStatus === "stopped" && (
                    <span className="text-[11px] text-blue-300/90">Auto listening stopped</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Notation</span>
                  <span className="ml-auto text-[10px] font-normal tabular-nums text-[var(--text-muted)]">
                    {Math.ceil(moveHistory.length / 2)} moves
                  </span>
                </h3>
                <div className="max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                  {moveHistory.length === 0 ? (
                    <p className="py-4 text-center text-[11px] italic text-[var(--text-muted)]">Play or speak a move…</p>
                  ) : (
                    <div className="grid grid-cols-[28px_1fr_1fr] gap-y-0.5 text-xs">
                      {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                        const wIdx = i * 2;
                        const bIdx = i * 2 + 1;
                        return (
                          <div key={i} className="contents">
                            <span className="py-0.5 text-[var(--text-muted)] tabular-nums">{i + 1}.</span>
                            <button
                              onClick={() => setViewIndex(wIdx)}
                              className={`rounded px-1 py-0.5 text-left font-medium transition-colors ${activeHistoryIdx === wIdx ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]" : "text-[var(--text-primary)] hover:bg-white/[0.06]"}`}
                            >
                              {moveHistory[wIdx]?.san}
                            </button>
                            {moveHistory[bIdx] ? (
                              <button
                                onClick={() => setViewIndex(bIdx)}
                                className={`rounded px-1 py-0.5 text-left font-medium transition-colors ${activeHistoryIdx === bIdx ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]" : "text-[var(--text-secondary)] hover:bg-white/[0.06]"}`}
                              >
                                {moveHistory[bIdx].san}
                              </button>
                            ) : <span />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Voice examples
                </h3>
                <div className="space-y-1.5">
                  {['"e2 to e4"', '"knight to f3"', '"bishop takes d5"', '"castle king side"', '"queen h5 check"'].map((ex) => (
                    <div key={ex} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]/60" />
                      <span className="font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Shortcuts
                </h3>
                <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                  {[
                    ["←  →", "Navigate moves"],
                    ["Home / End", "First / last move"],
                  ].map(([keys, desc]) => (
                    <div key={keys} className="flex items-center justify-between">
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">{keys}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
