// terminal-liveness-patterns.mjs — the screen patterns of terminal-liveness.mjs that are assembled from named parts: each one is the
// `new RegExp` of its parts joined, so a pattern reads as a list of alternatives and has one meaning.

// POSIX: "$", "#", "%", "user@host:~/x$", "user@host ~ %", "bash-5.2$", "(venv) user@host:~$"
export const POSIX_PROMPT_ROW = new RegExp([
  String.raw`^(?:\([^)]*\)\s*)?(?:[\w.-]+@[\w.-]+(?:[:\s]\S*)?\s*|[\w.-]+-\d+(?:\.\d+)*)?`,
  '[$#%]$',
].join(''));

// POSIX: "user@host:~/x$ ..."
export const POSIX_PROMPT_PREFIX = new RegExp([
  String.raw`^(?:\([^)]*\)\s*)?[\w.-]+@[\w.-]+`,
  String.raw`(?::\S*|\s+\S+)?\s*[$#%](?=\s|$)`,
].join(''));

// Rows that may sit between a live spinner and the provider's input row without
// meaning the turn ended: blank/rule chrome, Claude's todo list under its
// spinner (⎿ ☐ ☒ ...), Codex queued-message rows (↳), and a status/footer row.
// Codex hangs the detail of its status row under it on a tree rail ("  └ orca orchestration ask
// ...", a background terminal's command) and holds a message sent mid-turn under "• Messages to be
// submitted after next tool call"; both read as a finished answer, so a Codex worker waiting on a
// background terminal, or holding a delivered nudge, read turn-idle (inc-29dc6dc51975,
// inc-b261cf2c56c5, inc-c2793e212c63).
// Claude folds a long todo list into "… +3 pending" (inc-a579fa590ed8); Devin's model/context
// footer ("SWE-2 Max  Context: 70k / 262k") may sit above its input row.
export const SPINNER_COMPANION = new RegExp([
  String.raw`^\s*$`,
  String.raw`|^\s*[─━═╌┄_-]{3,}`,
  String.raw`|^\s*[⎿↳└├☐☒◻◼□■✓✔]`,
  String.raw`|^\s*(?:\d+\s+)?(?:queued|messages? queued)\b`,
  String.raw`|^\s*(?:tip|hint)\b`,
  String.raw`|^\s*[•*]?\s*messages? to be submitted\b`,
  String.raw`|^\s*…\s*\+\d+\s+\w`,
  String.raw`|^\s*(?:SWE-[\w.-]+(?:\s+\w+)?\s+)?Context:?\s*\d`,
].join(''), 'iu');

// Status words are matched case-sensitively: a spinner writes "Working",
// "Thinking", "Running"; a wrapped prose line that starts with "running."
// (a Collab Kernel yield summary) is not one.
export const STATUS_WORD = new RegExp([
  String.raw`(?:^|\n)\s*[•*○◦]?\s*(?:Working|Thinking|Running)`,
  String.raw`\b(?!\s*:|\s+now\b|[^\n]*:[ \t]*(?:\n|$))`,
].join(''));

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
export const ACTIVE_MARKER = new RegExp([
  'esc (?:twice )?to (?:interrupt|cancel)',
  '|background terminal running',
  String.raw`|\(ctrl\+b to run in background\)`,
  String.raw`|(?:^|\n)[^\n]*[⠀-⣿][^\n]*\d`,
  String.raw`|(?:^|\n)\s*[✶✻✳✢✽✺]\s+\S[^\n]*?…`,
  String.raw`|(?:^|\n)\s*[·*]\s+\S[^\n]*?…\s*\(`,
  String.raw`|(?:^|\n)\s*⎿\s+Running\b[^\n]*…`,
].join(''), 'i');

// A boxed dialog is drawn behind a rail on each row; the rail is stripped before the gate patterns read the rows.
export const FRAME_RAIL_PREFIX = new RegExp([String.raw`^\s*[│┃]`, String.raw`\s?`].join(''), 'u');
export const FRAME_RAIL_SUFFIX = new RegExp([String.raw`\s*[│┃]`, String.raw`\s*$`].join(''), 'u');

// The elapsed time of a spinner row ("1h 3m 2s"): its hours and its minutes.
export const ELAPSED_HOURS = new RegExp([String.raw`(\d+)`, 'h'].join(''));
export const ELAPSED_MINUTES = new RegExp([String.raw`(\d+)m`, String.raw`\b`].join(''));
