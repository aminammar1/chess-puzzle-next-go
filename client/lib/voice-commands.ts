export function normalizeVoiceCommand(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlayCommand(text: string): boolean {
  const command = normalizeVoiceCommand(text);
  if (/(^|\s)(stop|quit|close)(\s|$)/.test(command)) return false;
  const tokens = command.split(" ").filter(Boolean);
  const playLike = new Set(["play", "plae", "pley", "plei", "plai", "player", "plate", "pray", "please", "place"]);
  const hasPlayLikeToken = tokens.some((token) => playLike.has(token) || token.startsWith("pla") || token.startsWith("ple"));

  return /(^|\s)(play|start|listen|resume|continue|go|begin|reactivate)(\s|$)/.test(command)
    || /(^|\s)(auto mode|play auto|enable auto|auto on|start auto)(\s|$)/.test(command)
    || hasPlayLikeToken;
}

export function isStopCommand(text: string): boolean {
  const command = normalizeVoiceCommand(text);
  return /(^|\s)(stop|pause|stop listening|close|quit|disable auto|auto off|stop auto|cancel)(\s|$)/.test(command);
}
