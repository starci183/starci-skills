#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {appRootOf, loadRecords, indexInlineCriteria} from '../record-ownership.mjs';
import {slash} from '../../lib/path-key.mjs';
import { repoRoot } from './work-consistency-shared.mjs';
import { trimTrailing } from './trailing-text.mjs';
import {exampleArtifactReadOptions, exampleWorkRoots} from '../../lib/example-refs.mjs'; import { isMain } from '../../lib/is-main.mjs'; import { byCodeUnit } from '../../lib/list.mjs';
import {verifyDeclaration,checkRunMedia,checkReceipt} from './work-artifact-verification.mjs';
import {declarationsOf, RECORD_DECLARATIONS, EVIDENCE_DECLARATIONS, RECEIPT_DECLARATIONS, MANIFEST_DECLARATIONS, RESOURCE_DECLARATIONS} from './work-artifact-declarations.mjs';

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

const root = repoRoot;
const relativeToRoot = file => slash(path.relative(root, file));

/**
 * The floor a real capture clears. Measured on the live trees, the smallest committed screenshot is
 * 10,186 bytes and the smallest committed webm recording 41,771 bytes, so both floors sit under every
 * genuine artifact and well above a stub, a truncation, or a file created only to satisfy a count.
 */

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

// ---- concept 4: a prompt is the generation's input claim, kept beside the raster ----
// Both trees keep `<asset>.prompt.txt` (or the `generation.promptPath` a record names) as the exact bytes
// sent to the tool. An empty one is a generation nobody can re-read. The paths quoted inside it are
// reported as SUSPECT, not REFUSE, because a prompt names files it tells the model not to copy as well as
// the ones it was fed; only lines that claim an input are mined for paths.
const PROMPT_INPUT_LINE = /(image\s*\d|reference image|anatomy source|edit target|brand authority|knowledge|input images)/i;
const PROMPT_PATH = /(?:examples|knowledge)\/[\w./[\]-]*/g;

function checkPromptFile(file, sink) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) {
    sink.refuse(file, 'PROMPT_EMPTY', 'a prompt file with no bytes in it - the generation it names cannot be re-read or re-run');
    return;
  }
  const quoted = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!PROMPT_INPUT_LINE.test(line)) continue;
    for (const match of line.matchAll(PROMPT_PATH)) quoted.add(trimTrailing(match[0], '.,;:)]'));
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

/** The prompt file a generated asset owes: the `generation.promptPath` it names, else `<asset>.prompt.txt` beside it. */
const expectedPromptOf = entry => (typeof entry.generation.promptPath === 'string' && entry.generation.promptPath.trim()
  ? entry.generation.promptPath.trim()
  : `${entry.path.replace(/\.[^.]+$/, '')}.prompt.txt`);

function checkGeneratedAssets(data, ctx, indexFile, state) {
  const entries = [...(Array.isArray(data.assets) ? data.assets : []), ...(Array.isArray(data.ui?.assets) ? data.ui.assets : [])]
    .filter(entry => entry && typeof entry === 'object' && typeof entry.path === 'string');
  for (const entry of entries) {
    if (!entry.generation) continue;
    state.counts.generatedAssets += 1;
    const expected = expectedPromptOf(entry);
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

/** A done feature/catalog parent is complete only when every record under it is done and its artifacts are the bytes on disk. */
function checkDoneParent(state, id, rec) {
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

function reportParentArtifactState(state) {
  let doneParents = 0;
  for (const [id, rec] of state.records) {
    if (!['work/feature@1', 'work/catalog@1'].includes(rec.schema) || rec.data?.state !== 'done') continue;
    doneParents += 1;
    checkDoneParent(state, id, rec);
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
