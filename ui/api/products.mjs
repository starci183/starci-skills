import path from 'node:path';
import { readOnly } from '../../scripts/api/git/read-only.mjs';
import { existsSync, statSync } from 'node:fs';
import { decodeText, publicText, publicJson } from './redact-read.mjs';

/** Products of an attempt at its commit head: repo files the op wrote (content + diff), read-only git. */
const MAX_CONTENT = 1024 * 1024;
const MAX_DIFF = 512 * 1024;
const MAX_FILES = 200;
const CONCURRENCY = 6;
const CACHE_LIMIT = 400;
const HEX40 = /^[0-9a-f]{40}$/i;
const cache = new Map();
const remember = (key, value) => {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return value;
};

// Every argument is a validated hex head or a validated repo-relative path.
const git = (repo, args, options) => readOnly(repo, args, options);

/** null when the stored report path is safe to hand to git, else the refusal reason. */
export function refusePath(repo, value) {
  if (typeof value !== 'string' || !value.trim()) return 'empty path';
  if (value.includes('\0')) return 'NUL in path';
  if (/^([a-zA-Z]:|[\\/])/.test(value)) return 'absolute path refused';
  const parts = value.split(/[\\/]+/);
  if (parts.includes('..')) return 'path escapes the repository';
  if (parts.some(part => part.toLowerCase() === '.git')) return 'path inside .git refused';
  const rel = path.relative(repo, path.resolve(repo, value));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return 'path outside the repository';
  return null;
}

const KINDS = { yaml: 'yaml', yml: 'yaml', json: 'json', jsonl: 'json', md: 'markdown', markdown: 'markdown', diff: 'diff', patch: 'diff',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', pdf: 'pdf', mp4: 'video', webm: 'video', mp3: 'audio', wav: 'audio' };
const kindOf = file => KINDS[(file.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()] ?? 'text';
const STATUS = { A: 'added', M: 'modified', D: 'deleted', T: 'modified', C: 'added', R: 'modified' };
const bodyOf = buffer => publicText(decodeText(buffer));

async function commitInfo(repo, head) {
  const key = `commit:${repo}:${head}`;
  if (cache.has(key)) return cache.get(key);
  const verified = await git(repo, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!verified.ok) return { error: 'commit not found in repository', parent: null, changed: new Map() };
  const parentRun = await git(repo, ['rev-parse', '--verify', '--quiet', `${head}^`]);
  const parent = parentRun.ok ? parentRun.out.toString().trim() : null;
  const listing = parent ? await git(repo, ['diff', '--name-status', '--no-renames', '--no-color', parent, head])
    : await git(repo, ['show', '--name-status', '--no-renames', '--format=', head]);
  const changed = new Map();
  for (const line of listing.out.toString('utf8').split(/\r?\n/)) {
    const [code, ...rest] = line.split('\t');
    if (code && rest.length) changed.set(rest.join('\t'), STATUS[code[0]] ?? 'modified');
  }
  return remember(key, { error: null, parent, changed });
}

async function productOf(repo, head, info, file) {
  const key = `file:${repo}:${head}:${file}`;
  if (cache.has(key)) return cache.get(key);
  const rel = file.replaceAll('\\', '/');
  const base = { path: rel, status: 'missing', kind: kindOf(rel), bytes: null, hostPath: path.join(repo, rel),
    content: null, truncated: false, diff: null, diffTruncated: false, error: null };
  const spec = `${head}:${rel}`;
  const size = await git(repo, ['cat-file', '-s', spec]);
  const listed = info.changed.get(rel);
  base.status = listed ?? (size.ok ? 'unchanged' : 'missing');
  if (size.ok) {
    base.bytes = Number(size.out.toString().trim()) || 0;
    const shown = await git(repo, ['show', spec], { max: MAX_CONTENT });
    if (!shown.ok && !shown.overflow) base.error = 'git show failed';
    else {
      const buffer = shown.overflow ? shown.out.subarray(0, MAX_CONTENT) : shown.out;
      if (buffer.subarray(0, 8000).includes(0)) base.kind = 'binary';
      else { base.content = bodyOf(buffer); base.truncated = shown.overflow || base.bytes > MAX_CONTENT; }
    }
  }
  if (listed) {
    const diff = info.parent ? await git(repo, ['diff', '--no-color', '--no-renames', info.parent, head, '--', rel], { max: MAX_DIFF })
      : await git(repo, ['show', '--no-color', '--no-renames', '--format=', head, '--', rel], { max: MAX_DIFF });
    if (diff.ok || diff.overflow) {
      base.diff = bodyOf(diff.overflow ? diff.out.subarray(0, MAX_DIFF) : diff.out);
      base.diffTruncated = diff.overflow;
    }
  }
  return remember(key, base);
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await worker(items[index]); }
  }));
  return results;
}

/** AttemptProducts for one attempt. `report` is the parsed report.json (or null), `repo` the attempt's repo root. */
export async function attemptProducts(repo, report) {
  const empty = { head: null, parent: null, repo: repo ?? null, files: [], otherChanged: [], claims: [], error: null };
  const claims = Array.isArray(report?.claims) ? publicJson(report.claims) : [];
  const head = typeof report?.head === 'string' && HEX40.test(report.head) ? report.head.toLowerCase() : null;
  if (!report || !head) return { ...empty, claims };
  if (!repo || !existsSync(repo) || !statSync(repo).isDirectory()) return { ...empty, head, claims, error: 'repository not found on this host' };
  const wanted = [...new Set([...(Array.isArray(report.files) ? report.files : []),
    ...claims.flatMap(claim => Array.isArray(claim?.paths) ? claim.paths : [])].filter(item => typeof item === 'string'))].slice(0, MAX_FILES);
  const info = await commitInfo(repo, head);
  if (info.error) return { ...empty, head, claims, error: info.error };
  const files = await pool(wanted, async file => {
    const refusal = refusePath(repo, file);
    if (refusal) return { path: String(file).slice(0, 300), status: 'missing', kind: 'text', bytes: null, hostPath: null, content: null, truncated: false, diff: null, diffTruncated: false, error: refusal };
    return productOf(repo, head, info, file);
  });
  const listed = new Set(files.map(file => file.path));
  const otherChanged = [...info.changed].filter(([file]) => !listed.has(file)).map(([file, status]) => ({ path: file, status }));
  return { head, parent: info.parent, repo, files, otherChanged, claims, error: null };
}
