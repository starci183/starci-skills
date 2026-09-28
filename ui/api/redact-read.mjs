import path from 'node:path';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { learnStackSecrets, redactData, redactText } from '../../scripts/lib/redact.mjs';

const OMIT = new Set(['pid', 'worker_pid', 'running_pid', 'cmdline', 'cmdline_digest', 'processes_seen', 'config_json', 'allow_json', 'file_uri', 'form_url', 'command']);
export const MAX_BUFFERED_TEXT = 1024 * 1024;

export function initializeReadRedaction(projects) {
  for (const row of projects) if (row.repoRoot) learnStackSecrets(row.repoRoot);
}

function hideAbsolutePaths(value) {
  return value
    .replace(/\b[A-Za-z]:[\\/][^\r\n]*/g, '[redacted:absolute-path]')
    .replace(/\\\\[^\\\s]+\\[^\\\s]+\\[^\r\n]*/g, '[redacted:absolute-path]')
    .replace(/(^|[\s(])\/(?:Users|home|tmp|var|etc|opt|mnt|Volumes|private|srv)\/[^\r\n]*/gm, '$1[redacted:absolute-path]');
}

function publicText(value) {
  return hideAbsolutePaths(redactText(value));
}

export function publicJson(value, key = null) {
  if (Array.isArray(value)) return value.map(item => publicJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !OMIT.has(name)).map(([name, item]) => [name, publicJson(item, name)]));
  }
  // URL paths are root-relative in browsers; on Windows path.isAbsolute also
  // classifies them as filesystem paths. Keep only the one public blob route.
  if (typeof value === 'string' && key === 'href' && /^\/api\/blob\/[a-f0-9]{64}$/.test(value)) return redactData(value, key);
  if (typeof value === 'string' && path.isAbsolute(value)) return '[redacted:absolute-path]';
  const clean = redactData(value, key);
  return typeof clean === 'string' ? hideAbsolutePaths(clean) : clean;
}

export function redactUnmarkedText(bytes) {
  return Buffer.from(publicText(bytes.toString('utf8')));
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
        const tail = pending + decoder.end();
        if (held.length + tail.length > MAX_BUFFERED_TEXT) failClosed(this);
        else if (held || tail) this.push(publicText(held + tail));
      }
      callback();
    },
  });
}
