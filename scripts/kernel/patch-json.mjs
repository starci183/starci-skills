// patch-json.mjs — a job's .patch (git format-patch, job-artifacts.mjs writeJobPatch) pre-structured for the
// status console: <patch>.json beside it, written once at artifact index time, so the UI renders a file tree and hunks without parsing text.
//
//   {schema, base, head, landed, unlanded, commits:[{sha, subject}], totals:{files, added, removed},
//    files:[{path, oldPath, status A|M|D|R, added, removed, language, binary, image, touches,
//            hunks:[{header, oldStart, newStart, lines:[{t:' '|'+'|'-', o, n, s}]}], truncated,
//            before?:{blob, asset?}, after?:{blob, asset?}}],
//    truncated, omittedFiles}
//
// The patch is read line by line (a format-patch series can be hundreds of MB), hunk bodies are bounded by their
// header counts (so the `-- ` signature and the next mail header are never taken as diff lines), a path touched by
// several commits is one file whose hunks follow in commit order, and the caps (per-file lines, total lines, files,
// line length) mark what they cut with `truncated`. A binary file is flagged; an image's literal blob in the patch
// (`GIT binary patch` literal, base85 + zlib) is decoded into <patch>.assets/<blob>.<ext> so before/after survive
// history rewrites. Every line passes the typed-log redaction (typed-logs.mjs redactText).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { allocationSettings } from '../../engine/config.mjs';
import { redactText } from '../lib/redact.mjs';

export const PATCH_JSON_SCHEMA = 'starci/patch-json@1';
const DEFAULT_CAPS = { fileLines: 1500, totalLines: 20000, files: 400, lineChars: 2000, assetBytes: 5 * 1024 * 1024 };
/** allocation.logs.diff (modules/models/runtimes.yaml) over the defaults. */
export function diffCaps() {
  const raw = allocationSettings()?.logs?.diff ?? {};
  const out = { ...DEFAULT_CAPS };
  for (const k of Object.keys(out)) if (Number.isInteger(Number(raw[k])) && Number(raw[k]) > 0) out[k] = Number(raw[k]);
  return out;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif']);
const LANGUAGE = {
  '.ts': 'typescript', '.tsx': 'tsx', '.mts': 'typescript', '.cts': 'typescript', '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript', '.cjs': 'javascript',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown', '.mdx': 'markdown', '.css': 'css', '.scss': 'css', '.html': 'html', '.sql': 'sql',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.sh': 'shell', '.ps1': 'powershell', '.toml': 'toml', '.xml': 'xml', '.svg': 'xml', '.graphql': 'graphql', '.prisma': 'prisma',
};
export const languageOf = (p) => LANGUAGE[path.extname(String(p)).toLowerCase()] ?? (/(^|\/)Dockerfile$/.test(p) ? 'dockerfile' : 'text');
export const isImagePath = (p) => IMAGE_EXT.has(path.extname(String(p)).toLowerCase());

/** A git-quoted path ("a/\303\251.ts") as its UTF-8 string; an unquoted one as it is. */
export function unquoteGitPath(value) {
  const v = String(value);
  if (!v.startsWith('"') || !v.endsWith('"')) return v;
  const bytes = [];
  const body = v.slice(1, -1);
  const ESC = { n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== '\\') { bytes.push(...Buffer.from(ch, 'utf8')); continue; }
    const next = body[i + 1];
    if (/[0-7]/.test(next)) { bytes.push(parseInt(body.slice(i + 1, i + 4), 8)); i += 3; }
    else { bytes.push(ESC[next] ?? next.charCodeAt(0)); i += 1; }
  }
  return Buffer.from(bytes).toString('utf8');
}
const stripSide = (p) => { const u = unquoteGitPath(p.trim()); return u === '/dev/null' ? null : u.replace(/^[ab]\//, ''); };
/** The two paths of `diff --git a/X b/Y`, splitting where both halves agree when a name holds " b/". */
export function pathsOfDiffLine(line) {
  const rest = line.slice('diff --git '.length);
  if (rest.startsWith('"')) {
    const m = /^("(?:[^"\\]|\\.)*")\s+(.*)$/.exec(rest);
    if (m) return [stripSide(m[1]), stripSide(m[2])];
  }
  const half = (rest.length - 1) / 2;
  if (Number.isInteger(half) && rest.slice(2, half) === rest.slice(half + 3) && rest.slice(half, half + 3) === ' b/') return [rest.slice(2, half), rest.slice(half + 3)];
  const at = rest.indexOf(' b/');
  return at > 0 ? [stripSide(rest.slice(0, at)), stripSide(rest.slice(at + 1))] : [rest, rest];
}

// ------------------------------------------------------------------------------------- git base85
const B85 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
const B85_INDEX = new Map([...B85].map((c, i) => [c, i]));
/** One `GIT binary patch` data line decoded: its first char gives the byte count, the rest is base85. */
export function decodeBase85Line(line) {
  const c = line[0];
  const len = c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 64 : c >= 'a' && c <= 'z' ? c.charCodeAt(0) - 96 + 26 : -1;
  if (len < 0) throw new Error('bad base85 length');
  const out = [];
  for (let i = 1; i + 5 <= line.length; i += 5) {
    let acc = 0;
    for (let j = 0; j < 5; j++) { const v = B85_INDEX.get(line[i + j]); if (v == null) throw new Error('bad base85 char'); acc = acc * 85 + v; }
    out.push((acc >>> 24) & 255, (acc >>> 16) & 255, (acc >>> 8) & 255, acc & 255);
  }
  return Buffer.from(out.slice(0, len));
}

/**
 * A parser fed one patch line at a time: `line(raw)` then `finish()` -> the structure above (without base/head).
 * `onLiteral({path, side, blob, data})` receives each decoded image literal (side 'after' for the forward
 * section, 'before' for the reverse one).
 */
export function patchParser({ caps = diffCaps(), onLiteral = null } = {}) {
  const files = new Map(), commits = [];
  let totalLines = 0, anyTruncated = false;
  const omitted = new Set();
  let file = null, hunk = null, oldLeft = 0, newLeft = 0, oldNo = 0, newNo = 0;
  let mode = 'mail', subject = null, blobs = null;
  let binary = null; // {side, kind, size, lines:[]}
  const fileFor = (p, oldPath, status) => {
    if (files.has(p)) { const f = files.get(p); f.touches += 1; if (status === 'D') f.status = f.status === 'A' ? 'A' : 'D'; return f; }
    if (files.size >= caps.files) { omitted.add(p); anyTruncated = true; return { path: p, omitted: true, added: 0, removed: 0, hunks: [], touches: 1 }; }
    const f = { path: p, oldPath: oldPath && oldPath !== p ? oldPath : null, status, added: 0, removed: 0, language: languageOf(p), binary: false, image: isImagePath(p), touches: 1, hunks: [], truncated: false, lineCount: 0 };
    files.set(p, f);
    return f;
  };
  const flushBinary = () => {
    if (!binary || !file) { binary = null; return; }
    if (binary.kind === 'literal' && file.image && onLiteral && binary.size <= caps.assetBytes) {
      try {
        const data = zlib.inflateSync(Buffer.concat(binary.lines.map(decodeBase85Line)));
        const blob = binary.side === 'after' ? blobs?.[1] : blobs?.[0];
        if (blob && !/^0+$/.test(blob) && data.length && data.length === binary.size) onLiteral({ path: file.path, side: binary.side, blob, data });
      } catch { /* an undecodable literal leaves the image without an asset */ }
    }
    binary = null;
  };
  let pending = null; // header of the file being described: {a, b, status, oldPath}
  const startFile = () => {
    if (!pending) return;
    const p = pending.b ?? pending.a;
    file = fileFor(p, pending.a, pending.status);
    if (blobs && !file.omitted) {
      if (blobs[0] && !/^0+$/.test(blobs[0])) file.before = { blob: blobs[0] };
      if (blobs[1] && !/^0+$/.test(blobs[1])) file.after = { blob: blobs[1] };
    }
    pending = null;
  };
  const addLine = (t, s) => {
    if (t === '+') file.added += 1; else if (t === '-') file.removed += 1;
    if (file.omitted) return;
    if (file.lineCount >= caps.fileLines || totalLines >= caps.totalLines) { file.truncated = true; anyTruncated = true; return; }
    const text = s.length > caps.lineChars ? `${s.slice(0, caps.lineChars)}…` : s;
    hunk.lines.push({ t, o: t === '+' ? null : oldNo, n: t === '-' ? null : newNo, s: redactText(text) });
    file.lineCount += 1; totalLines += 1;
  };
  return {
    line(raw) {
      const l = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (hunk && (oldLeft > 0 || newLeft > 0)) {
        if (l.startsWith('\\')) return;
        const t = l[0] === '+' || l[0] === '-' ? l[0] : ' ';
        const s = l.length ? l.slice(1) : '';
        addLine(t, s);
        if (t !== '+') { oldNo += 1; oldLeft -= 1; }
        if (t !== '-') { newNo += 1; newLeft -= 1; }
        return;
      }
      if (binary) {
        if (binary.side === 'wait-forward' || binary.side === 'wait-reverse') {
          const m = /^(literal|delta) (\d+)$/.exec(l);
          if (m) { binary = { side: binary.side === 'wait-forward' ? 'after' : 'before', kind: m[1], size: Number(m[2]), lines: [] }; return; }
          binary = null;
        } else if (l === '') { const side = binary.side; flushBinary(); binary = side === 'after' ? { side: 'wait-reverse' } : null; return; }
        else { binary.lines.push(l); return; }
      }
      if (l.startsWith('From ') && /^From [0-9a-f]{40} /.test(l)) { commits.push({ sha: l.slice(5, 45), subject: null }); mode = 'mail'; subject = null; file = null; hunk = null; return; }
      if (mode === 'mail') {
        if (l.startsWith('Subject: ')) { subject = l.slice(9).replace(/^\[PATCH[^\]]*\]\s*/, ''); return; }
        if (subject != null && l.startsWith(' ') && commits.length && commits.at(-1).subject == null) { subject += l; return; }
        if (subject != null && commits.length && commits.at(-1).subject == null && l === '') { commits.at(-1).subject = redactText(subject.trim()).slice(0, 300); return; }
      }
      if (l.startsWith('diff --git ')) {
        startFile();
        mode = 'diff'; hunk = null; blobs = null;
        const [a, b] = pathsOfDiffLine(l);
        pending = { a, b, status: 'M' };
        file = null;
        return;
      }
      if (mode !== 'diff') return;
      if (pending) {
        if (l.startsWith('new file mode')) { pending.status = 'A'; return; }
        if (l.startsWith('deleted file mode')) { pending.status = 'D'; return; }
        if (l.startsWith('rename from ')) { pending.a = unquoteGitPath(l.slice(12)); pending.status = 'R'; return; }
        if (l.startsWith('rename to ')) { pending.b = unquoteGitPath(l.slice(10)); pending.status = 'R'; return; }
        if (l.startsWith('copy from ')) { pending.a = unquoteGitPath(l.slice(10)); pending.status = 'A'; return; }
        if (l.startsWith('copy to ')) { pending.b = unquoteGitPath(l.slice(8)); return; }
        if (l.startsWith('index ')) { const m = /^index ([0-9a-f]+)\.\.([0-9a-f]+)/.exec(l); if (m) blobs = [m[1], m[2]]; return; }
        if (l.startsWith('--- ')) { const a = stripSide(l.slice(4)); if (a) pending.a = a; return; }
        if (l.startsWith('+++ ')) { const b = stripSide(l.slice(4)); if (b) pending.b = b; else if (pending.status === 'D') pending.b = null; startFile(); return; }
        if (l.startsWith('GIT binary patch') || (l.startsWith('Binary files ') && l.endsWith(' differ'))) {
          startFile();
          if (!file.omitted) file.binary = true;
          if (l.startsWith('GIT binary patch')) binary = { side: 'wait-forward' };
          return;
        }
        if (/^(old|new) mode |^similarity index |^dissimilarity index /.test(l)) return;
        if (l.startsWith('@@')) startFile();
        else return;
      }
      const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(l);
      if (h && file) {
        oldNo = Number(h[1]); newNo = Number(h[3]);
        oldLeft = h[2] == null ? 1 : Number(h[2]); newLeft = h[4] == null ? 1 : Number(h[4]);
        hunk = { header: redactText(l).slice(0, 400), oldStart: oldNo, newStart: newNo, lines: [] };
        if (!file.omitted && file.lineCount < caps.fileLines && totalLines < caps.totalLines) file.hunks.push(hunk);
        else { file.truncated = !file.omitted; anyTruncated = true; }
        return;
      }
      if (l === '-- ') { mode = 'sig'; file = null; hunk = null; }
    },
    finish() {
      startFile();
      flushBinary();
      const list = [...files.values()].map(({ lineCount, ...f }) => f);
      const omittedFiles = omitted.size;
      const totals = { files: list.length + omittedFiles, added: list.reduce((n, f) => n + f.added, 0), removed: list.reduce((n, f) => n + f.removed, 0) };
      return { commits, totals, files: list, truncated: anyTruncated, omittedFiles };
    },
  };
}

/** Feed a file's lines to `onLine` in bounded chunks: a patch can exceed any single string. */
function forEachLine(file, onLine, chunkBytes = 8 * 1024 * 1024) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(chunkBytes);
    let carry = '';
    for (;;) {
      const n = fs.readSync(fd, buf, 0, chunkBytes, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split('\n');
      carry = lines.pop();
      for (const l of lines) onLine(l);
    }
    if (carry) onLine(carry);
  } finally { fs.closeSync(fd); }
}

/** Parse patch text (a string) - what the specs and small callers use. */
export function parsePatchText(text, options = {}) {
  const parser = patchParser(options);
  for (const l of String(text).split('\n')) parser.line(l);
  return parser.finish();
}

export const patchJsonFileOf = (patchFile) => `${patchFile}.json`;
export const patchAssetsDirOf = (patchFile) => `${patchFile}.assets`;

/**
 * Write <patch>.json (and <patch>.assets/ for decoded image literals) once; an existing json is kept.
 * `meta`: {base, head, landed, state}. Returns {file, written|kept|wouldWrite, files, truncated} or {error}.
 */
export function writePatchJson(patchFile, meta = {}, { dryRun = false, caps = diffCaps() } = {}) {
  const file = patchJsonFileOf(patchFile);
  if (fs.existsSync(file)) return { file, kept: true };
  if (!fs.existsSync(patchFile)) return { file, error: 'patch missing' };
  if (dryRun) return { file, wouldWrite: true };
  const assets = patchAssetsDirOf(patchFile);
  const written = new Map();
  const parser = patchParser({ caps, onLiteral: ({ blob, data, path: p }) => {
    const name = `${blob}${path.extname(p).toLowerCase()}`;
    const dest = path.join(assets, name);
    if (!fs.existsSync(dest)) { fs.mkdirSync(assets, { recursive: true }); fs.writeFileSync(dest, data, { flag: 'wx' }); }
    written.set(blob, `${path.basename(assets)}/${name}`);
  } });
  forEachLine(patchFile, (l) => parser.line(l));
  const parsed = parser.finish();
  for (const f of parsed.files) for (const side of ['before', 'after']) if (f[side] && written.has(f[side].blob)) f[side].asset = written.get(f[side].blob);
  const doc = { schema: PATCH_JSON_SCHEMA, patch: path.basename(patchFile), base: meta.base ?? null, head: meta.head ?? null, landed: meta.landed ?? null,
    unlanded: meta.state ? meta.state !== 'landed' : !meta.landed, ...parsed, caps };
  fs.writeFileSync(file, JSON.stringify(doc), { flag: 'wx' });
  return { file, written: true, files: parsed.files.length, truncated: parsed.truncated, assets: written.size };
}
