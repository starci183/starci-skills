// Shared terminal-frame classifier for Kernel and Op supervision.  Orca's
// connected/writable flags prove that a terminal can receive input; they do
// not prove that an LLM turn is still running.  Provider TUIs also keep their
// input row visible while active, so current activity wins over readyPrompt.

// Screens that wait for a human answer before any turn can run. The runtime
// names the gate and stops; answering it (directory trust, first-run setup,
// a tool approval) is the owner's decision. `remedy` is the exact one-time
// action that clears the gate (<cwd> = the directory the refused terminal was
// launched in); a refusal quotes it so the owner never guesses what to run.
const INTERACTIVE_GATES = [
  { gate: 'codex-directory-trust', pattern: /do you trust the contents of this directory/i,
    remedy: "open a terminal in <cwd>, run `codex`, pick '1. Yes, continue' at the trust prompt, then type /quit" },
  { gate: 'claude-first-run-onboarding', pattern: /let's get started|choose the text style/i,
    remedy: 'open a terminal, run `claude`, finish the first-run setup (text style, sign-in, notices) until its input box shows, then type /exit; that writes hasCompletedOnboarding to ~/.claude.json' },
  // Observed 2026-09-23 on a fresh worktree: "Quick safety check: Is this a
  // project you created or one you trust? … ❯ No, exit" (before tool-approval,
  // whose confirm pattern would otherwise claim it under the wrong name).
  { gate: 'claude-workspace-trust', pattern: /is this a project you created or one you trust/i,
    remedy: "open a terminal in <cwd>, run `claude`, pick 'Yes, I trust this folder', then type /exit" },
  { gate: 'claude-bypass-permissions-consent', pattern: /bypass permissions mode[\s\S]*yes, i accept/i,
    remedy: "open a terminal, run `claude --dangerously-skip-permissions`, pick 'Yes, I accept', then type /exit" },
  // A new Codex release shows "Update available! … 1. Update now 2. Skip 3.
  // Skip until next version … Press enter to continue" before the prompt; it
  // stalled every fresh Codex op launch for three hours on 2026-09-23.
  { gate: 'codex-update-prompt', pattern: /update available![\s\S]*skip until next version/i,
    remedy: "start `codex` once and pick 'Skip until next version', or set check_for_update_on_startup = false in its config.toml" },
  { gate: 'workspace-trust', pattern: /trust the authors/i,
    remedy: 'open a terminal in <cwd>, start the same agent CLI once, answer its workspace-trust prompt, then quit it' },
  // An agent CLI's own multiple-choice question (Devin's ask dialog, Claude's
  // AskUserQuestion). Its selection cursor looks like an input prompt, and a
  // wake typed into it lands in the "Other" answer field.
  { gate: 'agent-question-dialog', pattern: /(?:↑↓|arrow keys)(?: to)? navigate[^\n]*(?:↵|enter)(?: to)? select|(?:↵|enter) to select[^\n]*navigate|not ready to answer|type your own/i,
    remedy: 'answer the question shown in that terminal' },
  { gate: 'tool-approval', pattern: /approve once|permission (?:required|request)|allow `[^`]+` commands|confirm\s*[·•]/i,
    remedy: 'answer the approval prompt in that terminal; a launch that still asks lost its card bypassArgs, so compare its command with the agent card' },
];

/** The one-time action that clears `gate`, with <cwd> filled in, or null. */
export function gateRemedy(gate, { cwd = null } = {}) {
  const remedy = INTERACTIVE_GATES.find((g) => g.gate === gate)?.remedy;
  return remedy ? remedy.replaceAll('<cwd>', cwd ? String(cwd) : 'the launch directory') : null;
}

// A dispatch paste that is still sitting in the provider's input row was never
// submitted (Codex renders it as "› [Pasted Content 5012 chars]"). Only the
// LAST prompt row counts: a transcript row that quotes an earlier paste is not
// the input box. Returns the staged input row, or null.
export const DEFAULT_STAGED_PATTERN = /Pasted Content|\[Pasted text/i;
const INPUT_GLYPH = /^\s*[>›❯❭]\s*/u;
const collapse = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
// A row shorter than this is too generic to call an echo of the sent text.
const MIN_ECHO_CHARS = 12;
/** True when `row` (input glyph and rail stripped) is a verbatim piece of the text sent to the terminal. */
export function echoesSentText(row, sentText) {
  const content = collapse(String(row ?? '').replace(INPUT_GLYPH, ''));
  const sent = typeof sentText === 'string' ? collapse(sentText) : '';
  return content.length >= MIN_ECHO_CHARS && sent.length > 0 && sent.includes(content);
}

/**
 * The unsubmitted input region of a provider frame, or null: {row, start, above, rows}. `start` indexes
 * the rail-stripped last-14 `rows`; `above` is every row before it. Two shapes count:
 *  - the LAST input-glyph row carries a staged marker (`stagedPattern`: "[Pasted Content N chars]") or a
 *    verbatim piece of `sentText`, the text the runtime typed into this terminal;
 *  - with no later glyph row, the frame tail is two or more rows of `sentText` (a TUI that shows the paste
 *    itself in its input box, glyph row empty or scrolled away).
 * A Devin command-terminal worker sat 13 minutes with its whole inline contract in the input box; the
 * contract text says "Running", "Working", "esc to interrupt", so the frame read `active` and `api nudge`
 * skipped it as worker-active (inc-06aeecf432f1). Knowing the sent text is what tells a paste from a turn.
 */
export function stagedInputRegion(screen, { stagedPattern = DEFAULT_STAGED_PATTERN, sentText = null } = {}) {
  // A boxed input row (`│ > text │`) is still the input row: strip the rail.
  const rows = String(screen ?? '').split(/\r?\n/).filter(Boolean).slice(-14)
    .map((line) => line.replace(/^\s*[│┃]\s?/u, ''));
  const echo = (row) => Boolean(sentText) && echoesSentText(row, sentText);
  let glyph = -1;
  for (let i = rows.length - 1; i >= 0; i -= 1) if (INPUT_GLYPH.test(rows[i])) { glyph = i; break; }
  if (glyph >= 0 && (stagedPattern.test(rows[glyph]) || echo(rows[glyph])))
    return { row: rows[glyph].trim(), start: glyph, above: rows.slice(0, glyph), rows };
  if (!sentText) return null;
  const after = rows.map((row, i) => ({ row, i })).filter(({ i }) => i > glyph);
  const echoes = after.filter(({ row }) => echo(row));
  if (echoes.length < 2 || echoes.at(-1).i < rows.length - 3) return null;
  const start = glyph >= 0 ? glyph : echoes[0].i;
  return { row: rows[echoes[0].i].trim(), start, above: rows.slice(0, start), rows };
}

export function stagedInputRow(screen, stagedPattern = DEFAULT_STAGED_PATTERN, { sentText = null } = {}) {
  return stagedInputRegion(screen, { stagedPattern, sentText })?.row ?? null;
}

export const WEDGE_MINUTES = 30;

// Rows that may sit between a live spinner and the provider's input row without
// meaning the turn ended: blank/rule chrome, Claude's todo list under its
// spinner (⎿ ☐ ☒ ...), Codex queued-message rows (↳), and a status/footer row.
const SPINNER_COMPANION = /^\s*$|^\s*[─━═╌┄_-]{3,}|^\s*[⎿↳☐☒◻◼□■✓✔]|^\s*(?:\d+\s+)?(?:queued|messages? queued)\b|^\s*(?:tip|hint)\b/iu;

export function classifyAgentScreen(screen, { stagedPattern = DEFAULT_STAGED_PATTERN, sentText = null } = {}) {
  // An unsubmitted paste in the input row is never a running turn, whatever
  // words the pasted text holds (inc-06aeecf432f1). Only the rows ABOVE the
  // input region decide: a live spinner there is a turn with a queued
  // follow-up (active), a gate or failure there keeps its name, and anything
  // else is `staged-input` - the one Enter-only send submits it.
  const staged = stagedInputRegion(screen, { stagedPattern, sentText });
  if (staged) {
    // The input region stands in as the prompt row, so a spinner followed by
    // a finished answer reads finished exactly as it would above an empty row.
    const above = classifyAgentScreen([...staged.above, '> '].join('\n'), { stagedPattern: /(?!)/ });
    const recent = String(screen ?? '').split(/\r?\n/).filter(Boolean).slice(-14).join('\n');
    if (['active', 'wedged', 'interactive-gate', 'failed'].includes(above.state)) return { ...above, recent };
    return { state: 'staged-input', row: staged.row, recent };
  }
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
  // Claude Code 2.1.280 spins with a star glyph and a random gerund plus a
  // timer ("✶ Osmosing… (1m 0s · ↓ 2.7k tokens)") and no "esc to interrupt";
  // without this marker a working Claude kernel read turn-idle and every
  // watchdog wake landed in its queued-message box.
  // Any Claude spinner row counts, not only the timed one: a hook spinner
  // ("✢ Transmuting… (running PreToolUse hook · 1m 26s · …)") and a todo
  // activeForm spinner ("✽ Reading owned records… (…)") read turn-idle, so
  // status called working ops nudge-ready (inc-dd8b95e58762, inc-5d6556105a98).
  // The star glyphs need only the ellipsis ("✻ Brewed for 1m 3s", a finished
  // turn, has none); "·" and "*" double as bullets, so they also need "(".
  // A tool call still executing ("⎿  Running…", a Bash row offering
  // "(ctrl+b to run in background)") is active too (inc-a579fa590ed8).
  const activeMarker = /esc (?:twice )?to (?:interrupt|cancel)|background terminal running|\(ctrl\+b to run in background\)|(?:^|\n)[^\n]*[⠀-⣿][^\n]*\d|(?:^|\n)\s*[✶✻✳✢✽✺]\s+\S[^\n]*?…|(?:^|\n)\s*[·*]\s+\S[^\n]*?…\s*\(|(?:^|\n)\s*⎿\s+Running\b[^\n]*…/i;
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
