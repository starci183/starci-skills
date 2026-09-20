#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {walk} from '../checks/check-example-work.mjs';
import {readWorkspace, repoRootFor} from '../example/example-ownership.mjs';

/**
 * v6-4's FM3 autopsy: renaming one directory - `src/modules/bussiness`, a typo waiting to be
 * fixed - means N hand-edits across four denormalized field shapes (`br.module`,
 * `impl.owners[].path`, `sds.owners[].path`, `fr.composes[].module`), every covering evidence
 * digest gone stale, and any `composes[].module` the gate never checks left dangling. A rename is
 * one fact; the layout stores it in five places, so the rewrite is a tool, not a search-replace
 * the author half-misses by hand.
 *
 * Dry-run by default; `--apply` rewrites in place. Two deliberate refusals: `--to` must already
 * exist under a bound repository root (the code moves first, the records follow - a `--to` that
 * exists nowhere is a typo about to be written into every record), and a file that does not parse
 * is skipped loudly rather than text-spliced blind.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel = p => path.relative(root, p).replaceAll('\\', '/') || '.';

// ---- concept 1: a path to remap is a whole scalar, not a substring ----
// Every path-bearing shape (owners[].path, module as string or list, composes[].module, surface
// fields, inputRefs, codeDigest.files[].path) stores the path AS the complete field value, so the
// rule needs no per-shape enumeration: a scalar equal to --from or starting with `--from/`
// remaps; everything else is left alone. A `--from` sitting inside a larger string (a jest
// command line, an observation, prose) is counted and reported but never rewritten - editing a
// captured command would falsify the evidence that recorded it.
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normPrefix = raw => String(raw ?? '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
const underPrefix = (value, from) => value === from || value.startsWith(from + '/');

/** `from` occurring at a token boundary inside a larger string (left char is not a path char,
 * right char ends the path token). Used only to REPORT embedded mentions, never to rewrite. */
const embeddedRe = from => new RegExp(`(^|[^\\w./~-])${escapeRe(from)}(?=[/\\s)\\]},;:'"]|$)`, 'g');

function collectPaths(node, trail, from, to, emb, out) {
  if (typeof node === 'string') {
    if (underPrefix(node, from)) out.rewrites.push({trail, old: node, next: to + node.slice(from.length)});
    else {
      const hits = [...node.matchAll(emb)].length;
      if (hits) out.embedded.push({trail, value: node, hits});
    }
    return;
  }
  if (Array.isArray(node)) return node.forEach((item, i) => collectPaths(item, `${trail}[${i}]`, from, to, emb, out));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collectPaths(v, trail ? `${trail}.${k}` : k, from, to, emb, out);
  }
}

// ---- concept 2: comment-preserving splice ----
// core/yaml.mjs's parseYaml runs toJS() - comments and layout are gone before a value is seen -
// so a parse/edit/stringify round-trip would rewrite every line of every file and drop the
// provenance headers evidence.yaml carries. Instead each parsed scalar is spliced back into the
// raw text only where it is the WHOLE scalar: a key colon, seq dash, flow delimiter or quote on
// the left; EOL, a ` #` comment or a flow delimiter on the right. `notes: moved to src/x` fails
// the left check (its scalar starts at `moved`); `path: src/x,` fails the right check outside
// flow (the comma is scalar content).

/** True when `idx` sits inside an unclosed [/{ in the text before it. A naive prefix count is
 * enough for these tool-authored files - brackets in prose are rare and almost always balanced. */
const inFlow = (text, idx) => {
  let depth = 0;
  for (let i = 0; i < idx; i++) {
    if (text[i] === '[' || text[i] === '{') depth++;
    else if (text[i] === ']' || text[i] === '}') depth--;
  }
  return depth > 0;
};

/** Whether text[start..start+len) is bounded as a complete yaml scalar. */
function isWholeScalar(text, start, len) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let i = start - 1;
  while (i >= lineStart && (text[i] === ' ' || text[i] === '\t')) i--;
  const before = i >= lineStart ? text[i] : null;
  let quote = null;
  if (before === ':') { /* map value, block or flow */ }
  else if (before === '[' || before === ',') { if (!inFlow(text, start)) return false; }
  else if (before === '"' || before === "'") quote = before;
  // a seq dash is a marker only when nothing but indent/dashes precedes it on the line -
  // `notes: moved - src/x` is prose inside one scalar, not a list item
  else if (before === '-') { if (!/^[ \t-]*$/.test(text.slice(lineStart, i))) return false; }
  else return false;

  const afterIdx = start + len;
  const after = text[afterIdx];
  if (after === undefined || after === '\n' || after === '\r') return true;
  if (quote) return after === quote;
  if (after === '"' || after === "'") return false;
  if (after === ',' || after === ']' || after === '}') return inFlow(text, afterIdx);
  if (after === ' ' || after === '\t') {
    let j = afterIdx;
    while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
    return text[j] === '#' || text[j] === '\n' || text[j] === '\r' || j === text.length;
  }
  return false;
}

/** Every position where `oldValue` occupies a complete scalar in `text`. */
function scalarEdits(text, oldValue, next) {
  const edits = [];
  let idx = text.indexOf(oldValue);
  while (idx !== -1) {
    if (isWholeScalar(text, idx, oldValue.length)) edits.push({start: idx, end: idx + oldValue.length, next});
    idx = text.indexOf(oldValue, idx + 1);
  }
  return edits;
}

// ---- concept 3: --with-evidence marks what the remap stales ----
// A record whose owners/module moved makes its evidence's codeDigest a lie the moment the rewrite
// lands - the digest was captured over the old paths. Re-proving is example-evidence.mjs's job;
// this tool's honest minimum is the same escape valve check-example-work.mjs already honours:
// `stale: true` plus a staleReason saying which remap did it. An evidence.yaml is affected when
// its own files[].path entries moved OR the record beside it did (recordDigest stales too).
// Marking is a top-level scalar set, spliced the same comment-preserving way.
function setTopLevelScalar(text, key, rawValue) {
  const m = new RegExp(`^${key}:[ \\t]*`, 'm').exec(text);
  if (!m) {
    const sep = text === '' || text.endsWith('\n') ? '' : '\n';
    return `${text}${sep}${key}: ${rawValue}\n`;
  }
  const valueStart = m.index + m[0].length;
  let lineEnd = text.indexOf('\n', valueStart);
  if (lineEnd === -1) lineEnd = text.length;
  const commentAt = text.slice(valueStart, lineEnd).indexOf(' #');
  let valueEnd = commentAt === -1 ? lineEnd : valueStart + commentAt;
  while (valueEnd > valueStart && (text[valueEnd - 1] === ' ' || text[valueEnd - 1] === '\t')) valueEnd--;
  return text.slice(0, valueStart) + rawValue + text.slice(valueEnd);
}

/**
 * Scan one .starciwork tree for scalars a `from -> to` path remap would touch. Returns
 * {files: Map<abs, {rel, rewrites, embedded, mentions, doc}>, staleTargets: Map<evidenceAbs, why>,
 * problems}. `_derived/` is skipped - generated output regenerates, it is never edited.
 */
export function scanTree(workRoot, from, to) {
  const emb = embeddedRe(from);
  const rawRe = new RegExp(`${escapeRe(from)}(?=[/\\s)\\]},;:'"]|$)`, 'g');
  const files = new Map();
  const problems = [];
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const fileRel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (fileRel === '_derived' || fileRel.startsWith('_derived/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    let doc;
    try { doc = parseYaml(text); } catch { problems.push(`${fileRel}: does not parse`); continue; }
    const rec = {rel: fileRel, rewrites: [], embedded: [], mentions: 0, doc};
    collectPaths(doc, '', from, to, emb, rec);
    const rawHits = [...text.matchAll(rawRe)].length;
    rec.mentions = Math.max(0, rawHits - rec.rewrites.length - rec.embedded.reduce((n, e) => n + e.hits, 0));
    if (rec.rewrites.length || rec.embedded.length || rec.mentions) files.set(file, rec);
  }

  const staleTargets = new Map();
  for (const [file, rec] of files) {
    if (!rec.rewrites.length) continue;
    if (path.basename(file) === 'evidence.yaml') staleTargets.set(file, 'its own codeDigest paths moved');
    else {
      const sibling = path.join(path.dirname(file), 'evidence.yaml');
      if (fs.existsSync(sibling) && !staleTargets.has(sibling)) staleTargets.set(sibling, 'the record beside it moved');
    }
  }
  for (const file of staleTargets.keys()) {
    if (files.has(file)) continue;
    const fileRel = path.relative(workRoot, file).replaceAll('\\', '/');
    try {
      const doc = parseYaml(fs.readFileSync(file, 'utf8'));
      files.set(file, {rel: fileRel, rewrites: [], embedded: [], mentions: 0, doc});
    } catch { problems.push(`${fileRel}: evidence does not parse`); staleTargets.delete(file); }
  }
  return {files, staleTargets, problems};
}

/** Where a `--to` prefix may legitimately resolve: the owning repository root (dirname of the
 * workRoot), every bound non-backend repository, and the toolkit root for `.claude`-relative
 * values like the `examples/...` paths inputRefs carry. */
export function searchRoots(workRoot, workspaceDoc) {
  const roots = [path.dirname(workRoot)];
  for (const r of Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : []) {
    if (r?.name && r.role !== 'be') roots.push(repoRootFor(workRoot, r.name, workspaceDoc));
  }
  roots.push(root);
  return [...new Set(roots.map(r => path.resolve(r)))];
}

export const findTargetRoot = (workRoot, to, workspaceDoc) =>
  searchRoots(workRoot, workspaceDoc).find(r => fs.existsSync(path.join(r, to))) ?? null;

/** Apply a scan's rewrites by whole-scalar text splice (comments survive), then - with
 * `withEvidence` - mark each affected evidence.yaml stale. Returns counts and warnings. */
export function applyScan(workRoot, scan, {from, to, withEvidence}) {
  const written = [], warnings = [];
  for (const [file, rec] of scan.files) {
    if (!rec.rewrites.length) continue;
    const text = fs.readFileSync(file, 'utf8');
    // two fields can carry the same value (`module` and `composes[].module` both naming
    // src/old/x) - splice per DISTINCT old string or each field finds the other's occurrences
    // and the edits overlap
    const distinct = new Map(rec.rewrites.map(rw => [rw.old, rw.next]));
    const edits = [...distinct].flatMap(([old, next]) => scalarEdits(text, old, next))
      .sort((a, b) => a.start - b.start);
    if (edits.some((e, k) => k > 0 && e.start < edits[k - 1].end)) {
      warnings.push(`${rec.rel}: overlapping scalar edits - file left untouched`);
      continue;
    }
    if (rec.rewrites.length !== edits.length) {
      warnings.push(`${rec.rel}: ${rec.rewrites.length - edits.length} parsed scalar(s) found no whole-scalar ` +
        'text match (folded? quoted across lines?) - left for a hand edit');
    }
    if (!edits.length) continue;
    let out = text;
    const descending = edits.slice().sort((a, b) => b.start - a.start);
    for (const e of descending) out = out.slice(0, e.start) + e.next + out.slice(e.end);
    fs.writeFileSync(file, out);
    written.push(file);
  }

  const markedStale = [], alreadyStale = [];
  if (withEvidence) {
    const reason = JSON.stringify(`path remap ${from} -> ${to}`);
    for (const file of scan.staleTargets.keys()) {
      if (scan.files.get(file)?.doc?.stale === true) { alreadyStale.push(file); continue; }
      let text = fs.readFileSync(file, 'utf8');
      text = setTopLevelScalar(text, 'stale', 'true');
      text = setTopLevelScalar(text, 'staleReason', reason);
      fs.writeFileSync(file, text);
      markedStale.push(file);
      if (!written.includes(file)) written.push(file);
    }
  }
  return {written, markedStale, alreadyStale, warnings};
}

// ---------- main ----------
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const opt = n => args.includes(n) ? args[args.indexOf(n) + 1] : null;
  const apply = args.includes('--apply');
  const withEvidence = args.includes('--with-evidence');
  const from = normPrefix(opt('--from'));
  const to = normPrefix(opt('--to'));
  const usage = 'usage: node scripts/work/work-remap-path.mjs [--tree <workRoot>] --from <oldPrefix>' +
    ' --to <newPrefix> [--apply] [--with-evidence]';
  const bad = m => { console.log(`REFUSE  ${m}\n${usage}`); process.exitCode = 2; };

  if (!from || !to) bad('--from and --to are required');
  else if (from === to) bad('--from and --to are identical');
  else if ([from, to].some(p => path.isAbsolute(p) || p.split('/').includes('..'))) {
    bad('prefixes must be relative paths, no absolutes or ..');
  } else {
    const treeArg = opt('--tree');
    const trees = treeArg ? [path.resolve(treeArg)]
      : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);
    let refused = 0, fields = 0, embedded = 0, mentions = 0, stales = 0, written = 0;
    for (const workRoot of trees) {
      const workspaceDoc = readWorkspace(workRoot);
      const targetRoot = fs.existsSync(workRoot) ? findTargetRoot(workRoot, to, workspaceDoc) : null;
      if (!targetRoot) {
        const rootsTried = searchRoots(workRoot, workspaceDoc).map(rel).join(', ');
        console.log(`REFUSE  ${rel(workRoot)}: --to ${to} exists under none of ${rootsTried}` +
          ' - move the code first, then remap the records');
        refused++;
        continue;
      }
      const scan = scanTree(workRoot, from, to);
      for (const p of scan.problems) { console.log(`REFUSE  ${rel(workRoot)}/${p}`); refused++; }

      const hitFiles = [...scan.files.values()].filter(r => r.rewrites.length);
      const fieldCount = hitFiles.reduce((n, r) => n + r.rewrites.length, 0);
      console.log(`\n${rel(workRoot)} - ${apply ? 'APPLY' : 'DRY-RUN'}: ${fieldCount} field(s)` +
        ` in ${hitFiles.length} file(s) (${to} found under ${rel(targetRoot)})`);
      for (const [file, rec] of [...scan.files.entries()].sort((a, b) => a[1].rel.localeCompare(b[1].rel))) {
        if (!rec.rewrites.length && !scan.staleTargets.has(file)) continue;
        console.log(`  ${rec.rel}`);
        for (const rw of rec.rewrites) console.log(`    ${rw.trail}: ${rw.old} -> ${rw.next}`);
        if (scan.staleTargets.has(file)) {
          const verb = apply && withEvidence ? 'marked' : 'would mark';
          console.log(rec.doc?.stale === true
            ? `    [evidence] already stale: true - left as is`
            : `    [evidence] ${verb} stale: true (${scan.staleTargets.get(file)})`);
        }
      }
      const emb = [...scan.files.values()].flatMap(r => r.embedded.map(e => ({rel: r.rel, ...e})));
      const notes = [...scan.files.values()].reduce((n, r) => n + r.mentions, 0);
      for (const e of emb.slice(0, 8)) console.log(`  untouched, inside a larger value: ${e.rel} ${e.trail}`);
      if (emb.length > 8) console.log(`  ... and ${emb.length - 8} more embedded scalar(s)`);
      if (notes) console.log(`  ${notes} occurrence(s) in comments/prose context left untouched`);

      if (apply) {
        const res = applyScan(workRoot, scan, {from, to, withEvidence});
        for (const w of res.warnings) console.log(`  SUSPECT ${w}`);
        written += res.written.length;
        stales += res.markedStale.length;
      } else stales += scan.staleTargets.size;
      fields += fieldCount;
      embedded += emb.length;
      mentions += notes;
    }
    const verb = apply && withEvidence ? 'marked' : 'to mark';
    console.log(`\n${apply ? 'applied' : 'would change'} ${fields} field(s)` +
      `${apply ? ` across ${written} file(s)` : ''}; ${stales} evidence file(s) ${verb} stale` +
      `${embedded ? `; ${embedded} embedded scalar(s) untouched` : ''}` +
      `${mentions ? `; ${mentions} prose/comment occurrence(s) untouched` : ''}`);
    if (!apply) {
      console.log('dry-run only - pass --apply to write, --with-evidence to also mark affected evidence stale');
    }
    process.exitCode = refused ? 1 : 0;
  }
}
