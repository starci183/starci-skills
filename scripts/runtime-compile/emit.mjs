/** Compact `.dist` JSON: one physical line + final newline. No pretty-print. */
export function compactJson(value) {
  return `${JSON.stringify(value)}\n`;
}

export function compactJsonBuffer(value) {
  return Buffer.from(compactJson(value));
}

/** Re-parse arbitrary JSON bytes into compact form (rejects non-JSON). */
export function recompactJsonBytes(bytes) {
  return compactJsonBuffer(JSON.parse(bytes.toString('utf8')));
}
