import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { learnStackSecrets, redactData, redactText } from '../../scripts/lib/redact.mjs';

// Owner ruling 2026-09-29 (option a): the public harness shows host paths, command lines,
// cwd, pids and file locations so every run is traceable to its place on the host.
// Secrets stay filtered: fields that carry configuration or credential material are
// omitted and every string still passes through the shared write-time redactor.
const OMIT = new Set(['config_json', 'allow_json', 'form_url']);
export const MAX_BUFFERED_TEXT = 1024 * 1024;

export function initializeReadRedaction(projects) {
  for (const row of projects) if (row.repoRoot) learnStackSecrets(row.repoRoot);
}

/** Text encoding of stored bytes from their byte-order mark; op evidence captured by
 *  PowerShell redirection is often UTF-16 LE with a BOM. */
export function textEncodingOf(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  return 'utf-8';
}

/** Decodes stored text bytes to a string, removing any BOM. */
export function decodeText(bytes) {
  const encoding = textEncodingOf(bytes);
  if (encoding === 'utf-16le') return bytes.subarray(2).toString('utf16le');
  if (encoding === 'utf-16be') {
    const body = Buffer.from(bytes.subarray(2));
    body.swap16();
    return body.toString('utf16le');
  }
  if (encoding === 'utf-8-bom') return bytes.subarray(3).toString('utf8');
  return bytes.toString('utf8');
}

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
  const failClosed = stream => {
    pending = '';
    held = '';
    discarded = true;
    stream.push('[redacted:oversize-text]\n');
  };
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (discarded) { callback(); return; }
      if (!decoder) {
        const encoding = textEncodingOf(chunk);
        decoder = new StringDecoder(encoding.startsWith('utf-16') ? 'utf16le' : 'utf8');
        if (encoding === 'utf-16be') { chunk = Buffer.from(chunk); chunk.subarray(0, chunk.length - (chunk.length % 2)).swap16(); }
        chunk = chunk.subarray(encoding === 'utf-8-bom' ? 3 : encoding === 'utf-8' ? 0 : 2);
      }
      pending += decoder.write(chunk);
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
        const tail = pending + (decoder ? decoder.end() : '');
        if (held.length + tail.length > MAX_BUFFERED_TEXT) failClosed(this);
        else if (held || tail) this.push(publicText(held + tail));
      }
      callback();
    },
  });
}
