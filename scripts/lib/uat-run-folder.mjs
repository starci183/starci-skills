// uat-run-folder.mjs - the pure half of `starci uat record` (scripts/uat/uat-record.mjs): what a finished UAT run folder must
// hold, how a verified blob is curated into an example's fixture store, the work/evidence@1 document of one run and its outcome
// rule. The verb owns the browser, the UAT slot and the artifact store; this module owns the shapes. It is bundled into
// @starci/hfs (sync-runtime.mjs), whose spec src/uat-run-folder.spec.mjs proves it (owner ruling no-runtime-specs).
import crypto from 'node:crypto';
import { sha256 } from '../../engine/digest.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../../engine/by-code-unit.mjs';

export const UAT_RECORD_FLOW_UNKNOWN = 'UAT_RECORD_FLOW_UNKNOWN';
export const UAT_RECORD_RUN_INCOMPLETE = 'UAT_RECORD_RUN_INCOMPLETE';
export const UAT_RECORD_ASSET_INVALID = 'UAT_RECORD_ASSET_INVALID';
const OUTCOMES = new Set(['pass', 'fail', 'partial-pass']);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const RUN_PARTS = Object.freeze(['manifest.yaml', 'result.md', 'screens', 'videos']);
const FOLDERS = Object.freeze([['screens', '.png', 'image/png', PNG], ['videos', '.webm', 'video/webm', WEBM]]);

/** A typed refusal of `starci uat record`. */
export const uatRecordRefusal = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

/** A run id in the evidence schema's shape: <UTC yyyymmddThhmmssZ>-<8 hex>. */
export const newRunId = (now = new Date(), random = crypto.randomBytes(4).toString('hex')) =>
  `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${random}`;

const startsWith = (file, signature) => {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(signature.length);
    fs.readSync(fd, head, 0, head.length, 0);
    return head.equals(signature);
  } finally { fs.closeSync(fd); }
};

/** The refusal text of a run folder whose top level is not exactly its four parts, or null. */
function partsProblem(top) {
  const missing = RUN_PARTS.filter((name) => !top.includes(name));
  const extra = top.filter((name) => !RUN_PARTS.includes(name));
  if (!missing.length && !extra.length) return null;
  const said = [`the run folder holds exactly ${RUN_PARTS.join(', ')}`];
  if (missing.length) said.push(`missing ${missing.join(', ')}`);
  if (extra.length) said.push(`unexpected ${extra.join(', ')}`);
  return said.join('; ');
}

/**
 * Check a finished run folder: exactly manifest.yaml, result.md, screens/ (one or more PNG) and videos/ (one or more WebM), every
 * file non-empty and of its type by its bytes. Returns {manifest, files: [{name, file, mediaType}]} or throws a refusal.
 */
export function readRunFolder(runDir) {
  const problem = partsProblem(fs.readdirSync(runDir).sort(byCodeUnit));
  if (problem) throw uatRecordRefusal(UAT_RECORD_RUN_INCOMPLETE, problem);
  const files = [];
  const add = (name, mediaType, signature) => {
    const file = path.join(runDir, ...name.split('/'));
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0) throw uatRecordRefusal(UAT_RECORD_ASSET_INVALID, `${name} is empty or not a file`);
    if (signature && !startsWith(file, signature)) throw uatRecordRefusal(UAT_RECORD_ASSET_INVALID, `${name} is not a ${mediaType} file by its bytes`);
    files.push({ name, file, mediaType });
  };
  add('manifest.yaml', 'application/yaml');
  add('result.md', 'text/markdown');
  for (const [dir, ext, mediaType, signature] of FOLDERS) {
    const names = fs.readdirSync(path.join(runDir, dir)).sort(byCodeUnit);
    if (!names.length) throw uatRecordRefusal(UAT_RECORD_RUN_INCOMPLETE, `${dir}/ holds no ${ext} file`);
    for (const name of names) {
      if (path.extname(name).toLowerCase() !== ext) throw uatRecordRefusal(UAT_RECORD_RUN_INCOMPLETE, `${dir}/${name} is not a ${ext} file`);
      add(`${dir}/${name}`, mediaType, signature);
    }
  }
  let manifest;
  try { manifest = parseYaml(fs.readFileSync(path.join(runDir, 'manifest.yaml'), 'utf8')); }
  catch (error) { throw uatRecordRefusal(UAT_RECORD_RUN_INCOMPLETE, `manifest.yaml does not parse: ${error.message}`); }
  if (!manifest || !OUTCOMES.has(manifest.outcome)) throw uatRecordRefusal(UAT_RECORD_RUN_INCOMPLETE, 'manifest.yaml carries no outcome of pass, fail or partial-pass');
  return { manifest, files };
}

/**
 * Where one verified blob goes in an example's fixture store (`root`) and what its sidecar says: <root>/<ab>/<sha> and <sha>.json.
 * The fixture store is tracked source written only by `starci uat record`, which writes these paths and re-hashes the result with
 * curatedProblem. Pure: no write here.
 */
export function curationOf(root, { sha256: digest, bytes, mediaType, createdAt }) {
  const dir = path.join(root, digest.slice(0, 2));
  const file = path.join(dir, digest);
  return { dir, file, sidecar: `${file}.json`, sidecarText: JSON.stringify({ size: bytes.length, mediaType, createdAt }) };
}

/** The refusal of a curated blob whose stored bytes do not hash to its name, or null. */
export const curatedProblem = (digest, storedBytes) => (sha256(storedBytes) === digest
  ? null
  : uatRecordRefusal(UAT_RECORD_ASSET_INVALID, `the curated blob ${digest.slice(0, 12)} does not hash to its name`));

/** The verdict: pass only when the walk exited 0 and its own manifest says pass. */
export const recordedOutcome = (exitCode, manifest) => (exitCode === 0 ? manifest.outcome : 'fail');

/**
 * The work/evidence@1 document of one recorded run. `cited` is [{name, sha256}] for every file of the run folder; `recordDigest`
 * is the sha256 of the flow record's index.yaml as it stands.
 */
export function evidenceOf({ recordId, recordDigest, runId, outcome, cited, command, environment, capturedAt, baseUrl }) {
  const byDir = (dir) => cited.filter((entry) => entry.name.startsWith(`${dir}/`)).map(({ name, sha256 }) => ({ name, sha256 }));
  const result = cited.find((entry) => entry.name === 'result.md');
  const stack = baseUrl
    ? { stack: `The walk drove the app served at ${baseUrl} and the dev stack its .starcistacks declares, in a real browser recorded by the runtime's Playwright recorder.` }
    : {};
  return {
    schema: 'work/evidence@1',
    record: recordId,
    recordDigest,
    run: { id: runId, outcome, result: { name: result.name, sha256: result.sha256 }, screens: byDir('screens'), videos: byDir('videos') },
    outcome,
    assets: cited.map(({ name, sha256 }) => ({ name: `runs/${runId}/${name}`, sha256 })),
    provenance: { actor: 'uat-record', tool: `starci uat record --flow ${recordId} -- ${command.join(' ')}`, environment, capturedAt, ...stack },
  };
}
