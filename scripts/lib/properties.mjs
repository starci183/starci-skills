// properties.mjs — the .properties file reader (key=value lines, # and ! comments).
import fs from 'node:fs';

/** `file` as {key: value}: blank lines and #/! comments skipped, the first = or : splits. Unreadable file → {}. */
export function readProperties(file) {
  const out = {};
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return out; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const at = line.search(/[=:]/);
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}
