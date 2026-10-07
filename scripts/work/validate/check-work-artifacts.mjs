#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {parseYaml} from '../../../engine/yaml.mjs';
import {ID_RE, walk} from './check-example-work.mjs';
import {appRootOf, loadRecords, indexInlineCriteria, resolveRecordRef} from '../record-ownership.mjs';
import {slash} from '../../lib/path-key.mjs';
import {exampleArtifactReadOptions, exampleWorkRoots} from '../../lib/example-refs.mjs'; import { isMain } from '../../lib/is-main.mjs'; import { byCodeUnit } from '../../lib/list.mjs';
import {verifyDeclaration,checkRunMedia,checkReceipt} from './work-artifact-verification.mjs';

/**
 * Byte verification for Work declarations: file existence, size, media signatures
 * and stamped digests complement the structural checks of check-example-work.
 * Citations use the existing blob reader. An owned example selects its own
 * curated fixture CAS; missing bytes, invalid sidecars and incomplete bundles
 * refuse. Real projects retain their external-store read contract.
 *
 * REFUSE means deterministically wrong bytes; SUSPECT remains a prose heuristic;
 * INFO describes the checked coverage. A declared file is never proof by name.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const relativeToRoot = file => slash(path.relative(root, file));

/**
 * The floor a real capture clears. Measured on the live trees, the smallest committed screenshot is
 * 10,186 bytes and the smallest committed webm recording 41,771 bytes, so both floors sit under every
 * genuine artifact and well above a stub, a truncation, or a file created only to satisfy a count.
 */

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

const RECORD_DECLARATIONS = [
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

const EVIDENCE_DECLARATIONS = [
  {trail: 'assets[].path', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'directionReview.reviewPath', base: 'record', what: 'review', digestKey: null},
  {trail: 'directionReview.anatomySources[].path', base: 'repo', what: 'input', digestKey: 'sha256'},
];

const RECEIPT_DECLARATIONS = [
  {trail: 'calls[].artifact', base: 'record', what: 'asset', digestKey: 'sha256'},
  {trail: 'calls[].prompt', base: 'record', what: 'prompt', digestKey: 'promptSha256'},
  {trail: 'calls[].referencedImages[].path', base: 'repo', what: 'input', digestKey: 'sha256'},
];

const MANIFEST_DECLARATIONS = [
  {trail: 'assets[].path', base: 'run', what: 'asset', digestKey: 'sha256'},
];

// A work/resource@1 is the only record whose declared files are repository paths: the seed SQL, the compose
// file and the sealed credential are what ops/uat.verify reads before a flow may run.
const RESOURCE_DECLARATIONS = [
  {trail: 'target.compose', base: 'repo', what: 'input', digestKey: null},
  {trail: 'configuration.renderedFrom', base: 'repo', what: 'input', digestKey: null},
  {trail: 'configuration.rendered', base: 'repo', what: 'input', digestKey: null},
  {trail: 'schemaFiles[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'seedFiles[]', base: 'repo', what: 'input', digestKey: null},
  {trail: 'custody.sealed', base: 'repo', what: 'input', digestKey: null},
];

// The one place a sealed secret lives (owner 2026-09-29, corrected 2026-10-01): .starcistacks/<env>/secrets/<slug>.enc,
// a sops (age) file, by app-relative path: .starcistacks sits at the app root beside be/, fe/ and .starciwork, never under a
// side. The Work tree only holds the identity/resource record whose custody.sealed points there. The same shape is the
// schema pattern of custody.sealed in modules/schemas/work-resource.schema.yaml.
export const SEALED_LOCATION_RE = /^\.starcistacks\/[a-z0-9]+(?:-[a-z0-9]+)*\/secrets\/[a-z0-9]+(?:-[a-z0-9]+)*\.enc$/;
// A custody path under a side folder (be/.starcistacks/..., fe/.starcistacks/...): the side form, refused by name.
const SIDE_STACKS_RE = /^(?:be|fe)\/\.starcistacks\//;
/** Why `sealed` (a custody.sealed text) is not the one location, in words a finding carries; null when it is. */
export function sealedLocationProblem(sealed) {
  const text = typeof sealed === 'string' ? sealed.trim() : '';
  if (SEALED_LOCATION_RE.test(text)) return null;
  if (SIDE_STACKS_RE.test(text)) return `${text} sits under the ${text.split('/')[0]}/ side; .starcistacks lives only at the app root (.starcistacks/<env>/secrets/<slug>.enc)`;
  return `${text || '(empty)'} is not .starcistacks/<env>/secrets/<slug>.enc (app-relative)`;
}
// A sealed (sops) file kept inside the Work tree, in any of the retired spellings.
const SEALED_FILE_RE = /\.enc(?:\.ya?ml|\.json|\.env)?$|\.(?:ya?ml|json|env)\.enc$/i;

/**
 * Every declaration in one document that the tables name, resolved to an absolute path.
 * `ctx` carries the directories the bases can point at plus the records map (for a `named-record` base).
 * Resolution is value-first: a declaration that already names the tree from its root (`examples/...`,
 * `knowledge/...`, `.starcistacks/...` at the app root) is read from that root, because a path written out in full is its
 * own address. Only a short path (`assets/x.png`) needs the base its shape declares.
 */
function declarationsOf(doc, table, ctx) {
  const found = [];
  const baseFor = (rule, entry) => {
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
  };
  const resolve = (rule, text, entry) => {
    if (text.startsWith('examples/') || text.startsWith('knowledge/')) return {abs: path.join(root, text), base: 'the skill root'};
    if (text.startsWith('.starcistacks/')) return {abs: path.join(ctx.repoRoot, text), base: 'the app root'};
    const {dir, name} = baseFor(rule, entry);
    return {abs: path.join(dir, text), base: name};
  };
  const push = (rule, trail, text, entry) => {
    if (!looksLikeFilePath(text)) return;
    const {abs, base} = resolve(rule, text, entry);
    found.push({rule, trail, text, abs, base, entry, digest: rule.digestKey ? entry?.[rule.digestKey] ?? null : null});
  };
  // Agent output (draw rounds, shell captures, lockups, superseded directions) is a blob citation
  // {artifact?, name, sha256}, never a file on disk (work-layout.yaml): the same entry that would carry
  // `<x>.path` may instead carry `name` + `sha256`, and that citation is verified against the blob store.
  const citationTrails = table.filter(rule => rule.what === 'asset' && rule.trail.endsWith('.path')).map(rule => rule.trail.slice(0, -'.path'.length));
  const citationAt = (node, trail) => !Array.isArray(node) && typeof node === 'object' && typeof node.path !== 'string'
    && typeof node.name === 'string' && citationTrails.some(pattern => trailMatches(pattern, trail));
  const visit = (node, trail) => {
    if (node == null) return;
    if (citationAt(node, trail)) {
      found.push({rule: {trail: `${trail}.name`, what: 'asset', digestKey: 'sha256'}, trail, text: node.name, citation: true, entry: node, digest: node.sha256 ?? null});
      return;
    }
    if (Array.isArray(node)) return node.forEach(item => visit(item, `${trail}[]`));
    if (typeof node === 'string') {
      const rule = table.find(candidate => trailMatches(candidate.trail, trail));
      if (rule) push(rule, trail, node.trim(), null);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const childTrail = trail ? `${trail}.${key}` : key;
      const rule = table.find(candidate => trailMatches(candidate.trail, childTrail));
      if (rule && typeof value === 'string') push(rule, childTrail, value.trim(), node);
      else visit(value, childTrail);
    }
  };
  visit(doc, '');
  return found;
}

// ---- concept 4: a prompt is the generation's input claim, kept beside the raster ----
// Both trees keep `<asset>.prompt.txt` (or the `generation.promptPath` a record names) as the exact bytes
// sent to the tool. An empty one is a generation nobody can re-read. The paths quoted inside it are
// reported as SUSPECT, not REFUSE, because a prompt names files it tells the model not to copy as well as
// the ones it was fed; only lines that claim an input are mined for paths.
const PROMPT_INPUT_LINE = /(image\s*\d|reference image|anatomy source|edit target|brand authority|knowledge|input images)/i;
const PROMPT_PATH = /(?:examples|knowledge)\/[\w./\[\]-]*/g;

function checkPromptFile(file, sink) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) {
    sink.refuse(file, 'PROMPT_EMPTY', 'a prompt file with no bytes in it - the generation it names cannot be re-read or re-run');
    return;
  }
  const quoted = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!PROMPT_INPUT_LINE.test(line)) continue;
    for (const match of line.matchAll(PROMPT_PATH)) quoted.add(match[0].replace(/[.,;:)\]]+$/, ''));
  }
  const missing = [...quoted].filter(token => !fs.existsSync(path.join(root, token)));
  if (missing.length) {
    sink.suspect(file, 'PROMPT_INPUT_GHOST', `the prompt names ${missing.length} input path(s) that are not on disk (${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ', ...' : ''}) - the generation claims references the Work tree does not keep`);
  }
}

function readEvidenceDocuments(state) {
  const evidenceByDir = new Map();
  for (const file of state.canonicalWalk(state.workRoot).filter(candidate => candidate.endsWith('evidence.yaml'))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (doc && typeof doc === 'object') evidenceByDir.set(path.dirname(file), {doc, file});
  }
  const settledRuns = new Set();
  for (const [dir, {doc}] of evidenceByDir) {
    if (typeof doc.run === 'string' && doc.run.trim()) settledRuns.add(path.resolve(dir, doc.run.trim()));
  }
  state.evidenceByDir = evidenceByDir;
  state.settledRuns = settledRuns;
  state.sweptRuns = new Set();
  state.scanRun = runDir => {
    const resolved = path.resolve(runDir);
    if (state.sweptRuns.has(resolved)) return false;
    state.sweptRuns.add(resolved);
    checkRunMedia(runDir, settledRuns.has(resolved), state.wrapped, state.counts, walk);
    return true;
  };
}

function reportSealedFiles(state) {
  for (const file of state.canonicalWalk(state.workRoot)) {
    if (SEALED_FILE_RE.test(path.basename(file))) {
      state.wrapped.refuse(file, 'SEALED_FILE_IN_WORK', `a sealed secret file is kept under the Work tree; move it to .starcistacks/<env>/secrets/<slug>.enc at the app root and point custody.sealed at it`);
    }
  }
}

function reportRecordCustody(data, indexFile, wrapped) {
  const custody = data.schema === 'work/resource@1' && data.custody && typeof data.custody === 'object' ? data.custody : null;
  const sealed = custody?.sealed;
  // provider: none is the one "holds no secret" form and carries no sealed key; every other provider names its file.
  const misplaced = Boolean(custody) && (custody.provider === 'none' ? sealed !== undefined : typeof sealed !== 'string' || !SEALED_LOCATION_RE.test(sealed.trim()));
  if (!misplaced) return false;
  const why = custody.provider === 'none' || typeof sealed !== 'string' ? null : sealedLocationProblem(sealed);
  wrapped.refuse(indexFile, 'SEALED_CUSTODY_LOCATION', `custody.sealed is ${sealed === undefined ? 'absent' : JSON.stringify(sealed)}${custody.provider === 'none' ? ' on a provider: none identity, which holds no secret and carries no sealed key;' : '; ' + (why && why + '; ' || '') + 'a sealed secret lives only at .starcistacks/<env>/secrets/<slug>.enc (app-relative) and'} the record here names it`);
  return true;
}

function checkRecordDeclarations(data, table, ctx, indexFile, sealedMisplaced, state) {
  for (const found of declarationsOf(data, table, ctx)) {
    if (sealedMisplaced && found.trail === 'custody.sealed') continue;
    if (found.digest) state.counts.digests += 1;
    verifyDeclaration(found, indexFile, ctx, state.wrapped, state.counts);
  }
}

function checkGeneratedAssets(data, ctx, indexFile, state) {
  const entries = [...(Array.isArray(data.assets) ? data.assets : []), ...(Array.isArray(data.ui?.assets) ? data.ui.assets : [])]
    .filter(entry => entry && typeof entry === 'object' && typeof entry.path === 'string');
  for (const entry of entries) {
    if (!entry.generation) continue;
    state.counts.generatedAssets += 1;
    const expected = typeof entry.generation.promptPath === 'string' && entry.generation.promptPath.trim()
      ? entry.generation.promptPath.trim()
      : `${entry.path.replace(/\.[^.]+$/, '')}.prompt.txt`;
    if (!fs.existsSync(path.join(ctx.recordDir, expected))) {
      state.wrapped.refuse(indexFile, 'PROMPT_MISSING', `${entry.path} carries a generation but ${expected} is not beside it - a direction with no prompt is not a re-runnable generation`);
    }
    // The tool's own output name is provenance of a rename (concept 5); the extension must still agree.
    const kept = path.extname(entry.path).toLowerCase();
    const produced = path.extname(String(entry.provenance?.toolOutputBasename ?? '')).toLowerCase();
    if (produced && produced !== kept) {
      state.wrapped.refuse(indexFile, 'ASSET_MAGIC', `${entry.path} is kept as ${kept} but its provenance says the tool produced ${entry.provenance.toolOutputBasename} - one of the two names is not this artifact's`);
    }
  }
}

function checkAccountsFile(rec, data, indexFile, state) {
  if (data.schema !== 'work/uat-flow@1' || !data.accounts) return;
  state.counts.accountsFiles += 1;
  if (!fs.existsSync(path.join(rec.dir, String(data.accounts).trim()))) {
    state.wrapped.refuse(indexFile, 'RESOURCE_FILE_MISSING', `accounts: ${data.accounts} names a file that is not beside the flow - the base gate opens it only if existsSync, so its absence passes there`);
  }
}

function scanRecordArtifacts(state, rec) {
  const data = rec.data ?? {};
  if (typeof data.schema === 'string' && !data.schema.startsWith('work/')) return;
  const indexFile = path.join(rec.dir, 'index.yaml');
  const ctx = state.ctxFor(rec.dir);
  const table = data.schema === 'work/resource@1' ? RESOURCE_DECLARATIONS : RECORD_DECLARATIONS;
  const misplaced = reportRecordCustody(data, indexFile, state.wrapped);
  checkRecordDeclarations(data, table, ctx, indexFile, misplaced, state);
  checkGeneratedAssets(data, ctx, indexFile, state);
  checkAccountsFile(rec, data, indexFile, state);
}

function scanEvidenceArtifacts(state) {
  for (const [dir, {doc, file}] of state.evidenceByDir) {
    const ctx = state.ctxFor(dir);
    for (const found of declarationsOf(doc, EVIDENCE_DECLARATIONS, ctx)) {
      if (found.digest) state.counts.digests += 1;
      verifyDeclaration(found, file, ctx, state.wrapped, state.counts);
    }
    if (typeof doc.run !== 'string' || !doc.run.trim()) continue;
    state.counts.runs += 1;
    const runDir = path.resolve(dir, doc.run.trim());
    if (!fs.existsSync(runDir) || !fs.lstatSync(runDir).isDirectory()) {
      state.wrapped.refuse(file, 'EVIDENCE_ARTIFACT_GHOST', `run: ${doc.run} names a run directory that is not on disk - the run this evidence settled on does not exist`);
      continue;
    }
    state.scanRun(runDir);
  }
}

function scanManifestArtifacts(state) {
  for (const file of state.canonicalWalk(state.workRoot).filter(candidate => candidate.endsWith('manifest.yaml'))) {
    const runDir = path.dirname(file);
    state.counts.runs += 1;
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const ctx = {...state.ctxFor(state.ownerDirOf(file) ?? runDir), runDir};
    for (const found of declarationsOf(doc, MANIFEST_DECLARATIONS, ctx)) {
      if (found.digest) state.counts.digests += 1;
      verifyDeclaration(found, file, ctx, state.wrapped, state.counts);
    }
    state.scanRun(runDir);
  }
}

function scanReceiptAndPromptFiles(state) {
  for (const file of state.canonicalWalk(state.workRoot).filter(candidate => candidate.endsWith('generation-receipts.yaml'))) {
    state.counts.receipts += 1;
    checkReceipt(file, state.ctxFor(path.dirname(path.dirname(file))), state.wrapped, state.counts,
      {declarationsOf, receiptDeclarations: RECEIPT_DECLARATIONS});
  }
  for (const file of state.canonicalWalk(state.workRoot).filter(candidate => candidate.endsWith('.prompt.txt'))) {
    state.counts.prompts += 1;
    checkPromptFile(file, state.wrapped);
  }
}

function reportParentArtifactState(state) {
  let doneParents = 0;
  for (const [id, rec] of state.records) {
    if (!['work/feature@1', 'work/catalog@1'].includes(rec.schema) || rec.data?.state !== 'done') continue;
    doneParents += 1;
    const members = [...state.records.entries()]
      .filter(([, other]) => other !== rec && !path.relative(rec.dir, other.dir).startsWith('..'));
    const notDone = members.filter(([, other]) => other.data?.state !== 'done');
    if (notDone.length) {
      const named = notDone.slice(0, 3).map(([memberId, member]) => `${memberId}=${member.data?.state ?? '(no state)'}`).join(', ');
      const preview = `${named}${notDone.length > 3 ? ', ...' : ''}`;
      state.wrapped.refuse(path.join(rec.dir, 'index.yaml'), 'FEATURE_DONE_INCOMPLETE',
        `${id} is done while ${notDone.length} member record(s) are not (${preview}) - a parent is done only once the records under it are`);
    }
    for (const [memberId, member] of members) {
      if (state.failedDirs.has(member.dir)) {
        state.wrapped.refuse(path.join(rec.dir, 'index.yaml'), 'FEATURE_DONE_INCOMPLETE',
          `${id} is done while ${memberId}'s declared artifacts are not the bytes on disk`);
      }
    }
  }
  const parents = [...state.records.values()].filter(rec => ['work/feature@1', 'work/catalog@1'].includes(rec.schema)).length;
  const latent = parents && !doneParents ? ', so the rule is latent here today' : '';
  state.emit.info(path.join(state.workRoot, 'index.yaml'), 'PARENT_STATE_UNUSED',
    `${parents} feature/catalog record(s) in this tree, ${doneParents} claiming done - FEATURE_DONE_INCOMPLETE can only fire on a parent that claims done${latent}`);
}

function reportArtifactCensus(state) {
  const stampedCodeDigests = [...state.evidenceByDir.values()].filter(({doc}) => doc.codeDigest).length;
  state.emit.info(path.join(state.workRoot, 'index.yaml'), 'BYTE_CENSUS',
    `${state.counts.declarations} declared path(s) resolved, ${state.counts.filesOpened} of them opened on disk and ${state.counts.digestsCompared} hash-compared against a stamped sha256 (${state.counts.digests} declarations carried one);`
    + ` ${state.sweptRuns.size} run folder(s) read for media magic and size (${state.counts.mediaFiles} files);`
    + ` ${state.counts.prompts} prompt file(s) read; ${state.counts.generatedAssets} generated asset(s) owed a prompt;`
    + ` ${state.counts.receipts} receipt file(s) binding ${state.counts.receiptCalls} generation call(s);`
    + ` ${state.counts.accountsFiles} uat accounts file(s) looked for`);
  state.emit.info(path.join(state.workRoot, 'index.yaml'), 'CODE_DIGEST_NOT_MINE',
    `${stampedCodeDigests} of ${state.evidenceByDir.size} evidence file(s) here also stamp a codeDigest over code; those bytes are re-hashed by check-example-work.mjs (CODE_DIGEST_STALE), so this script does not repeat that measurement`);
}

/**
 * Every artifact declaration in one `.starciwork` tree, checked against the bytes under it. `out` is
 * `{refuse, suspect, info}` arrays of `file: message [CODE]`, the shape check-work-deep prints and the
 * CLI reads. Exported so the fixture test can point it at a throwaway tree instead of the real trees.
 */
export function checkWorkArtifacts(workRoot, out, { runtimeRoot = root } = {}) {
  out ??= {refuse: [], suspect: [], info: []};
  const emit = {
    refuse: (file, code, msg) => out.refuse.push(relativeToRoot(file) + ': ' + msg + ' [' + code + ']'),
    suspect: (file, code, msg) => out.suspect.push(relativeToRoot(file) + ': ' + msg + ' [' + code + ']'),
    info: (file, code, msg) => out.info.push(relativeToRoot(file) + ': ' + msg + ' [' + code + ']'),
  };
  const custodyRoots = new Set(['kernel-evidence', 'kernel-strays', 'kernel-approvals', '_derived']);
  const canonicalWalk = start => walk(start).filter(file => {
    const relative = slash(path.relative(workRoot, file));
    return !custodyRoots.has(relative.split('/')[0]);
  });
  const records = loadRecords(workRoot, canonicalWalk);
  const appRoot = appRootOf(workRoot);
  const counts = {declarations: 0, digests: 0, digestsCompared: 0, filesOpened: 0, generatedAssets: 0,
    prompts: 0, runs: 0, receipts: 0, mediaFiles: 0, receiptCalls: 0, accountsFiles: 0};
  const ownerDirOf = file => {
    let deepest = null;
    for (const rec of records.values()) {
      if (!path.relative(rec.dir, file).startsWith('..') && (!deepest || rec.dir.length > deepest.length)) deepest = rec.dir;
    }
    return deepest;
  };
  const failedDirs = new Set();
  const markFailure = file => { const dir = ownerDirOf(file); if (dir) failedDirs.add(dir); };
  const wrapped = {
    refuse: (file, code, msg) => {
      if (/ASSET|PROMPT|RECEIPT|RUN_MEDIA|RESOURCE_FILE|EVIDENCE_ARTIFACT/.test(code)) markFailure(file);
      emit.refuse(file, code, msg);
    },
    suspect: (file, code, msg) => emit.suspect(file, code, msg),
    info: (file, code, msg) => emit.info(file, code, msg),
  };
  const inline = indexInlineCriteria(records);
  let blobOptions;
  try {
    blobOptions = exampleArtifactReadOptions(runtimeRoot, workRoot);
  } catch (error) {
    emit.refuse(path.join(workRoot, 'index.yaml'), 'ASSET_ROOT', 'artifact read context cannot be established: ' + error.message);
    return {...counts, records: records.size, evidence: 0};
  }
  const ctxFor = recordDir => ({workRoot, records, inline, recordDir, repoRoot: appRoot, ownerDirOf, blobOptions});
  const state = {workRoot, emit, canonicalWalk, records, appRoot, counts, ownerDirOf, failedDirs, wrapped, ctxFor};
  readEvidenceDocuments(state);
  reportSealedFiles(state);
  for (const rec of records.values()) scanRecordArtifacts(state, rec);
  scanEvidenceArtifacts(state);
  scanManifestArtifacts(state);
  scanReceiptAndPromptFiles(state);
  reportParentArtifactState(state);
  reportArtifactCensus(state);
  return {...counts, records: records.size, evidence: state.evidenceByDir.size};
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : exampleWorkRoots(root);
  const out = {refuse: [], suspect: [], info: []};
  const totals = {declarations: 0, digests: 0, digestsCompared: 0, filesOpened: 0, generatedAssets: 0,
    prompts: 0, runs: 0, receipts: 0, mediaFiles: 0, receiptCalls: 0, accountsFiles: 0, records: 0, evidence: 0};
  for (const workRoot of trees) {
    const counts = checkWorkArtifacts(workRoot, out);
    for (const key of Object.keys(totals)) totals[key] += counts[key] ?? 0;
  }
  // Sorted within each tier: two runs over an unchanged tree are then byte-identical, which is what makes a
  // diff across a lane's writes (or across concurrent lanes) mean something.
  const sorted = lines => [...lines].sort(byCodeUnit);
  for (const line of sorted(out.refuse)) console.log(`REFUSE  ${line}`);
  for (const line of sorted(out.suspect)) console.log(`SUSPECT ${line}`);
  for (const line of sorted(out.info)) console.log(`INFO    ${line}`);
  const byCode = new Map();
  for (const line of [...out.refuse, ...out.suspect]) {
    const code = /\[([A-Z0-9_]+)\]$/.exec(line)?.[1] ?? '(uncoded)';
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
  }
  const surveyed = `${totals.declarations} declared path(s) (${totals.filesOpened} opened on disk, `
    + `${totals.digestsCompared} hash-compared against a stamped sha256), ${totals.mediaFiles} run media file(s) `
    + `read across ${totals.runs} run declaration(s), ${totals.prompts} prompt file(s), `
    + `${totals.receipts} receipt file(s) binding ${totals.receiptCalls} call(s), ${totals.evidence} evidence file(s)`;
  const verdict = `${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`;
  console.log(`\n${totals.records} record(s) over ${trees.length} tree(s): ${surveyed} - ${verdict}`);
  if (byCode.size) console.log(`findings by code: ${[...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => code + '=' + n).join(', ')}`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
