// decision-critic-product.mjs - what the Critic of a decision leg (scope.define, architecture.decide) is handed and what the settle
// gate recomputes. The rubric of each kind is data (modules/kernel/critic-rubrics.yaml); the product is the op's decision records
// found by the kind's globs under the work root, and the inputs are the records those records cite (the kind's `cites` fields),
// resolved by id. Every handed file is copied into the Critic's directory by decision-critic.mjs and hashed by the Critic standard
// (critic-verdict.mjs handedDigests); the settle gate (scripts/kernel/critic-settle.mjs) calls productDigests with the same
// discovery, so a verdict that judged fewer or other bytes than the op's product now is stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { globExpression } from '../lib/glob.mjs';
import { slash } from '../lib/path-key.mjs';
import { indexFilesUnder } from './work-io.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUBRICS_FILE = 'modules/kernel/critic-rubrics.yaml';
const WORK_ROOT_NAME = '.starciwork';

/** The Critic rubric table of the tree at `root`: {inputs: {maxFiles, maxBytes}, kinds: [...]}. */
export const criticRubrics = (root = ROOT) => parseYaml(fs.readFileSync(path.join(root, RUBRICS_FILE), 'utf8'));

/** The rubric entry of op kind `kind`, or null when the kind has none. */
export const kindEntryOf = (kind, rubrics = criticRubrics()) => rubrics.kinds.find((row) => row.id === kind) ?? null;

/** The rubric file the Critic reads for one kind: the checks, the gate cap and the score anchors in the shape of the drawing rubric. */
export function decisionRubric(entry) {
  return { schema: 'starci/decision-rubric@1', source: `${RUBRICS_FILE} kinds[id=${entry.id}]`, kind: entry.id, derivedFrom: entry.derivedFrom,
    checks: entry.checks, gateCap: entry.gateCap, minimum: entry.minimum, beautyAnchors: entry.scoreAnchors };
}

const readRecord = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/** The work-root-relative form of an owned path (`.starciwork/features/x/sds` -> `features/x/sds`), or null when it names no part of a work root. */
export function ownedRelOf(owned) {
  const parts = slash(String(owned ?? '')).split('/').filter((part) => part && part !== '.');
  const at = parts.indexOf(WORK_ROOT_NAME);
  if (at < 0) return null;
  const rest = parts.slice(at + 1);
  while (['**', '*'].includes(rest.at(-1))) rest.pop();
  return rest.join('/');
}

/**
 * The decision records of `entry` under `workRoot`: [{abs, rel}] sorted by rel, the files matching the kind's product globs. `within`
 * (work-root-relative prefixes) keeps only the records at or under one of them; `files` (absolute) keeps only those named.
 */
export function productFiles({ workRoot, entry, within = null, files = null }) {
  const matchers = entry.product.records.map((glob) => globExpression(glob));
  const named = files ? new Set(files.map((file) => path.resolve(file))) : null;
  return indexFilesUnder(workRoot).map((abs) => ({ abs, rel: slash(path.relative(workRoot, abs)) }))
    .filter(({ abs, rel }) => matchers.some((match) => match.test(rel))
      && (!within || within.some((prefix) => prefix === '' || rel === prefix || rel.startsWith(`${prefix}/`)))
      && (!named || named.has(path.resolve(abs))))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

const valuesAt = (doc, dotted) => {
  const out = [];
  const walk = (node, keys) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach((item) => walk(item, keys)); return; }
    if (!keys.length) { if (typeof node === 'string') out.push(node); else if (node && typeof node === 'object') Object.values(node).forEach((v) => walk(v, [])); return; }
    if (typeof node === 'object') walk(node[keys[0]], keys.slice(1));
  };
  walk(doc, String(dotted).split('.'));
  return out;
};

/** The ids and paths a product record cites through the `cites` fields of its kind (the fields' values, arrays and objects flattened). */
function citedBy(doc, cites) {
  return [...new Set(cites.flatMap((field) => valuesAt(doc, field)).map((value) => value.trim().split('#')[0]).filter(Boolean))];
}

/** id -> absolute file of every record of the work root. */
function recordIndex(workRoot) {
  const byId = new Map();
  for (const file of indexFilesUnder(workRoot)) {
    const id = readRecord(file)?.id;
    if (typeof id === 'string' && !byId.has(id)) byId.set(id, file);
  }
  return byId;
}

const fileUnder = (base, rel) => {
  const abs = path.resolve(base, rel);
  const inside = path.relative(base, abs);
  return !inside.startsWith('..') && !path.isAbsolute(inside) && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
};

/**
 * The inputs the product cites, resolved: [{abs, rel, cited}] (rel relative to the work root, or `repo:<path>` for a file of the repository
 * holding the work root) within the bounds of the rubric table, plus `unhanded` (cited, not handed: unresolved, too large, or past maxFiles).
 */
export function citedInputs({ workRoot, product, entry, inputs }) {
  const byId = recordIndex(workRoot);
  const own = new Set(product.map((p) => path.resolve(p.abs)));
  const cited = [...new Set(product.flatMap(({ abs }) => citedBy(readRecord(abs) ?? {}, entry.cites)))].sort((a, b) => a.localeCompare(b));
  const handed = [], unhanded = [];
  const repoRoot = path.dirname(workRoot);
  for (const name of cited) {
    const abs = byId.get(name) ?? fileUnder(workRoot, name) ?? fileUnder(repoRoot, name);
    if (!abs) { unhanded.push(name); continue; }
    if (own.has(path.resolve(abs))) continue;
    if (fs.statSync(abs).size > inputs.maxBytes || handed.length >= inputs.maxFiles) { unhanded.push(name); continue; }
    const underWork = path.relative(workRoot, abs);
    handed.push({ abs, rel: underWork.startsWith('..') ? `repo:${slash(path.relative(repoRoot, abs))}` : slash(underWork), cited: name });
  }
  return { handed, unhanded };
}

/** The digests of the product and the cited inputs now: {product: [{label, sha256}], inputs: [{label, sha256}]}. Labels are the work-root-relative paths. */
export function productDigests({ workRoot, entry, inputs, within = null, files = null }) {
  const product = productFiles({ workRoot, entry, within, files });
  const cited = citedInputs({ workRoot, product, entry, inputs }).handed;
  const digest = ({ abs, rel }) => ({ label: rel, sha256: sha256(fs.readFileSync(abs)) });
  return { product: product.map(digest), inputs: cited.map(digest) };
}
