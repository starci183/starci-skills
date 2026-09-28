import path from 'node:path';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { learnStackSecrets, redactData, redactText } from '../../scripts/lib/redact.mjs';

const OMIT = new Set(['pid', 'worker_pid', 'running_pid', 'cmdline', 'cmdline_digest', 'processes_seen', 'config_json', 'allow_json', 'file_uri', 'form_url', 'command']);
export const MAX_BUFFERED_TEXT = 1024 * 1024;

export function initializeReadRedaction(projects) {
  for (const row of projects) if (row.repoRoot) learnStackSecrets(row.repoRoot);
}

export function publicJson(value, key = null) {
  if (Array.isArray(value)) return value.map(item => publicJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !OMIT.has(name)).map(([name, item]) => [name, publicJson(item, name)]));
  }
  if (typeof value === 'string' && path.isAbsolute(value)) return redactData(path.basename(value), key);
  return redactData(value, key);
}

export function redactUnmarkedText(bytes) {
  return Buffer.from(redactText(bytes.toString('utf8')));
}

// The evidence module currently exposes a text function, so keep complete lines
// (and complete PEM blocks) together before passing them through that function.
export function redactTextStream() {
  const decoder = new StringDecoder('utf8');
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
            this.push(redactText(held));
            held = '';
            pem = false;
          }
        } else this.push(redactText(line));
      }
      callback();
    },
    flush(callback) {
      if (!discarded) {
        const tail = pending + decoder.end();
        if (held.length + tail.length > MAX_BUFFERED_TEXT) failClosed(this);
        else if (held || tail) this.push(redactText(held + tail));
      }
      callback();
    },
  });
}
