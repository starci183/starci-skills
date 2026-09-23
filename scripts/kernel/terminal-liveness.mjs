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

// Rows that may sit between a live spinner and the provider's input row without
// meaning the turn ended: blank/rule chrome, Claude's todo list under its
// spinner (⎿ ☐ ☒ ...), Codex queued-message rows (↳), and a status/footer row.
const SPINNER_COMPANION = /^\s*$|^\s*[─━═╌┄_-]{3,}|^\s*[⎿↳☐☒◻◼□■✓✔]|^\s*(?:\d+\s+)?(?:queued|messages? queued)\b|^\s*(?:tip|hint)\b/iu;

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
  const topRows = recentLines.filter(line => !/^\s*[│┃┆┊]/u.test(line));
  const topLevelRecent = topRows.join('\n');
  const failure = /not logged in|authentication (?:failed|required)|session expired|fatal error|agent child exited|process exited/i;
  // A status word counts only as a spinner/status line, never as the Kernel's
  // own prose: a yield summary headed "Running now:" once read as activity,
  // and both the watchdog and the report wake skipped a Kernel that sat at its
  // prompt with a filed report.
  // Status words are matched case-sensitively: a spinner writes "Working",
  // "Thinking", "Running"; a wrapped prose line that starts with "running."
  // (a Collab Kernel yield summary) is not one.
  const statusWord = /(?:^|\n)\s*[•*○◦]?\s*(?:Working|Thinking|Running)\b(?!\s*:|\s+now\b|[^\n]*:[ \t]*(?:\n|$))/;
  const activeMarker = /esc (?:twice )?to (?:interrupt|cancel)|background terminal running|(?:^|\n)[^\n]*[⠀-⣿][^\n]*\d/i;
  const active = { test: (text) => statusWord.test(text) || activeMarker.test(text) };
  // The prompt row may contain a provider message (for example Orca's
  // "You have orchestration messages") rather than "Ask ...". Any non-empty
  // prompt row is turn-idle unless a current activity marker above wins.
  const readyPrompt = /(?:^|\n)\s*[>›❯❭]\s*(?:\S|$)|(?:^|\n)\s*(?:Ask Codex|Ask Claude|Message Devin|Enter a prompt)\b/im;

  const gate = INTERACTIVE_GATES.find(({ pattern }) => pattern.test(topLevelRecent));
  if (gate) return { state: 'interactive-gate', gate: gate.gate, recent };
  if (failure.test(topLevelRecent)) return { state: 'failed', recent };
  // The LAST rows decide. A spinner row followed by the Kernel's finished
  // answer and then its input row is scrollback of a turn that already ended:
  // a Codex Kernel sat 3.7 hours at its prompt with an old "Working" row in
  // the last lines and the watchdog kept calling it active. A live spinner sits
  // directly above the input row (only chrome/todo/queued rows between).
  // Both patterns anchor on (?:^|\n), so each reads one row as well as a frame.
  const lastIndex = (pattern) => { for (let i = topRows.length - 1; i >= 0; i -= 1) if (pattern.test(topRows[i])) return i; return -1; };
  const lastActive = lastIndex(active), lastPrompt = lastIndex(readyPrompt);
  const finishedAfterSpinner = lastActive >= 0 && lastPrompt > lastActive
    && topRows.slice(lastActive + 1, lastPrompt).some(line => !SPINNER_COMPANION.test(line));
  if (active.test(topLevelRecent) && !finishedAfterSpinner) {
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

/**
 * An `active` screen is trusted only while the terminal is still printing: a
 * provider spinner re-renders its timer every second, so output older than
 * `activeStaleMs` (modules/models/runtimes.yaml allocation.liveness.activeStaleMs)
 * means the frame is frozen, and the terminal is treated as turn-idle with the
 * reason `stale-active`. Every other state, and an unknown output age, passes
 * through unchanged. Returns {state, staleActive, reason}.
 */
export function staleAwareState(state, outputAgeMs, activeStaleMs) {
  const age = Number(outputAgeMs), limit = Number(activeStaleMs);
  const stale = state === 'active' && outputAgeMs != null && Number.isFinite(age) && Number.isFinite(limit) && limit > 0 && age > limit;
  return stale ? { state: 'turn-idle', staleActive: true, reason: 'stale-active' } : { state, staleActive: false, reason: null };
}
