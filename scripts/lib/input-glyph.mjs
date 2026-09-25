// input-glyph.mjs — the one definition of "the glyph that opens an agent CLI's input row".
//
// Five call sites spelled it five ways ([>›❯❭*], [>›❯❭»], [>›❯❭], [›❯❭], [>❯❭]) and each grew its
// own answer to "is this row the input row" (kernel/api.mjs INPUT_ROW_GLYPH is the same copy; only
// the w2-api lanes may edit it). The chars that count:
//   >   the plain prompt and Qwen Code's "> <text>" sent-message echo
//   ›   Codex's input row - and what a lifted draft is drawn as when no glyph row is found
//   ❯   Claude's prompt
//   ❭   the right-pointing sibling some terminals render
//   »   Orca's composer-draft lift recognises it (out/shared/terminal-composer-draft.js)
//   *   Qwen Code's boxed input row ("*   Type your message") and its ghost suggestion. Counted
//       only where a row is READ as input text (INPUT_GLYPH, draft placement): a bare `*` bullet
//       in a transcript must never read as an idle prompt, so the row detectors below match
//       Qwen's box by its "Type your message" text instead.
export const INPUT_GLYPH_CHARS = '>›❯❭»';
export const INPUT_GLYPH_CLASS = `[${INPUT_GLYPH_CHARS}]`;
export const INPUT_GLYPH_BOXED_CLASS = `[${INPUT_GLYPH_CHARS}*]`;
// The evidence class stays narrower on purpose: a `>` or `*` row head and a `»` all occur in shell
// transcripts (`>>` continuation, `*` bullets, quoted prose), so "only an agent TUI draws this row"
// (the footer/frame evidence above a bare shell prompt) keeps the two glyphs no shell prompt emits.
export const AGENT_GLYPH_CLASS = '[›❯❭]';
/** A row opening with an input glyph (whitespace either side): the strip/detect form. */
export const INPUT_GLYPH = new RegExp(`^\\s*${INPUT_GLYPH_BOXED_CLASS}\\s*`, 'u');
/** A row that IS an input row: a glyph followed by whitespace or the end of the row. */
export const INPUT_GLYPH_ROW = new RegExp(`^\\s*${INPUT_GLYPH_CLASS}(?:\\s|$)`, 'u');
