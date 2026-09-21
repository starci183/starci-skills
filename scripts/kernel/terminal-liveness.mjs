// Shared terminal-frame classifier for Kernel and Op supervision.  Orca's
// connected/writable flags prove that a terminal can receive input; they do
// not prove that an LLM turn is still running.  Provider TUIs also keep their
// input row visible while active, so current activity wins over readyPrompt.

export function classifyAgentScreen(screen) {
  const lines = String(screen ?? '').split(/\r?\n/).filter(Boolean);
  const recent = lines.slice(-14).join('\n');
  const interactiveGate = /approve once|permission (?:required|request)|trust the authors|allow `[^`]+` commands|confirm\s*[·•]/i;
  const failure = /not logged in|authentication (?:failed|required)|session expired|fatal error|agent child exited|process exited/i;
  const active = /(?:^|\n)\s*[•*]?\s*(?:Working|Thinking|Running)\s*(?:\(|·|\.\.\.|$)|esc to (?:interrupt|cancel)|background terminal running/i;
  // The prompt row may contain a provider message (for example Orca's
  // "You have orchestration messages") rather than "Ask ...". Any non-empty
  // prompt row is turn-idle unless a current activity marker above wins.
  const readyPrompt = /(?:^|\n)\s*[>›❯❭]\s*\S|(?:^|\n)\s*(?:Ask Codex|Ask Claude|Message Devin|Enter a prompt)\b/im;

  if (interactiveGate.test(recent)) return { state: 'interactive-gate', recent };
  if (failure.test(recent)) return { state: 'failed', recent };
  if (active.test(recent)) return { state: 'active', recent };
  if (readyPrompt.test(recent)) return { state: 'turn-idle', recent };
  return { state: 'unknown', recent };
}
