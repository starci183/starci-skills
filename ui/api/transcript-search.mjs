import { startWorker } from '../../scripts/api/node/start-worker.mjs';

const MAX_PATTERN = 200;
const MAX_HITS = 500;
const REGEX_TIMEOUT_MS = 200;

const regexWorker = `
  const { parentPort, workerData } = require('node:worker_threads');
  try {
    const expression = new RegExp(workerData.pattern, 'iu');
    const hits = [];
    for (let i = 0; i < workerData.lines.length; i++) {
      if (expression.test(workerData.lines[i])) {
        hits.push(i + 1);
        if (hits.length >= ${MAX_HITS}) break;
      }
    }
    parentPort.postMessage({ hits });
  } catch (error) { parentPort.postMessage({ error: String(error.message ?? error) }); }
`;

function regexHits(lines, pattern) {
  return new Promise((resolve, reject) => {
    const worker = startWorker(regexWorker, { eval: true, execArgv: [], workerData: { lines, pattern } });
    const timer = setTimeout(() => { worker.terminate(); reject(Object.assign(new Error('Regex search timed out'), { code: 'REGEX_TIMEOUT' })); }, REGEX_TIMEOUT_MS);
    worker.once('message', value => {
      clearTimeout(timer);
      worker.terminate();
      if (value.error) reject(Object.assign(new Error(value.error), { code: 'BAD_REGEX' }));
      else resolve(value.hits);
    });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

function lineRange(lines, from, to) {
  const first = Math.min(lines.length, Math.max(1, Number(from) || 1));
  const last = Math.min(lines.length, Math.max(first, Number(to) || first + 199));
  return lines.slice(first - 1, last).map((line, i) => ({ n: first + i, text: line }));
}

function searchPattern(value) {
  const regex = value.length >= 2 && value.startsWith('/') && value.endsWith('/');
  const pattern = regex ? value.slice(1, -1) : value;
  if (regex && pattern.length > MAX_PATTERN) throw Object.assign(new Error('Regex exceeds 200 characters'), { code: 'BAD_REGEX' });
  if (regex && /\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) throw Object.assign(new Error('Nested regex quantifiers are not supported'), { code: 'BAD_REGEX' });
  if (!pattern) throw Object.assign(new Error('Search query is empty'), { code: 'BAD_QUERY' });
  return { regex, pattern };
}

async function findHits(lines, pattern, regex) {
  if (regex) return regexHits(lines, pattern);
  const needle = pattern.toLocaleLowerCase();
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLocaleLowerCase().includes(needle)) hits.push(i + 1);
    if (hits.length >= MAX_HITS) break;
  }
  return hits;
}

function contextWindow(lines, hitNumbers, context) {
  const selected = new Set();
  for (const n of hitNumbers) for (let line = Math.max(1, n - context); line <= Math.min(lines.length, n + context); line++) selected.add(line);
  return [...selected].sort((a, b) => a - b).slice(0, 200).map(n => ({ n, text: lines[n - 1], ...(hitNumbers.includes(n) ? { hit: true } : {}) }));
}

/** Search a redacted transcript and return bounded line windows with stable line numbers. */
export async function transcriptWindow(text, { q = null, around = 3, from = null, to = null } = {}) {
  const lines = String(text).split(/\r?\n/);
  const context = Math.min(20, Math.max(0, Number(around) || 0));
  if (!q) return { totalLines: lines.length, lines: lineRange(lines, from, to), hits: null, hitCount: null };
  const { regex, pattern } = searchPattern(String(q));
  const hitNumbers = await findHits(lines, pattern, regex);
  return { totalLines: lines.length, lines: contextWindow(lines, hitNumbers, context),
    hits: hitNumbers.map(n => ({ n, preview: lines[n - 1].slice(0, 240) })), hitCount: hitNumbers.length };
}
