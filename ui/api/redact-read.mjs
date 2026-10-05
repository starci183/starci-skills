import { Transform } from 'node:stream';
import { learnStackSecrets, redactData, redactText, textEncodingOf, decodeText } from '../../scripts/lib/redact.mjs';
export { textEncodingOf, decodeText } from '../../scripts/lib/redact.mjs';

// Owner ruling 2026-09-29 (option a): the public harness shows host paths, command lines,
// cwd, pids and file locations so every run is traceable to its place on the host.
// Secrets stay filtered: fields that carry configuration or credential material are
// omitted and every string still passes through the shared write-time redactor.
const OMIT = new Set(['config_json', 'allow_json', 'form_url']);
export const MAX_BUFFERED_TEXT = 1024 * 1024;

export function initializeReadRedaction(projects) {
  for (const row of projects) if (row.repoRoot) learnStackSecrets(row.repoRoot);
}

/** Public text uses the same credential filter as evidence ingestion. */
export function publicText(value) {
  return redactText(value);
}

export function publicJson(value, key = null) {
  if (Array.isArray(value)) return value.map(item => publicJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !OMIT.has(name)).map(([name, item]) => [name, publicJson(item, name)]));
  }
  return redactData(value, key);
}

/** Stored text bytes -> redacted UTF-8 bytes (decoding UTF-16/BOM first). */
export function redactUnmarkedText(bytes) {
  return Buffer.from(publicText(decodeText(bytes)));
}

// The evidence module currently exposes a text function, so keep complete lines
// (and complete PEM blocks) together before passing them through that function.
// The first chunk's BOM selects the decoder so UTF-16 text is redacted as text.
export function redactTextStream() {
  let decoder = null;
  let pending = '';
  let held = '';
  let pem = false;
  let discarded = false;
  let prefix = Buffer.alloc(0);
  const decode = (chunk, final = false) => {
    if (!decoder) {
      prefix = Buffer.concat([prefix, chunk]);
      if (!final && prefix.length < 3) return '';
      const encoding = textEncodingOf(prefix);
      decoder = new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding, { fatal: true });
      chunk = prefix;
      prefix = Buffer.alloc(0);
    }
    return decoder.decode(chunk, { stream: !final });
  };
  const failClosed = stream => {
    pending = '';
    held = '';
    discarded = true;
    stream.push('[redacted:oversize-text]\n');
  };
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (discarded) { callback(); return; }
      try { pending += decode(chunk); } catch (error) { callback(error); return; }
      if (pending.length + held.length > MAX_BUFFERED_TEXT) { failClosed(this); callback(); return; }
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end + 1);
        pending = pending.slice(end + 1);
        if (pem || (line.includes('-----BEGIN') && line.includes('PRIVATE KEY'))) {
          pem = true;
          held += line;
          if (held.length + pending.length > MAX_BUFFERED_TEXT) { failClosed(this); break; }
          if (line.includes('-----END')) {
            this.push(publicText(held));
            held = '';
            pem = false;
          }
        } else this.push(publicText(line));
      }
      callback();
    },
    flush(callback) {
      if (!discarded) {
        let tail;
        try { tail = pending + decode(Buffer.alloc(0), true); } catch (error) { callback(error); return; }
        if (held.length + tail.length > MAX_BUFFERED_TEXT) failClosed(this);
        else if (held || tail) this.push(publicText(held + tail));
      }
      callback();
    },
  });
}
