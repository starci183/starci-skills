// ask-images.mjs — the images an owner question serves: paths named in its text or files globs,
// a draws.yaml next to the candidates, each mapped to the drawn PART the owner rules on.
// Extracted from ask-server.mjs (the form renderer and its POST answer stay there).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { drawImageRefs, ownerImages } from '../work/direction-part.mjs';

export const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

const IMG_EXT = /\.(?:png|jpe?g|webp|gif|svg)\b/gi;
const IMG_CHARS = /[\w./\\-]/;

// The `[\w./\\-]+\.ext` tokens of `text` without the backtracking regex: a charset that includes '.'
// makes each maximal run one token, and inside it the RIGHTMOST '.ext' ends the match — the greedy
// run backtracks from its end. (The images a question names — extract image paths named in the
// question and serve them inline. Basenames like auth-sign-in-desktop-direction.png are located by
// a bounded walk under .starciwork, the only tree where workflow evidence lives.)
const imageTokens = (text) => {
  const out = [];
  for (const run of text.matchAll(/[\w./\\-]+/g)) {
    const exts = [...run[0].matchAll(IMG_EXT)];
    const last = exts.at(-1);
    if (last && last.index > 0) out.push(run[0].slice(0, last.index + last[0].length));
  }
  return [...new Set(out)];
};

/** One basename under .starciwork, or null (BFS — a DFS stack would burn the budget in kernel-strays archives). */
const locateNamed = (root, base) => {
  const queue = [root]; let head = 0, visited = 0;
  while (head < queue.length && visited++ < 20000) {
    const dir = queue[head++];
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (e.name === base) return path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.')) queue.push(path.join(dir, e.name));
    }
  }
  return null;
};

const imagesOf = (text, repo) => {
  const root = path.join(repo, '.starciwork');
  const found = [];
  for (const t of imageTokens(text)) {
    const rel = t.replaceAll('\\', '/');
    const abs = path.join(repo, rel);
    if (rel.includes('/') && fs.existsSync(abs)) { found.push({ label: rel, abs }); continue; }
    const hit = fs.existsSync(root) ? locateNamed(root, path.basename(rel)) : null;
    if (hit) found.push({ label: rel, abs: hit });
  }
  return found;
};
export { imagesOf };

// A candidate-pick ask often names no files in its question — the artifacts
// live behind the report's `files` globs instead. Expand each glob's static
// directory prefix and collect the newest images beneath it (bounded, so a
// stray `**` cannot crawl the whole tree).
// A selection ask declares its reviewable artifacts explicitly through
// `question.assets` — repo-relative paths, optionally {path, label} — so the
// owner judges the artifacts, not a text description of them.
const assetsOf = (assets, repo) => {
  const out = [];
  for (const a of assets ?? []) {
    const spec = typeof a === 'string' ? a : a?.path;
    if (!spec) continue;
    const rel = String(spec).replaceAll('\\', '/');
    const abs = path.join(repo, rel);
    if (fs.existsSync(abs) && MIME[path.extname(abs).slice(1).toLowerCase()])
      out.push({ label: (typeof a === 'object' && a?.label) || rel, abs });
  }
  return out;
};
export { assetsOf };

/** The {id, refs} draw entries of a draws.yaml text: parseYaml first, a line scan when that gives no draws. */
const drawEntries = (text) => {
  try {
    const doc = parseYaml(text);
    if (Array.isArray(doc?.draws)) return doc.draws.map((d) => ({ id: d?.id ?? null, refs: drawImageRefs(d) }));
  } catch { /* line scan below */ }
  const entries = [];
  let id = null;
  for (const line of text.split('\n')) {
    const idM = line.match(/^\s+-\s+id:\s*(\S+)/) ?? line.match(/^\s+id:\s*(\S+)/);
    if (idM) { id = idM[1]; continue; }
    const imgM = line.match(/^\s+part:\s*(\S+)/);
    if (imgM) entries.push({ id, refs: [imgM[1]] });
  }
  return entries;
};

// Candidate draws are always recorded in a draws.yaml next to their assets —
// when an ask names no paths at all, render the newest draw set rather than
// leaving the owner to pick blind.
// The images a draws.yaml names. Only a draws.yaml the ask's own report lists
// is read: picking "the newest draws.yaml in the tree" once served another
// workflow's candidates under an unrelated question.
// Each draw names its part as a path or {path, sha256} (drawImageRefs).
const drawsImages = (repo, drawsFile) => {
  const root = path.join(repo, '.starciwork');
  const newest = drawsFile;
  if (!newest || !fs.existsSync(newest)) return [];
  const entries = drawEntries(fs.readFileSync(newest, 'utf8'));
  // draw entries resolve image paths against their ui-node dir, not
  // necessarily the evidence dir holding draws.yaml — walk ancestors up
  // to .starciwork until the relative path exists.
  const resolve = (rel) => {
    for (let up = 0, dir = path.dirname(newest); up < 6 && dir.startsWith(root); up++, dir = path.dirname(dir)) {
      const cand = path.join(dir, rel);
      if (fs.existsSync(cand)) return cand;
    }
    return null;
  };
  const out = [];
  for (const { id, refs } of entries) {
    for (const rel of refs) {
      const abs = resolve(rel);
      if (abs && MIME[path.extname(abs).slice(1).toLowerCase()]) { out.push({ label: id ?? rel, abs }); break; }
    }
  }
  return out;
};

// Owner ruling 2026-09-24: the owner reviews the drawn PART (page content,
// overlay panel, layout drawing), never the composite placed into the layout
// capture — that stays evidence for interface.implement/audit. Every image an
// ask serves goes through this: a composite becomes its part (the label
// follows it, the original path stays an alias a declared pick still
// matches), and a composite listed beside its own part collapses into one.
export const toOwnerImages = (images, repo) => {
  const repoRel = (abs) => path.relative(repo, abs).replaceAll('\\', '/');
  const labels = new Map((images ?? []).map((img) => [img?.abs, img?.label]));
  return ownerImages(images).map((img) => {
    const aliases = [...new Set(img.aliases.flatMap((a) => [labels.get(a), repoRel(a)]).filter(Boolean))];
    if (!img.composite) return { ...img, aliases };
    // A label that is the composite's own file name follows the swap; a
    // draw id or a declared label stays.
    const named = String(img.label ?? '').replaceAll('\\', '/');
    const label = !named || named.endsWith(path.basename(img.composite)) ? repoRel(img.abs) : img.label;
    return { ...img, label, aliases };
  });
};

/** The images under one glob's static directory prefix (bounded BFS), into `out`/`seen`. */
const appendGlobImages = (repo, dir, entries, queue, out, seen) => {
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('.')) queue.push(p);
      continue;
    }
    if (!MIME[path.extname(e.name).slice(1).toLowerCase()] || seen.has(p)) continue;
    seen.add(p); out.push({ label: path.relative(repo, p).replaceAll('\\', '/'), abs: p, mtime: e.mtimeMs ?? fs.statSync(p).mtimeMs });
  }
};

const globImages = (repo, base, out, seen) => {
  if (!fs.existsSync(base)) return;
  const queue = [base]; let head = 0, visited = 0;
  while (head < queue.length && visited++ < 4000 && out.length < 16) {
    const dir = queue[head++];
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    appendGlobImages(repo, dir, ents, queue, out, seen);
  }
};

/** The images one report `files` entry resolves to, into `out`/`seen`. */
const specImages = (spec, repo, out, seen) => {
  const rel = String(spec).replaceAll('\\', '/');
  const abs = path.join(repo, rel);
  if (/(^|\/)draws\.yaml$/.test(rel)) {
    for (const img of drawsImages(repo, abs)) if (!seen.has(img.abs)) { seen.add(img.abs); out.push(img); }
    return;
  }
  if (!/[*{[]/.test(rel)) {
    if (fs.existsSync(abs) && MIME[path.extname(abs).slice(1).toLowerCase()] && !seen.has(abs)) { seen.add(abs); out.push({ label: rel, abs, mtime: fs.statSync(abs).mtimeMs }); }
    return;
  }
  const prefix = rel.slice(0, rel.search(/[*{[]/)).replace(/\/[^/]*$/, '');
  globImages(repo, path.join(repo, prefix), out, seen);
};

export const reportImages = (files, repo) => {
  const out = [], seen = new Set();
  for (const spec of files ?? []) specImages(spec, repo, out, seen);
  // An evidence bundle's direction.png is a copy of a record asset: when the report
  // also names images outside evidence/, those are the ones served — the
  // same rule telegram-media applies.
  const sorted = out.toSorted((a, b) => b.mtime - a.mtime);
  const outside = sorted.filter((img) => !/(^|\/)evidence\//.test(path.relative(repo, img.abs).replaceAll('\\', '/')));
  return (outside.length ? outside : sorted).slice(0, 8);
};

// Resolve pick groups for the form: declared question.picks wins; otherwise
// groups are derived from the draw naming convention
// <screen>-<choice>[-round-N] / -candidate-<choice>. Returns [] when the
// images do not partition cleanly into >=2-choice groups — the flat artifact
// list renders instead. Each choice may carry {idx,label} of its image.
export const pickGroupsOf = (question, images) => {
  const imgs = images ?? [];
  // A question that lists its options already has its answer schema; image
  // names never add required pick groups to it.
  if (!question?.picks?.length && (question?.options ?? []).length) return [];
  if (question?.picks?.length) {
    return question.picks.map((p) => ({
      id: String(p.id), label: p.label ?? String(p.id),
      choices: (p.choices ?? []).map((c) => {
        const obj = typeof c === 'string' ? { id: c, label: c } : { id: c?.id ?? c?.label, label: c?.label ?? c?.id };
        if (obj.id == null) return null;
        if (c?.image) {
          const rel = String(c.image).replaceAll('\\', '/');
          const idx = imgs.findIndex((img) => img.label === rel || img.abs.replaceAll('\\', '/').endsWith(rel) || (img.aliases ?? []).some((a) => a === rel || String(a).endsWith(`/${rel}`)));
          if (idx >= 0) obj.image = { idx, label: imgs[idx].label };
        }
        return obj;
      }).filter(Boolean),
    }));
  }
  const groups = new Map();
  for (const [i, img] of imgs.entries()) {
    const base = path.basename(img.label ?? '', path.extname(img.label ?? ''));
    const m = base.match(/^(.+?)-(?:candidate-)?([a-z])(?:-round-\d+)?$/);
    if (!m) return [];
    const [, screen, letter] = m;
    if (!groups.has(screen)) groups.set(screen, new Map());
    groups.get(screen).set(letter, { idx: i, label: img.label });
  }
  const picks = [];
  for (const [screen, choices] of groups) {
    if (choices.size < 2) return [];
    picks.push({
      id: screen, label: screen,
      choices: [...choices.keys()].sort(byCodeUnit).map((k) => ({ id: k.toUpperCase(), label: k.toUpperCase(), image: choices.get(k) })),
    });
  }
  return picks;
};

/** The index in question.review.parts of the drawn part at `abs`, or -1. */
export const reviewPartIndexOf = (review, abs, repo) => {
  if (!abs || !review?.recordPath || !Array.isArray(review.parts)) return -1;
  const dir = path.dirname(path.resolve(repo, review.recordPath));
  return review.parts.findIndex((p) => p?.path && path.resolve(dir, p.path).toLowerCase() === path.resolve(abs).toLowerCase());
};

/** The draw-review receipt extras of a submitted form: partNotes [{path, shape, note}] and golden. */
export const drawAnswerExtras = (review, params) => {
  const partNotes = (review.parts ?? []).map((p, k) => ({ path: p.path, shape: p.shape ?? null, note: String(params.get(`partnote:${k}`) ?? '').trim() })).filter((p) => p.note);
  return { ...(partNotes.length ? { partNotes } : {}), ...(params.get('golden') === '1' ? { golden: true } : {}) };
};
