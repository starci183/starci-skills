// The declared-file tables of check-work-artifacts.mjs and the walk that resolves every declaration of a document
// (a record, evidence, a generation receipt or a run manifest) to an absolute path.
import path from 'node:path';
import { resolveRecordRef } from '../record-ownership.mjs';
import { slash } from '../../lib/path-key.mjs';
import { ID_RE } from './example-work-ids.mjs';
import { repoRoot as root } from './work-consistency-shared.mjs';

// ---- concept 2: what counts as a declared path, and what it is declared relative to ----
// A blanket "any string with a dot" sweep is wrong on this layout: `inputRefs` mixes in record ids
// (`fr.plan.usage.view` reads as a `.view` file), `brand.grammar.version` is `0.4.13`, and `owners[].path`
// is a MODULE DIRECTORY that check-example-work already resolves through resolveOwnedDirs
// (OWNER_PATH_MISSING). So the shapes are named one by one below, each with the directory its value is
// relative to, and a declaration that also stamps a digest is byte-compared (`digestKey`).
const FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'webm', 'mp4', 'txt', 'md', 'json',
  'yaml', 'yml', 'mjs', 'cjs', 'html', 'css', 'sql', 'enc', 'csv', 'xml', 'svg', 'ts', 'tsx', 'jsonl']);

/** Whether a scalar is offered as a file path, rather than an id, a version, or a sentence about one. */
function looksLikeFilePath(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || text.includes(' ') || /[*?\\]/.test(text)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return false;
  if (ID_RE.test(text)) return false;
  const last = text.split('/').pop();
  const ext = (last.split('.').pop() ?? '').toLowerCase();
  return FILE_EXTENSIONS.has(ext) && last !== ext;
}

/** `*` stands for exactly one path segment, and a segment may carry the `[]` a list contributes. */
function trailMatches(pattern, trail) {
  const want = pattern.split('.');
  const have = trail.split('.');
  if (want.length !== have.length) return false;
  return want.every((segment, index) => segment === '*' || segment === have[index]);
}

export const RECORD_DECLARATIONS = [
  {trail: 'assets[].path', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'asset.path', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'ui.assets[].path', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'assets[].generation.promptPath', base: 'record', what: 'prompt', digestKey: null},
  {trail: 'ui.assets[].generation.promptPath', base: 'record', what: 'prompt', digestKey: null},
  {trail: 'ui.coverage.map[].directionAsset', base: 'record', what: 'asset', digestKey: null},
  // A superseded direction names the path the replaced raster occupied and the digest it had at that
  // revision; the file beside it now holds the newer revision on purpose, so path and digest can never
  // both describe today's bytes. Its path is still checked (a superseded entry pointing at nothing is a
  // dangling revision note), its sha256 deliberately is not - the one false-positive class this script
  // found on the live trees (7 of 37 digest refusals before the digestKey was dropped here).
  {trail: 'ui.supersededDirection.path', base: 'repo', what: 'asset', digestKey: null},
  {trail: 'ui.anatomyReview.reviewPath', base: 'record', what: 'review', digestKey: null},
  // An artwork slot borrows the brand's master rather than repeating a `../../..` path: the entry says whose
  // record it reads (`master: {record: brand, path: assets/turtle-master.png}`), so that is the base.
  {trail: 'ui.artworkSlots[].master.path', base: 'named-record', what: 'asset', digestKey: 'sha256'},
  // The one uat resource the base gate reads only `if existsSync` - a missing file passes there.
  {trail: 'accounts', base: 'record', what: 'accounts', digestKey: null},
  // Declared inputs: the bytes an artifact was built from. Nothing here is refused when it moves - the
  // Work tree keeps the artifact, not what the artifact was drawn from - so `what: 'input'` is the tier.
  {trail: 'assets[].generation.inputRefs[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'ui.assets[].generation.inputRefs[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'assets[].generation.referencedImages[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'ui.assets[].generation.referencedImages[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'ui.acceptedInputs.*.path', base: 'repo', what: 'input', digestKey: 'sha256'},
  {trail: 'ui.provenance.*.path', base: 'repo', what: 'input', digestKey: 'sha256'},
];

export const EVIDENCE_DECLARATIONS = [
  {trail: 'assets[].path', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'directionReview.reviewPath', base: 'record', what: 'review', digestKey: null},
  {trail: 'directionReview.anatomySources[].path', base: 'repo', what: 'input', digestKey: 'sha256'},
];

export const RECEIPT_DECLARATIONS = [
  {trail: 'calls[].artifact', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'calls[].prompt', base: 'record', what: 'prompt', digestKey: 'promptSha256'},
  {trail: 'calls[].referencedImages[].path', base: 'repo', what: 'input', digestKey: 'sha256'},
];

export const MANIFEST_DECLARATIONS = [
  {trail: 'assets[].path', base: 'run', what: 'asset', digestKey: 'sha256'},
];

// A work/resource@1 is the only record whose declared files are repository paths: the seed SQL, the compose
// file and the sealed credential are what ops/uat.verify reads before a flow may run.
export const RESOURCE_DECLARATIONS = [
  {trail: 'target.compose', base: 'repo', what: 'input', digestKey: null},
  {trail: 'configuration.renderedFrom', base: 'repo', what: 'input', digestKey: null},
  {trail: 'configuration.rendered', base: 'repo', what: 'input', digestKey: null},
  {trail: 'schemaFiles[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'seedFiles[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'custody.sealed', base: 'repo', what: 'input', digestKey: null},
];

/** Where a declaration's relative path anchors: the app root, the run directory, the record named by the entry, or the record's own directory. */
function baseFor(ctx, rule, entry) {
  if (rule.base === 'repo') return {dir: ctx.repoRoot, name: 'the app root'};
  if (rule.base === 'run') return {dir: ctx.runDir ?? ctx.recordDir, name: `${slash(path.relative(ctx.workRoot, ctx.runDir ?? ctx.recordDir))} run dir`};
  if (rule.base === 'named-record') {
    // Compact format: a `record:` naming `P#frag` or a collapsed `ac.*` id resolves to the record
    // carrying the criterion - its dir is where the artifact's relative paths anchor.
    const named = entry?.record ? ctx.records.get(resolveRecordRef(ctx.records, entry.record, ctx.inline) ?? entry.record) : null;
    return named
      ? {dir: named.dir, name: `the ${entry.record} record's dir`}
      : {dir: ctx.recordDir, name: `${slash(path.relative(ctx.workRoot, ctx.recordDir))} node dir`};
  }
  return {dir: ctx.recordDir, name: `${slash(path.relative(ctx.workRoot, ctx.recordDir))} node dir`};
}

function resolveDeclared(ctx, rule, text, entry) {
  if (text.startsWith('examples/') || text.startsWith('knowledge/')) return {abs: path.join(root, text), base: 'the skill root'};
  if (text.startsWith('.starcistacks/')) return {abs: path.join(ctx.repoRoot, text), base: 'the app root'};
  const {dir, name} = baseFor(ctx, rule, entry);
  return {abs: path.join(dir, text), base: name};
}

function pushDeclared({found, ctx}, rule, trail, text, entry) {
  if (!looksLikeFilePath(text)) return;
  const {abs, base} = resolveDeclared(ctx, rule, text, entry);
  found.push({rule, trail, text, abs, base, entry, digest: rule.digestKey ? entry?.[rule.digestKey] ?? null : null});
}

const ruleAt = (table, trail) => table.find(candidate => trailMatches(candidate.trail, trail));

// Agent output (draw rounds, shell captures, lockups, superseded directions) is a blob citation
// {artifact?, name, sha256}, never a file on disk (work-layout.yaml): the same entry that would carry
// `<x>.path` may instead carry `name` + `sha256`, and that citation is verified against the blob store.
const citationAt = (citationTrails, node, trail) => !Array.isArray(node) && typeof node === 'object' && typeof node.path !== 'string'
  && typeof node.name === 'string' && citationTrails.some(pattern => trailMatches(pattern, trail));

function visitDeclarations(scan, node, trail) {
  if (node == null) return;
  if (citationAt(scan.citationTrails, node, trail)) {
    scan.found.push({rule: {trail: `${trail}.name`, what: 'asset', digestKey: 'sha256'}, trail, text: node.name, citation: true, entry: node, digest: node.sha256 ?? null});
    return;
  }
  if (Array.isArray(node)) { node.forEach(item => visitDeclarations(scan, item, `${trail}[]`)); return; }
  if (typeof node === 'string') {
    const rule = ruleAt(scan.table, trail);
    if (rule) pushDeclared(scan, rule, trail, node.trim(), null);
    return;
  }
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const childTrail = trail ? `${trail}.${key}` : key;
    const rule = ruleAt(scan.table, childTrail);
    if (rule && typeof value === 'string') pushDeclared(scan, rule, childTrail, value.trim(), node);
    else visitDeclarations(scan, value, childTrail);
  }
}

/**
 * Every declaration in one document that the tables name, resolved to an absolute path.
 * `ctx` carries the directories the bases can point at plus the records map (for a `named-record` base).
 * Resolution is value-first: a declaration that already names the tree from its root (`examples/...`,
 * `knowledge/...`, `.starcistacks/...` at the app root) is read from that root, because a path written out in full is its
 * own address. Only a short path (`assets/x.png`) needs the base its shape declares.
 */
export function declarationsOf(doc, table, ctx) {
  const citationTrails = table.filter(rule => rule.what === 'asset' && rule.trail.endsWith('.path')).map(rule => rule.trail.slice(0, -'.path'.length));
  const scan = {found: [], table, ctx, citationTrails};
  visitDeclarations(scan, doc, '');
  return scan.found;
}
