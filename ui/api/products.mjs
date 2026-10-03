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
const HEX = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;
const cache = new Map();
const remember = (key, value) => {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return value;
};

// Every argument is a validated hex head or a validated repo-relative path.
const git = (repo, args, options) => readOnly(repo, args, options);

/** null when the stored report path is safe to hand to git, else the refusal reason. */
function refusePath(repo, value) {
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
  if (!listing.ok) return { error: 'commit file listing unavailable', parent, changed: new Map() };
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
    const measured = Number(size.out.toString().trim());
    base.bytes = Number.isFinite(measured) && measured >= 0 ? measured : null;
    const shown = await git(repo, ['show', spec], { max: MAX_CONTENT });
    if (!shown.ok && !shown.overflow) base.error = 'git show failed';
    else {
      const buffer = shown.overflow ? shown.out.subarray(0, MAX_CONTENT) : shown.out;
      if (buffer.subarray(0, 8000).includes(0)) base.kind = 'binary';
      else { base.content = bodyOf(buffer); base.truncated = shown.overflow || (base.bytes != null && base.bytes > MAX_CONTENT); }
    }
  } else if (listed !== 'deleted') base.error = 'file not found or unreadable at selected commit';
  if (listed) {
    const diff = info.parent ? await git(repo, ['diff', '--no-color', '--no-renames', info.parent, head, '--', rel], { max: MAX_DIFF })
      : await git(repo, ['show', '--no-color', '--no-renames', '--format=', head, '--', rel], { max: MAX_DIFF });
    if (diff.ok || diff.overflow) {
      base.diff = bodyOf(diff.overflow ? diff.out.subarray(0, MAX_DIFF) : diff.out);
      base.diffTruncated = diff.overflow;
    } else base.error ??= 'commit diff unavailable';
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
export async function attemptProducts(repo, report, { checkpoint = null } = {}) {
  const reportHead = typeof report?.head === 'string' && HEX.test(report.head) ? report.head.toLowerCase() : null;
  const checkpointHead = typeof checkpoint?.sha === 'string' && HEX.test(checkpoint.sha) ? checkpoint.sha.toLowerCase() : null;
  const head = checkpointHead ?? reportHead;
  const headSource = checkpointHead ? 'runtime-checkpoint' : reportHead ? 'report-tested' : null;
  const empty = { head, headSource, headAt: checkpointHead ? checkpoint.at ?? null : null, reportHead,
    parent: null, repo: repo ?? null, files: [], otherChanged: [], claims: [], error: null, errorCode: null,
    scope: { listed: 0, returned: 0, truncated: false } };
  const claims = Array.isArray(report?.claims) ? publicJson(report.claims) : [];
  if (!head) return { ...empty, claims, error: 'No recorded checkpoint or report-tested commit', errorCode: 'PRODUCT_HEAD_MISSING' };
  let directory = false;
  try { directory = Boolean(repo && existsSync(repo) && statSync(repo).isDirectory()); } catch { /* inaccessible repository */ }
  if (!directory) return { ...empty, claims, error: 'repository not found on this host', errorCode: 'PRODUCT_REPOSITORY_UNAVAILABLE' };
  const info = await commitInfo(repo, head);
  if (info.error) return { ...empty, claims, error: info.error, errorCode: 'PRODUCT_COMMIT_UNAVAILABLE' };
  const declared = [...new Set([...(Array.isArray(report?.files) ? report.files : []),
    ...claims.flatMap(claim => Array.isArray(claim?.paths) ? claim.paths : [])].filter(item => typeof item === 'string'))];
  const wanted = (declared.length ? declared : checkpointHead ? [...info.changed.keys()] : []).slice(0, MAX_FILES);
  const listedCount = declared.length || (checkpointHead ? info.changed.size : 0);
  const files = await pool(wanted, async file => {
    const refusal = refusePath(repo, file);
    if (refusal) return { path: String(file).slice(0, 300), status: 'missing', kind: 'text', bytes: null, hostPath: null, content: null, truncated: false, diff: null, diffTruncated: false, error: refusal };
    return productOf(repo, head, info, file);
  });
  const listed = new Set(files.map(file => file.path));
  const otherChanged = [...info.changed].filter(([file]) => !listed.has(file)).map(([file, status]) => ({ path: file, status }));
  return { ...empty, parent: info.parent, repo, files, otherChanged: otherChanged.slice(0, MAX_FILES), claims,
    scope: { listed: listedCount, returned: files.length, truncated: listedCount > MAX_FILES || otherChanged.length > MAX_FILES } };
}
