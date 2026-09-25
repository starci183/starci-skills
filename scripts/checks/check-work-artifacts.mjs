#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {ID_RE, walk} from './check-example-work.mjs';
import {readWorkspace, repoRootFor, loadRecords, indexInlineCriteria, resolveRecordRef} from '../example/example-ownership.mjs';

/**
 * The gate verifies declarations, not bytes. check-example-work.mjs asks whether a done uat-flow has a
 * `runs/<id>/videos/` that is not empty, and whether a ui record names a generation tool - and a 0-byte
 * file renamed `.webm` answers both yes, because `readdirSync().length > 0` counts names. A
 * `ui.assets[].path` line is never opened at all, so the PNG it names may simply not be there.
 * `accounts.yaml` is read `if existsSync` (concept 13's last branch), which makes the file's absence a
 * silent pass rather than a finding. Those are three ways to record a proof that has no bytes behind it.
 *
 * This script is the byte layer: every artifact a record, an evidence file, a generation receipt or a run
 * manifest declares must exist, must be non-empty, must carry the magic bytes its extension claims, and -
 * where the declaration also stamps a sha256 - must still be the exact bytes that were hashed. A renamed
 * fake (an empty file called `.webm`) and a re-captured artifact whose record was never re-stamped are the
 * two shapes that read as proven and are not.
 *
 * Severity follows check-work-deep's discipline, because a check that cries wolf gets ignored:
 *   REFUSE  - deterministically wrong about the bytes that are on disk right now
 *   SUSPECT - a heuristic over prose (a path quoted inside a prompt text may be named, not supplied)
 *   INFO    - what a rule did not get to look at on this tree, so a clean run stays explainable
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const slash = value => String(value ?? '').replaceAll('\\', '/');
const relativeToRoot = file => slash(path.relative(root, file));

/**
 * The floor a real capture clears. Measured on the live trees, the smallest committed screenshot is
 * 10,186 bytes and the smallest committed webm recording 41,771 bytes, so both floors sit under every
 * genuine artifact and well above a stub, a truncation, or a file created only to satisfy a count.
 */
const MIN_VIDEO_BYTES = 10_000;
const MIN_SCREEN_BYTES = 5_000;

// ---- concept 1: an extension is a claim about bytes, and the first bytes answer it ----
// This is checked before size or digest because it is the cheapest thing that can prove an artifact is not
// a placeholder, and because it is the only check that catches a file whose bytes were swapped for others
// of the same length.
const SIGNATURES = [
  {ext: '.png', name: 'PNG', starts: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])},
  {ext: '.jpg', name: 'JPEG', starts: Buffer.from([0xff, 0xd8])},
  {ext: '.jpeg', name: 'JPEG', starts: Buffer.from([0xff, 0xd8])},
  {ext: '.webp', name: 'RIFF/WEBP', starts: Buffer.from('RIFF', 'ascii'), tagAt: 8, tag: 'WEBP'},
  {ext: '.gif', name: 'GIF8', starts: Buffer.from('GIF8', 'latin1')},
  {ext: '.webm', name: 'Matroska/WebM (EBML)', starts: Buffer.from([0x1a, 0x45, 0xdf, 0xa3])},
  {ext: '.mp4', name: 'ISO base-media ftyp box', boxTag: 'ftyp'},
];

const HEAD_BYTES = 64;

/** The first bytes of a file, without pulling a multi-megabyte raster into memory to look at them. */
function headOf(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(Math.min(HEAD_BYTES, size));
    return head.subarray(0, fs.readSync(fd, head, 0, head.length, 0));
  } finally { fs.closeSync(fd); }
}

/** Why the bytes do not answer the extension, in one clause; null when the signature holds or is unknown. */
function signatureProblem(file, head) {
  const ext = path.extname(file).toLowerCase();
  const expected = SIGNATURES.find(entry => entry.ext === ext);
  if (!expected) return null;
  if (expected.boxTag) {
    const seen = head.subarray(4, 8).toString('latin1');
    if (seen === expected.boxTag) return null;
    return `bytes 4-7 open an "${seen || '(too short)'}" box where a ${ext} file must carry ${expected.boxTag}`;
  }
  const prefix = head.subarray(0, expected.starts.length);
  const tagOk = !expected.tag || head.subarray(expected.tagAt, expected.tagAt + 4).toString('ascii') === expected.tag;
  if (prefix.equals(expected.starts) && tagOk) return null;
  const asText = slash(head.subarray(0, 24).toString('utf8')).replace(/[^\x20-\x7e./]/g, '.');
  return `its first bytes are ${prefix.toString('hex')}${head.length ? ` ("${asText}")` : ' - the file is empty'}, not ${expected.name} (${expected.starts.toString('hex')})`;
}

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

/**
 * Every declaration in one document that the tables name, resolved to an absolute path.
 * `ctx` carries the directories the bases can point at plus the records map (for a `named-record` base).
 * Resolution is value-first: a declaration that already names the tree from its root (`examples/...`,
 * `knowledge/...`, `.starcistacks/...`) is read from that root, because a path written out in full is its
 * own address. Only a short path (`assets/x.png`) needs the base its shape declares.
 */
function declarationsOf(doc, table, ctx) {
  const found = [];
  const baseFor = (rule, entry) => {
    if (rule.base === 'repo') return {dir: ctx.repoRoot, name: `${path.basename(ctx.repoRoot)} repository root`};
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
    if (text.startsWith('.starcistacks/')) return {abs: path.join(ctx.repoRoot, text), base: `${path.basename(ctx.repoRoot)} repository root`};
    const {dir, name} = baseFor(rule, entry);
    return {abs: path.join(dir, text), base: name};
  };
  const push = (rule, trail, text, entry) => {
    if (!looksLikeFilePath(text)) return;
    const {abs, base} = resolve(rule, text, entry);
    found.push({rule, trail, text, abs, base, entry, digest: rule.digestKey ? entry?.[rule.digestKey] ?? null : null});
  };
  const visit = (node, trail) => {
    if (node == null) return;
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

/**
 * One declaration against the disk: exists, is a file, is not a placeholder, opens with the bytes its
 * extension claims, and hashes to what was stamped on it. Order is deliberate - each later test assumes
 * the one before it, and the first failure is the one worth reading.
 */
function verifyDeclaration(found, docFile, ctx, sink, seen) {
  const {rule, text, abs} = found;
  const named = `${rule.what === 'asset' ? 'artifact' : rule.what} ${text}`;
  if (seen) seen.declarations += 1;
  if (!fs.existsSync(abs)) {
    const message = `${rule.trail} names ${named}, which is not on disk under ${found.base}`;
    if (rule.what === 'input') sink.suspect(docFile, 'EVIDENCE_ARTIFACT_GHOST', `${message} - a declared input the Work tree does not keep`);
    else sink.refuse(docFile, 'ASSET_MISSING', `${message} - declared bytes are not there`);
    return;
  }
  if (!fs.lstatSync(abs).isFile()) {
    sink.refuse(docFile, 'ASSET_MISSING', `${rule.trail} names ${named}, which is not a regular file`);
    return;
  }
  const size = fs.statSync(abs).size;
  if (seen) seen.filesOpened += 1;
  if (size === 0) {
    sink.refuse(docFile, 'ASSET_EMPTY', `${rule.trail} names ${named}, which exists as a 0-byte placeholder`);
    return;
  }
  const signature = signatureProblem(abs, headOf(abs, size));
  if (signature) {
    sink.refuse(docFile, 'ASSET_MAGIC', `${rule.trail} names ${named}, but ${signature}`);
    return;
  }
  if (found.digest == null) return;
  const stamped = typeof found.digest === 'string' ? found.digest.trim() : String(found.digest);
  if (!/^[0-9a-f]{64}$/.test(stamped.toLowerCase())) {
    sink.refuse(docFile, 'ASSET_STAMP', `${rule.trail} stamps ${named} as ${JSON.stringify(found.digest)}, which is not a sha256 - there is nothing to verify the bytes against`);
    return;
  }
  if (seen) seen.digestsCompared += 1;
  const actual = sha256File(abs);
  if (actual === stamped.toLowerCase()) return;
  const moved = `${rule.trail} stamps ${named} as ${stamped}, but the ${size} bytes on disk hash to ${actual}`;
  if (rule.what === 'input') {
    sink.suspect(docFile, 'INPUT_BYTES_MOVED', `${moved} - what this artifact was drawn from is not what its provenance says it was`);
  } else {
    sink.refuse(docFile, 'ASSET_DIGEST', `${moved} - the bytes on disk are not the bytes this declaration names`);
  }
}

/**
 * concept 3: the run layer. A run folder is produced by the harness and then *settled on* by one evidence
 * file. Only the settled run carries the claim a done record rests on, so the size floor is refused there
 * and only suspected elsewhere; magic bytes and declared-asset existence hold in every run, because a
 * placeholder is a placeholder whatever attempt it sits under.
 */
function checkRunMedia(runDir, settled, sink, seen) {
  const filesIn = dir => fs.existsSync(dir) && fs.lstatSync(dir).isDirectory() ? walk(dir) : [];
  const groups = [['videos', filesIn(path.join(runDir, 'videos')), MIN_VIDEO_BYTES, 'video'],
    ['screens', filesIn(path.join(runDir, 'screens')), MIN_SCREEN_BYTES, 'screenshot']];
  for (const [folder, files, floor, kind] of groups) {
    for (const file of files) {
      if (seen) seen.mediaFiles += 1;
      const size = fs.statSync(file).size;
      if (!size) {
        sink.refuse(file, 'ASSET_EMPTY', `${folder}/ keeps a 0-byte ${kind} - a name in a list is not a ${kind}`);
        continue;
      }
      const problem = signatureProblem(file, headOf(file, size));
      if (problem) sink.refuse(file, 'ASSET_MAGIC', `${folder}/ keeps a ${kind} that is not one: ${problem}`);
      if (size >= floor) continue;
      const message = `${folder}/${path.basename(file)} is ${size}B, under the ${floor}B floor a real ${kind} clears`;
      if (settled) sink.refuse(file, 'RUN_MEDIA_FAKE', `${message} - this is the run the evidence settled on, so its proof cannot hold`);
      else sink.suspect(file, 'RUN_MEDIA_FAKE', `${message} - a stub kept in an unsettled run`);
    }
  }
}

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
    for (const match of line.matchAll(PROMPT_PATH)) quoted.add(match[0].replace(/[.,;:)\]]+$/, ''));
  }
  const missing = [...quoted].filter(token => !fs.existsSync(path.join(root, token)));
  if (missing.length) {
    sink.suspect(file, 'PROMPT_INPUT_GHOST', `the prompt names ${missing.length} input path(s) that are not on disk (${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ', ...' : ''}) - the generation claims references the Work tree does not keep`);
  }
}

// ---- concept 5: a receipt must bind the bytes it says it copied ----
// `toolOutputBasename` is the name the image tool gave its own output (`exec-<uuid>.png`). Both trees copy
// those bytes into `assets/<asset>.png` and record `postProcessing: None`, so the basename is provenance of
// a rename and never a file the custody keeps - on the live trees, 0 of the 12 basenames exist anywhere
// under examples/. Refusing that would be a wolf cry with a 100% false-positive rate, so what is refused is
// the claim that can be checked: the artifact and prompt the receipt names must be on disk and must be the
// bytes it hashed, and the basename's extension must agree with the artifact it was renamed into. A
// receipt that says the tool wrote `.png` while the record keeps a `.webm` is the renamed-fake shape.
function checkReceipt(receiptFile, ctx, sink, seen) {
  const doc = parseYaml(fs.readFileSync(receiptFile, 'utf8'));
  if (!doc || typeof doc !== 'object') return;
  const receiptCtx = {...ctx, recordDir: ctx.ownerDirOf(receiptFile) ?? path.dirname(path.dirname(receiptFile))};
  for (const found of declarationsOf(doc, RECEIPT_DECLARATIONS, receiptCtx)) {
    if (found.digest && seen) seen.digests += 1;
    verifyDeclaration(found, receiptFile, receiptCtx, sink, seen);
  }
  const calls = Array.isArray(doc.calls) ? doc.calls : [];
  if (seen) seen.receiptCalls += calls.length;
  for (const call of calls) {
    const basename = typeof call?.toolOutputBasename === 'string' ? call.toolOutputBasename.trim() : '';
    if (!basename) {
      if (call?.artifact) sink.suspect(receiptFile, 'RECEIPT_ORPHAN', `a call names artifact ${call.artifact} with no toolOutputBasename - the copy step is unattributed`);
      continue;
    }
    const from = path.extname(basename).toLowerCase();
    const to = path.extname(String(call?.artifact ?? '')).toLowerCase();
    if (to && from !== to) {
      sink.refuse(receiptFile, 'RECEIPT_ORPHAN', `the tool produced ${basename} and the record kept ${call.artifact} - ${from} bytes renamed to ${to} are not the same artifact`);
    }
  }
}

/**
 * Every artifact declaration in one `.starciwork` tree, checked against the bytes under it. `out` is
 * `{refuse, suspect, info}` arrays of `file: message [CODE]`, the shape check-work-deep prints and the
 * CLI reads. Exported so the fixture test can point it at a throwaway tree instead of the real trees.
 */
export function checkWorkArtifacts(workRoot, out = {refuse: [], suspect: [], info: []}) {
  const emit = {
    refuse: (file, code, msg) => out.refuse.push(`${relativeToRoot(file)}: ${msg} [${code}]`),
    suspect: (file, code, msg) => out.suspect.push(`${relativeToRoot(file)}: ${msg} [${code}]`),
    info: (file, code, msg) => out.info.push(`${relativeToRoot(file)}: ${msg} [${code}]`),
  };

  const custodyRoots = new Set(['kernel-evidence', 'kernel-strays', 'kernel-approvals', '_derived']);
  const canonicalWalk = start => walk(start).filter(file => {
    const relative = slash(path.relative(workRoot, file));
    return !custodyRoots.has(relative.split('/')[0]);
  });
  const records = loadRecords(workRoot, canonicalWalk);
  const workspaceDoc = readWorkspace(workRoot);
  const backendRoot = path.dirname(workRoot);
  // `counts` is what the script looked at, not only what it flagged: the CLI prints it so a clean code can
  // say how many candidates were opened and found whole, the way scripts/checks/check-example-work.mjs's summary does.
  const counts = {declarations: 0, digests: 0, digestsCompared: 0, filesOpened: 0, generatedAssets: 0,
    prompts: 0, runs: 0, receipts: 0, mediaFiles: 0, receiptCalls: 0, accountsFiles: 0};

  /** The record directory an artifact file under the tree belongs to (receipts sit one level deeper). */
  const ownerDirOf = file => {
    let deepest = null;
    for (const rec of records.values()) {
      if (!path.relative(rec.dir, file).startsWith('..') && (!deepest || rec.dir.length > deepest.length)) deepest = rec.dir;
    }
    return deepest;
  };
  /** A record's dirs share one failure set with its evidence/receipts, so a parent can see the member. */
  const failedDirs = new Set();
  const markFailure = file => { const dir = ownerDirOf(file); if (dir) failedDirs.add(dir); };
  const wrapped = {
    refuse: (file, code, msg) => { if (/ASSET|PROMPT|RECEIPT|RUN_MEDIA|RESOURCE_FILE|EVIDENCE_ARTIFACT/.test(code)) markFailure(file); emit.refuse(file, code, msg); },
    suspect: (file, code, msg) => emit.suspect(file, code, msg),
    info: (file, code, msg) => emit.info(file, code, msg),
  };
  const inline = indexInlineCriteria(records);
  const ctxFor = recordDir => ({workRoot, records, inline, recordDir, repoRoot: backendRoot, ownerDirOf});

  // evidence docs by the record directory beside them; the run each one settles on is a claim in bytes
  const evidenceByDir = new Map();
  for (const file of canonicalWalk(workRoot).filter(f => f.endsWith('evidence.yaml'))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (doc && typeof doc === 'object') evidenceByDir.set(path.dirname(file), {doc, file});
  }
  const settledRuns = new Set();
  for (const [dir, {doc}] of evidenceByDir) {
    if (typeof doc.run === 'string' && doc.run.trim()) settledRuns.add(path.resolve(dir, doc.run.trim()));
  }
  /**
   * Each run folder is opened for its media exactly once, and its settled-ness is read from the evidence set
   * rather than from the pass that reached it first: the run a record settled on also carries a manifest.yaml,
   * so an un-deduplicated sweep would report the same stub video twice, once refused and once suspected.
   */
  const sweptRuns = new Set();
  const scanRun = runDir => {
    const resolved = path.resolve(runDir);
    if (sweptRuns.has(resolved)) return false;
    sweptRuns.add(resolved);
    checkRunMedia(runDir, settledRuns.has(resolved), wrapped, counts);
    return true;
  };

  // ---- records: their own declarations, plus the prompt beside every generated asset ----
  // A run manifest and a payload that travels inside assets/ carry an `id`/`schema` of their own and are
  // therefore picked up by loadRecords, but they are artifacts of the node beside them, not records (the
  // same reading check-work-deep reports as PAYLOAD_AS_RECORD). Their declarations are verified once, below,
  // with the run dir / record dir they are actually relative to - checking them here would double-report
  // every line and resolve `videos/x.webm` against the wrong directory.
  for (const [id, rec] of records) {
    const data = rec.data ?? {};
    if (typeof data.schema === 'string' && !data.schema.startsWith('work/')) continue;
    const indexFile = path.join(rec.dir, 'index.yaml');
    const ctx = {...ctxFor(rec.dir), repoRoot: repoRootFor(workRoot, data.repository, workspaceDoc)};
    const table = data.schema === 'work/resource@1' ? RESOURCE_DECLARATIONS : RECORD_DECLARATIONS;
    for (const found of declarationsOf(data, table, ctx)) {
      if (found.digest) counts.digests += 1;
      verifyDeclaration(found, indexFile, ctx, wrapped, counts);
    }
    const assetEntries = [...(Array.isArray(data.assets) ? data.assets : []), ...(Array.isArray(data.ui?.assets) ? data.ui.assets : [])]
      .filter(entry => entry && typeof entry === 'object' && typeof entry.path === 'string');
    for (const entry of assetEntries) {
      if (!entry.generation) continue;
      counts.generatedAssets += 1;
      const expected = typeof entry.generation.promptPath === 'string' && entry.generation.promptPath.trim()
        ? entry.generation.promptPath.trim()
        : `${entry.path.replace(/\.[^.]+$/, '')}.prompt.txt`;
      if (!fs.existsSync(path.join(ctx.recordDir, expected))) {
        wrapped.refuse(indexFile, 'PROMPT_MISSING', `${entry.path} carries a generation but ${expected} is not beside it - a direction with no prompt is not a re-runnable generation`);
      }
      // The tool's own output name is provenance of a rename (concept 5); the extension must still agree.
      const kept = path.extname(entry.path).toLowerCase();
      const produced = path.extname(String(entry.provenance?.toolOutputBasename ?? '')).toLowerCase();
      if (produced && produced !== kept) {
        wrapped.refuse(indexFile, 'ASSET_MAGIC', `${entry.path} is kept as ${kept} but its provenance says the tool produced ${entry.provenance.toolOutputBasename} - one of the two names is not this artifact's`);
      }
    }
    if (data.schema === 'work/uat-flow@1' && data.accounts) {
      counts.accountsFiles += 1;
      if (!fs.existsSync(path.join(rec.dir, String(data.accounts).trim()))) {
        wrapped.refuse(indexFile, 'RESOURCE_FILE_MISSING', `accounts: ${data.accounts} names a file that is not beside the flow - the base gate opens it only if existsSync, so its absence passes there`);
      }
    }
  }

  // ---- concept 6: evidence ghosts (the run it settled on, the assets it names) ----
  for (const [dir, {doc, file}] of evidenceByDir) {
    const ctx = ctxFor(dir);
    for (const found of declarationsOf(doc, EVIDENCE_DECLARATIONS, ctx)) {
      if (found.digest) counts.digests += 1;
      verifyDeclaration(found, file, ctx, wrapped, counts);
    }
    if (typeof doc.run !== 'string' || !doc.run.trim()) continue;
    counts.runs += 1;
    const runDir = path.resolve(dir, doc.run.trim());
    if (!fs.existsSync(runDir) || !fs.lstatSync(runDir).isDirectory()) {
      wrapped.refuse(file, 'EVIDENCE_ARTIFACT_GHOST', `run: ${doc.run} names a run directory that is not on disk - the run this evidence settled on does not exist`);
      continue;
    }
    scanRun(runDir);
  }

  // ---- every other run under the tree: history is a byte claim too ----
  for (const file of canonicalWalk(workRoot).filter(f => f.endsWith('manifest.yaml'))) {
    const runDir = path.dirname(file);
    counts.runs += 1;
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const ctx = {...ctxFor(ownerDirOf(file) ?? runDir), runDir};
    for (const found of declarationsOf(doc, MANIFEST_DECLARATIONS, ctx)) {
      if (found.digest) counts.digests += 1;
      verifyDeclaration(found, file, ctx, wrapped, counts);
    }
    scanRun(runDir);
  }

  for (const file of canonicalWalk(workRoot).filter(f => f.endsWith('generation-receipts.yaml'))) {
    counts.receipts += 1;
    checkReceipt(file, ctxFor(path.dirname(path.dirname(file))), wrapped, counts);
  }

  for (const file of canonicalWalk(workRoot).filter(f => f.endsWith('.prompt.txt'))) {
    counts.prompts += 1;
    checkPromptFile(file, wrapped);
  }

  // ---- concept 7: a parent cannot be done on its members' unproven claims ----
  let doneParents = 0;
  for (const [id, rec] of records) {
    if (!['work/feature@1', 'work/catalog@1'].includes(rec.schema) || rec.data?.state !== 'done') continue;
    doneParents += 1;
    const members = [...records.entries()]
      .filter(([, other]) => other !== rec && !path.relative(rec.dir, other.dir).startsWith('..'));
    const notDone = members.filter(([, other]) => other.data?.state !== 'done');
    if (notDone.length) {
      const named = notDone.slice(0, 3).map(([mid, m]) => `${mid}=${m.data?.state ?? '(no state)'}`).join(', ');
      const preview = `${named}${notDone.length > 3 ? ', ...' : ''}`;
      wrapped.refuse(path.join(rec.dir, 'index.yaml'), 'FEATURE_DONE_INCOMPLETE',
        `${id} is done while ${notDone.length} member record(s) are not (${preview}) - a parent is done only once the records under it are`);
    }
    for (const [memberId, member] of members) {
      if (failedDirs.has(member.dir)) {
        wrapped.refuse(path.join(rec.dir, 'index.yaml'), 'FEATURE_DONE_INCOMPLETE',
          `${id} is done while ${memberId}'s declared artifacts are not the bytes on disk`);
      }
    }
  }
  const parents = [...records.values()].filter(rec => ['work/feature@1', 'work/catalog@1'].includes(rec.schema)).length;
  const latent = parents && !doneParents ? ', so the rule is latent here today' : '';
  emit.info(path.join(workRoot, 'index.yaml'), 'PARENT_STATE_UNUSED',
    `${parents} feature/catalog record(s) in this tree, ${doneParents} claiming done - FEATURE_DONE_INCOMPLETE can only fire on a parent that claims done${latent}`);
  const stampedCodeDigests = [...evidenceByDir.values()].filter(({doc}) => doc.codeDigest).length;
  emit.info(path.join(workRoot, 'index.yaml'), 'BYTE_CENSUS',
    `${counts.declarations} declared path(s) resolved, ${counts.filesOpened} of them opened on disk and ${counts.digestsCompared} hash-compared against a stamped sha256 (${counts.digests} declarations carried one);`
    + ` ${sweptRuns.size} run folder(s) read for media magic and size (${counts.mediaFiles} files);`
    + ` ${counts.prompts} prompt file(s) read; ${counts.generatedAssets} generated asset(s) owed a prompt;`
    + ` ${counts.receipts} receipt file(s) binding ${counts.receiptCalls} generation call(s);`
    + ` ${counts.accountsFiles} uat accounts file(s) looked for`);
  emit.info(path.join(workRoot, 'index.yaml'), 'CODE_DIGEST_NOT_MINE',
    `${stampedCodeDigests} of ${evidenceByDir.size} evidence file(s) here also stamp a codeDigest over code; those bytes are re-hashed by check-example-work.mjs (CODE_DIGEST_STALE), so this script does not repeat that measurement`);

  return {...counts, records: records.size, evidence: evidenceByDir.size};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);
  const out = {refuse: [], suspect: [], info: []};
  const totals = {declarations: 0, digests: 0, digestsCompared: 0, filesOpened: 0, generatedAssets: 0,
    prompts: 0, runs: 0, receipts: 0, mediaFiles: 0, receiptCalls: 0, accountsFiles: 0, records: 0, evidence: 0};
  for (const workRoot of trees) {
    const counts = checkWorkArtifacts(workRoot, out);
    for (const key of Object.keys(totals)) totals[key] += counts[key] ?? 0;
  }
  // Sorted within each tier: two runs over an unchanged tree are then byte-identical, which is what makes a
  // diff across a lane's writes (or across a fleet's concurrent lanes) mean something.
  const sorted = lines => [...lines].sort();
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
  if (byCode.size) console.log(`findings by code: ${[...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => `${code}=${n}`).join(', ')}`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
