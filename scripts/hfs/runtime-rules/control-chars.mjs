// control-chars.mjs - RT_CONTROL_CHARACTER (knowledge/hfs/rules.yaml, gate runtime): tracked text source holds no raw
// control character - U+0000 to U+001F except tab, LF and CR, and U+007F. A raw NUL makes git and grep treat the file as
// binary; a raw backspace inside a regex literal silently means something else than the `\b` it was typed as. The
// character is written as its escape (`\0`, `\b`, `\u001b`). Judged on the bytes of every tracked *.mjs, *.cjs, *.js,
// *.ts, *.tsx, *.yaml, *.yml, *.md and *.json outside the generated copies. Pure.
export const CODE = 'RT_CONTROL_CHARACTER';
export const TEXT_SOURCE = /\.(?:mjs|cjs|js|ts|tsx|ya?ml|md|json)$/;

/** True for a byte that is a control character the rule refuses. */
export const refusedByte = (b) => (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f;

/** The RT_CONTROL_CHARACTER finding of one file's bytes (the first offending byte, with how many there are), or null. */
export function controlCharFinding(file, bytes) {
  let first = -1;
  let count = 0;
  for (let i = 0; i < bytes.length; i += 1) if (refusedByte(bytes[i])) { count += 1; if (first < 0) first = i; }
  if (first < 0) return null;
  let line = 1;
  for (let i = 0; i < first; i += 1) if (bytes[i] === 0x0a) line += 1;
  const hex = `U+${bytes[first].toString(16).toUpperCase().padStart(4, '0')}`;
  return { code: CODE, level: 'error', path: file, line, message: `${file}:${line} holds a raw control character ${hex}${count > 1 ? ` (${count} in the file)` : ''}: write it as its escape (\\0, \\b, \\u001b ...)` };
}

/** RT_CONTROL_CHARACTER over the tracked text source of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function controlCharFindings(ctx) {
  const generated = ctx.params.generated.map((g) => `${g.root}/`);
  const found = [];
  for (const file of ctx.files) {
    if (!TEXT_SOURCE.test(file) || generated.some((g) => file.startsWith(g))) continue;
    const bytes = ctx.readBytes(file);
    const finding = bytes && controlCharFinding(file, bytes);
    if (finding) found.push(finding);
  }
  return found;
}
