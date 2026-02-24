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
  return /(^|\s)(play|start|listen)(\s|$)/.test(command)
    || /(^|\s)(auto mode|play auto|enable auto)(\s|$)/.test(command);
}

export function isStopCommand(text: string): boolean {
  const command = normalizeVoiceCommand(text);
  return /(^|\s)(stop|stop listening|close|quit|disable auto|auto off|stop auto)(\s|$)/.test(command);
}
