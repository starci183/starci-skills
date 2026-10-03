import path from 'node:path';
import { gitOutputOf } from './git.mjs';

/** The trimmed source line containing `at`, capped for diagnostic output. */
export const lineTextAt = (text, at) => {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const next = text.indexOf('\n', at);
  return text.slice(start, next < 0 ? text.length : next).trim().slice(0, 240);
};

/** `text` cut into sentences; a backticked span never splits. */
export function sentencesOf(text) {
  const out = [];
  const s = String(text ?? '');
  let start = 0, tick = false;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '`') tick = !tick;
    else if (!tick && /[.!?]/.test(s[i]) && /\s/.test(s[i + 1] ?? '') && /[A-Z0-9`("']/.test(s.slice(i + 1).trimStart()[0] ?? '')) {
      out.push(s.slice(start, i + 1).trim()); start = i + 1;
    }
  }
  const last = s.slice(start).trim();
  if (last) out.push(last);
  return out.filter(Boolean);
}

/** Offset ranges for the sentence strings returned by a caller's prose splitter. */
export const sentenceRanges = (text, sentences) => {
  const ranges = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const start = text.indexOf(sentence, cursor);
    if (start < 0) continue;
    ranges.push({ start, end: start + sentence.length, text: sentence });
    cursor = start + sentence.length;
  }
  return ranges;
};

/** The sentence containing `at`, or its source line when prose splitting found no range. */
export const sentenceTextAt = (ranges, at, text) => ranges.find((range) => at >= range.start && at < range.end)?.text
  ?? lineTextAt(text, at);

/** Repo-relative tracked paths, normalised to forward slashes. */
export const readTrackedTextFiles = (root, { listFiles, onGitError = null } = {}) => {
  try {
    return gitOutputOf(listFiles(['-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z')
      .split('\0').filter(Boolean).map((file) => String(file).replace(/\\/g, '/'));
  } catch (error) {
    if (onGitError) return onGitError(error);
    throw error;
  }
};

/** Shared --root/--json envelope for tracked-text checks. */
export function runTrackedTextCheckCli(argv, io, options) {
  let root = options.defaultRoot;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { io.stdout.write(`${options.help}\n`); return 0; }
    if (arg === '--json') { json = true; continue; }
    if (arg === '--root') {
      const value = argv[++i];
      if (value === undefined) { io.stderr.write(`${options.command}: --root needs a path\n`); return 2; }
      root = path.resolve(value);
      continue;
    }
    io.stderr.write(`${options.command}: unknown argument ${arg}\n${options.help}\n`);
    return 2;
  }
  let report;
  try { report = options.scan(root); } catch (error) {
    io.stderr.write(`${options.command}: ${error.message}\n`);
    return 2;
  }
  if (json) io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (report.ok) io.stdout.write(`${options.cleanText(report)}\n`);
  else {
    for (const finding of report.findings) io.stdout.write(`${options.findingText(finding)}\n`);
    io.stdout.write(`${options.redText(report)}\n`);
  }
  return report.ok ? 0 : 1;
}
