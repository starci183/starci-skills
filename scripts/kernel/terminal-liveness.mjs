// Shared terminal-frame classifier for Kernel and Op supervision.  Orca's
// connected/writable flags prove that a terminal can receive input; they do
// not prove that an LLM turn is still running.  Provider TUIs also keep their
// input row visible while active, so current activity wins over readyPrompt.

// Screens that wait for a human answer before any turn can run. The runtime
// names the gate and stops; answering it (directory trust, first-run setup,
// a tool approval) is the owner's decision.
const INTERACTIVE_GATES = [
  { gate: 'codex-directory-trust', pattern: /do you trust the contents of this directory/i },
  { gate: 'claude-first-run-onboarding', pattern: /let's get started|choose the text style/i },
  { gate: 'workspace-trust', pattern: /trust the authors/i },
  // An agent CLI's own multiple-choice question (Devin's ask dialog, Claude's
  // AskUserQuestion). Its selection cursor looks like an input prompt, and a
  // wake typed into it lands in the "Other" answer field.
  { gate: 'agent-question-dialog', pattern: /(?:↑↓|arrow keys)(?: to)? navigate[^\n]*(?:↵|enter)(?: to)? select|(?:↵|enter) to select[^\n]*navigate|not ready to answer|type your own/i },
  { gate: 'tool-approval', pattern: /approve once|permission (?:required|request)|allow `[^`]+` commands|confirm\s*[·•]/i },
];

export const WEDGE_MINUTES = 30;

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
  const failure = /not logged in|authentication (?:failed|required)|session expired|fatal error|agent child exited|process exited/i;
  // A status word counts only as a spinner/status line, never as the Kernel's
  // own prose: a yield summary headed "Running now:" once read as activity,
  // and both the watchdog and the report wake skipped a Kernel that sat at its
  // prompt with a filed report.
  const active = /(?:^|\n)\s*[•*○◦]?\s*(?:Working|Thinking|Running)\b(?!\s*:|\s+now\b)|esc (?:twice )?to (?:interrupt|cancel)|background terminal running|(?:^|\n)[^\n]*[⠀-⣿][^\n]*\d/i;
  // The prompt row may contain a provider message (for example Orca's
  // "You have orchestration messages") rather than "Ask ...". Any non-empty
  // prompt row is turn-idle unless a current activity marker above wins.
  const readyPrompt = /(?:^|\n)\s*[>›❯❭]\s*(?:\S|$)|(?:^|\n)\s*(?:Ask Codex|Ask Claude|Message Devin|Enter a prompt)\b/im;

  const gate = INTERACTIVE_GATES.find(({ pattern }) => pattern.test(topLevelRecent));
  if (gate) return { state: 'interactive-gate', gate: gate.gate, recent };
  if (failure.test(topLevelRecent)) return { state: 'failed', recent };
  if (active.test(topLevelRecent)) {
    // A turn whose spinner has run past WEDGE_MINUTES while its one shell
    // command still shows no output is stuck, not working: a Collab worker sat
    // 60 minutes on `... | xargs grep` reading stdin, and "active" hid it.
    const spinner = /(?:Working|Thinking|Running tools)\b[^\n]*/.exec(topLevelRecent)?.[0] ?? '';
    const minutes = Number(/(\d+)h/.exec(spinner)?.[1] ?? 0) * 60 + Number(/(\d+)m\b/.exec(spinner)?.[1] ?? 0);
    if (minutes >= WEDGE_MINUTES && /No output yet/i.test(recent)) return { state: 'wedged', minutes, recent };
    return { state: 'active', recent };
  }
  // Devin queues a message sent while a turn runs; when the turn ends the
  // idle prompt waits for Enter and nothing else happens. Only an idle screen
  // qualifies: Enter during a running turn would cut into it.
  if (/Press Enter to send queued messages/i.test(topLevelRecent)) return { state: 'queued-input', recent };
  if (readyPrompt.test(topLevelRecent)) return { state: 'turn-idle', recent };
  return { state: 'unknown', recent };
}
