import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';

/**
 * Generates an evidence.yaml for one example .starciwork record by actually running the given assertion
 * commands, the way `docs/backend-source-pattern.md`'s example tree expects an implementation, business
 * rule or acceptance criterion to be proven. This is a toolkit script for the examples, not the kernel:
 * it can only be run by hand or by CI, never by a live workflow, and it must never claim `starci-kernel`
 * provenance it did not earn (see the provenance note below).
 *
 * Usage:
 *   node scripts/example-evidence.mjs --work <path-to-.starciwork> --record <record-id> --cwd <repo-dir> \
 *     --assert <ac-id>=<command> [--assert <ac-id>=<command> ...]
 *
 * Every `--assert` runs its command (via the system shell, resolved against --cwd) and is recorded with
 * its exit code and a one-line observation quoting the command and its exit status. The record's own
 * index.yaml is located under --work by its `id`, its recordDigest is computed exactly as the kernel's
 * own `kernel/reconciliation.mjs` `recordDigests` function computes it (sha256 of the record file's raw
 * bytes - see the digest note below), and the sibling evidence.yaml is written in the same shape already
 * used elsewhere in the tree. Any assertion whose command exits non-zero is written with
 * `outcome: fail`, and in that case this script itself exits 1. This script only ever writes
 * evidence.yaml; it never edits a record's own index.yaml or its `state` field.
 *
 * Provenance: this script cannot literally act as `starci-kernel`. That actor is written by
 * `ctx.work.api.markDone` deep inside `kernel/sync.mjs`, which needs a whole live kernel workflow
 * context (an open ledger `store`, workflow `state`, `ctx.work.api`/`ctx.guards.gitQueue`, git-queued
 * writes, and so on) that a standalone script run outside a kernel workflow does not have and cannot
 * honestly construct. Rather than fabricate that context or lie about the actor, this script writes
 * `provenance.actor: example-evidence` (see schemas/work-layout.yaml's work/evidence section for what
 * that actor means), which is the truthful claim: a real command was run, by this tool, outside any
 * kernel workflow.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {assert: []};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--work') args.work = argv[++i];
    else if (token === '--record') args.record = argv[++i];
    else if (token === '--cwd') args.cwd = argv[++i];
    else if (token === '--assert') args.assert.push(argv[++i]);
    else throw new Error(`unrecognized argument: ${token}`);
  }
  for (const required of ['work', 'record', 'cwd']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  if (!args.assert.length) throw new Error('at least one --assert <ac-id>=<command> is required');
  return args;
}

function splitAssertion(raw) {
  const at = raw.indexOf('=');
  if (at < 0) throw new Error(`--assert must be <ac-id>=<command>, got: ${raw}`);
  return {id: raw.slice(0, at), command: raw.slice(at + 1)};
}

export const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

/** Finds the record's own index.yaml under `workRoot` by matching its authored `id`. */
function findRecordFile(workRoot, recordId) {
  for (const file of walk(workRoot)) {
    if (!file.endsWith('index.yaml')) continue;
    let parsed;
    try { parsed = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (parsed && typeof parsed === 'object' && parsed.id === recordId) return file;
  }
  return null;
}

/**
 * sha256 of the record file's raw bytes - exactly the digest kernel/reconciliation.mjs's recordDigests
 * takes over `nodeFileOf(tree, node)` (the record's own authored file). Recomputed inline here rather
 * than imported: recordDigests expects a whole `tree` (node.path/workRoot wiring) this script does not
 * build, so the byte-for-byte sha256 over the record file is the exact operation reused, the same choice
 * scripts/check-example-work.mjs already made for the same reason.
 */
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Runs one assertion command; never throws - failure is reported as an outcome, not a script crash. */
function runAssertion({id, command}, cwd) {
  try {
    execFileSync(command, {cwd, shell: true, stdio: 'pipe'});
    return {id, outcome: 'pass', observation: `${command} exited 0`};
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 1;
    return {id, outcome: 'fail', observation: `${command} exited ${status}`};
  }
}

export function generateEvidence({workRoot, recordId, cwd, assertions, now = () => new Date()}) {
  const recordFile = findRecordFile(workRoot, recordId);
  if (!recordFile) throw new Error(`no record with id ${recordId} was found under ${workRoot}`);

  const results = assertions.map(assertion => runAssertion(assertion, cwd));
  const outcome = results.every(result => result.outcome === 'pass') ? 'pass' : 'fail';

  const evidence = {
    schema: 'work/evidence',
    record: recordId,
    recordDigest: sha256File(recordFile),
    outcome,
    assertions: results.map(({id, outcome: assertionOutcome, observation}) => ({id, outcome: assertionOutcome, observation})),
    provenance: {
      actor: 'example-evidence',
      tool: 'scripts/example-evidence.mjs',
      environment: 'local',
      capturedAt: now().toISOString(),
    },
  };

  const evidenceFile = path.join(path.dirname(recordFile), 'evidence.yaml');
  const header = '# Written by scripts/example-evidence.mjs by actually running the assertion commands below\n'
    + '# against --cwd; this is example-toolkit provenance, not a starci-kernel run (see the script header\n'
    + '# and schemas/work-layout.yaml\'s work/evidence section for what that distinction means).\n';
  fs.writeFileSync(evidenceFile, header + stringifyYaml(evidence));

  return {evidenceFile, evidence, ok: outcome === 'pass'};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`REFUSED ${error.message}`);
    process.exit(1);
  }

  const workRoot = path.resolve(root, args.work);
  const cwd = path.resolve(root, args.cwd);
  const assertions = args.assert.map(splitAssertion);

  let result;
  try {
    result = generateEvidence({workRoot, recordId: args.record, cwd, assertions});
  } catch (error) {
    console.error(`REFUSED ${error.message}`);
    process.exit(1);
  }

  console.log(`wrote ${path.relative(root, result.evidenceFile).replaceAll('\\', '/')}: outcome ${result.evidence.outcome}`);
  for (const assertion of result.evidence.assertions) {
    console.log(`  ${assertion.outcome === 'pass' ? 'PASS' : 'FAIL'} ${assertion.id}: ${assertion.observation}`);
  }
  process.exitCode = result.ok ? 0 : 1;
}
