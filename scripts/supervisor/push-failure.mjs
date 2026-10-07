// push-failure.mjs — what a refused or failed push says: its summary line, its stable signature and its stored output.
import path from 'node:path';
import { putBlob } from '../../engine/db/blob.mjs';
import { redactText } from '../lib/redact.mjs';
import { sha256 } from '../../engine/digest.mjs';

/** MB-03: a push (with its pre-push hook: one repo's Jest alone takes ~4 min) may run this long; a timeout is its own reason. */
export const PUSH_TIMEOUT_MS = 600_000;

const outputOf = (r) => [r?.stdout, r?.stderr, r?.error].filter(Boolean).join('\n');
const WHY_LINE = /\b(?:error|errors|failed|failure|fail|rejected|denied|refused|timed out|ERR!)\b|✖|×/i;
const TASK_FAILURE = new RegExp([String.raw`(\S+#[\w:-]+?)`, String.raw`:?\s+`, String.raw`(?:command\b[^\n]*exited \(\d+\)|failed|ERR|error)`].join(''), 'i');
const JEST_FAIL_LINE = new RegExp([String.raw`^\s*FAIL\s+`, String.raw`(\S+\.(?:spec|test)\.[cm]?[jt]sx?)`].join(''), 'm');

/** The lines that say why a push failed: its error/fail lines (at most 8), else its last 8 lines. Pure. */
function failureSummary(text, { max = 8 } = {}) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const why = lines.filter((l) => WHY_LINE.test(l));
  // The error lines first, then the tail (a hook's own last words: `LINT_ERROR ...`, a failing suite), once each.
  return [...new Set([...why.slice(0, max), ...lines.slice(-6)])].join(' | ').slice(0, 1200) || 'push failed';
}

/**
 * A stable failure signature: what failed, never the HEAD, a sha, a time or a count, so the same failure on a new
 * commit signs the same and a changed failure signs differently (MB-03, MB-07). Pure over the git result and its text.
 */
export function failureSignature(r, text = outputOf(r)) {
  if (r?.timedOut) return `timeout:${Math.round((Number(r.timeoutMs) || PUSH_TIMEOUT_MS) / 1000)}s`;
  const t = String(text ?? '');
  if (/non-fast-forward|\[rejected\]|fetch first/i.test(t)) return 'rejected:non-fast-forward';
  if (/\b(?:HTTP )?5\d\d\b.*(?:gateway|unavailable|error)|RPC failed|Bad Gateway|Service Unavailable/i.test(t)) return 'remote:unavailable';
  if (/permission denied|Authentication failed|\b403\b/i.test(t)) return 'remote:denied';
  const task = TASK_FAILURE.exec(t) ?? /ERR!?\s+(\S+#[\w:-]+)/.exec(t);
  if (task) return `task:${task[1]}`;
  const jest = JEST_FAIL_LINE.exec(t);
  if (jest) return `jest:${path.basename(jest[1])}`;
  const tsc = /error (TS\d+)/.exec(t);
  if (tsc) return `tsc:${tsc[1]}`;
  const script = /npm ERR! (?:code|Lifecycle script) "?([\w:-]+)"?/.exec(t) ?? /Lifecycle script `([\w:-]+)` failed/.exec(t);
  if (script) return `npm:${script[1]}`;
  const norm = failureSummary(t).replace(/'[^'\n]*'|"[^"\n]*"/g, "'…'").replace(/[0-9a-f]{7,64}/gi, '#').replace(/\d+/g, 'N').replace(/[A-Z]:\\[^\s|]+|\/(?:tmp|var)\/[^\s|]+/g, '<path>');
  return `other:${sha256(norm).slice(0, 12)}`;
}

/** The full (redacted) push/hook output as a blob: {sha, bytes} or null (the store refused). Never throws. */
function storeOutput(text, { put = null } = {}) {
  if (!String(text ?? '').trim()) return null;
  try {
    const bytes = Buffer.from(redactText(String(text)), 'utf8');
    const r = (put ?? putBlob)(bytes, { mediaType: 'text/plain; charset=utf-8' });
    return r?.sha ? { sha: r.sha, bytes: bytes.length } : null;
  } catch { return null; }
}

/**
 * A failed push/hook result's fields: the summary line, the stable signature, the full output blob and (MB-03, the
 * pushes row) the full stdout and stderr blobs.
 */
export const failureOf = (r, { store = storeOutput } = {}) => {
  const text = outputOf(r);
  const blob = store(text);
  const stdout = store(r?.stdout), stderr = store([r?.stderr, r?.error].filter(Boolean).join('\n'));
  return { error: r?.timedOut ? `timed out after ${Math.round((Number(r.timeoutMs) || PUSH_TIMEOUT_MS) / 1000)}s: ${failureSummary(text)}` : failureSummary(text),
    signature: failureSignature(r, text), ...(blob ? { outputSha: blob.sha, outputBytes: blob.bytes } : {}),
    ...(stdout ? { stdoutSha: stdout.sha } : {}), ...(stderr ? { stderrSha: stderr.sha } : {}) };
};
