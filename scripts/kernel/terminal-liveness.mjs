// Shared terminal-frame classifier for Kernel and Op supervision.  Orca's
// connected/writable flags prove that a terminal can receive input; they do
// not prove that an LLM turn is still running.  Provider TUIs also keep their
// input row visible while active, so current activity wins over readyPrompt.

export function classifyAgentScreen(screen) {
  const lines = String(screen ?? '').split(/\r?\n/).filter(Boolean);
  const recentLines = lines.slice(-14);
  const recent = recentLines.join('\n');
  // Provider TUIs can render a child/managed-worker transcript inside the
  // Kernel terminal.  Those quoted rows are prefixed with a box-drawing rail
  // (for example ` │ • Working ...`) and describe the child, not the current
  // Kernel turn.  Classifying them as top-level activity strands a filed
  // report at a Kernel input prompt because both the event wake and watchdog
  // incorrectly conclude that the Kernel is still active.
  const topLevelRecent = recentLines
    .filter(line => !/^\s*[│┃┆┊]/u.test(line))
    .join('\n');
  const interactiveGate = /approve once|permission (?:required|request)|trust the authors|allow `[^`]+` commands|confirm\s*[·•]/i;
  const failure = /not logged in|authentication (?:failed|required)|session expired|fatal error|agent child exited|process exited/i;
  const active = /(?:^|\n)\s*[•*]?\s*(?:Working|Thinking|Running)\b|esc (?:twice )?to (?:interrupt|cancel)|background terminal running|(?:^|\n)[^\n]*[⠀-⣿][^\n]*\d/i;
  // The prompt row may contain a provider message (for example Orca's
  // "You have orchestration messages") rather than "Ask ...". Any non-empty
  // prompt row is turn-idle unless a current activity marker above wins.
  const readyPrompt = /(?:^|\n)\s*[>›❯❭]\s*(?:\S|$)|(?:^|\n)\s*(?:Ask Codex|Ask Claude|Message Devin|Enter a prompt)\b/im;

  if (interactiveGate.test(topLevelRecent)) return { state: 'interactive-gate', recent };
  if (failure.test(topLevelRecent)) return { state: 'failed', recent };
  if (active.test(topLevelRecent)) return { state: 'active', recent };
  if (readyPrompt.test(topLevelRecent)) return { state: 'turn-idle', recent };
  return { state: 'unknown', recent };
}
