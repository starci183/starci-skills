import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../core/yaml.mjs';
import {walk} from './check-example-work.mjs';

/**
 * Re-runs every assertion in one example record's evidence.yaml against a real --cwd and compares the
 * outcome against what the evidence claims - concept 2, "replayable evidence". `scripts/example-evidence.mjs`
 * writes both `command` and `exit` on every assertion for exactly this reason: a prose `observation` alone
 * cannot be replayed, only read. This script is the replay half of that pair; it never writes anything -
 * evidence.yaml stays exactly as it was, whether the replay matches or not.
 *
 * Usage:
 *   node scripts/example-verify.mjs --work <path-to-.starciwork> --record <record-id> --cwd <repo-dir>
 *
 * Exit 0 when every assertion's replayed outcome matches the outcome the evidence already claims. Exit 1
 * (PROOF_STALE) the moment any assertion's replayed outcome differs, or lacks a `command` to replay at all
 * (the same condition scripts/check-example-work.mjs's gate refuses as PROOF_NOT_REPLAYABLE - this script
 * treats it as a verification failure rather than duplicating that gate's own refusal wording).
 */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--work') args.work = argv[++i];
    else if (token === '--record') args.record = argv[++i];
    else if (token === '--cwd') args.cwd = argv[++i];
    else throw new Error(`unrecognized argument: ${token}`);
  }
  for (const required of ['work', 'record', 'cwd']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  return args;
}

/** Finds the record's own directory under `workRoot` by matching its authored `id`, the same way
 * scripts/example-evidence.mjs's findRecordFile does (kept separate rather than imported: that function
 * returns the record *file*, this one needs the record's *directory* to find evidence.yaml beside it). */
function findRecordDir(workRoot, recordId) {
  for (const file of walk(workRoot)) {
    if (!file.endsWith('index.yaml')) continue;
    let parsed;
    try { parsed = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (parsed && typeof parsed === 'object' && parsed.id === recordId) return path.dirname(file);
  }
  return null;
}

/** Replays one assertion's `command` against `cwd` and reports whether the outcome it produces now
 * matches the outcome the evidence already claims. An assertion with no `command` cannot be replayed at
 * all and is reported as a mismatch rather than skipped - silently skipping it would let evidence stay
 * "verified" forever by never actually being checked. */
function replayAssertion(assertion, cwd) {
  const claimedOutcome = assertion?.outcome ?? 'pass';
  if (!assertion || typeof assertion.command !== 'string' || !assertion.command.trim()) {
    return {id: assertion?.id ?? '(unnamed)', ok: false, reason: 'no command recorded; not replayable', claimedOutcome, replayedOutcome: null, replayedExit: null};
  }
  let exit = 0;
  try {
    execFileSync(assertion.command, {cwd, shell: true, stdio: 'pipe'});
  } catch (error) {
    exit = typeof error?.status === 'number' ? error.status : 1;
  }
  const replayedOutcome = exit === 0 ? 'pass' : 'fail';
  return {
    id: assertion.id, ok: replayedOutcome === claimedOutcome, reason: null,
    command: assertion.command, claimedOutcome, replayedOutcome, replayedExit: exit,
  };
}

/**
 * Verifies one record's evidence.yaml by replaying every assertion. Throws (never a bare boolean) when the
 * record or its evidence cannot be found at all - a caller with nothing to replay is a usage error, not a
 * verification failure. Returns `{ok, results, recordId, evidenceFile}` otherwise: `ok` is true only when
 * every assertion replayed with a matching outcome, exactly mirroring how a gate would read "did this
 * still pass".
 */
export function verifyRecord({workRoot, recordId, cwd}) {
  const dir = findRecordDir(workRoot, recordId);
  if (!dir) throw new Error(`no record with id ${recordId} was found under ${workRoot}`);
  const evidenceFile = path.join(dir, 'evidence.yaml');
  if (!fs.existsSync(evidenceFile)) throw new Error(`no evidence.yaml beside ${recordId} at ${dir} - nothing to verify`);

  const evidence = parseYaml(fs.readFileSync(evidenceFile, 'utf8'));
  const assertions = Array.isArray(evidence?.assertions) ? evidence.assertions : [];
  const results = assertions.map(assertion => replayAssertion(assertion, cwd));
  const ok = results.length > 0 && results.every(r => r.ok);
  return {ok, results, recordId, evidenceFile};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`REFUSED ${error.message}`);
    process.exit(1);
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workRoot = path.resolve(root, args.work);
  const cwd = path.resolve(root, args.cwd);

  let result;
  try {
    result = verifyRecord({workRoot, recordId: args.record, cwd});
  } catch (error) {
    console.error(`REFUSED ${error.message}`);
    process.exit(1);
  }

  for (const r of result.results) {
    if (r.ok) console.log(`MATCH ${r.id}: still ${r.replayedOutcome} (${r.command})`);
    else if (r.reason) console.log(`PROOF_STALE ${r.id}: ${r.reason}`);
    else console.log(`PROOF_STALE ${r.id}: claimed ${r.claimedOutcome}, replayed ${r.replayedOutcome} (exit ${r.replayedExit}) running ${r.command}`);
  }
  console.log(`${args.record}: ${result.ok ? 'verified - every assertion replayed with a matching outcome' : 'PROOF_STALE - at least one assertion no longer matches what its evidence claims'}`);
  process.exitCode = result.ok ? 0 : 1;
}
