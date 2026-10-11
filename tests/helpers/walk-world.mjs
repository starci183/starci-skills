// walk-world.mjs - one world, one approved goal, the legs of a whole workflow walked in order (tests/replay/workflow-walk*.spec.mjs).
// Real: the engine, the controllers, the settler, the Kernel verbs (status, decide, enqueue, dispatch-ready, report, kernel-ack-rev), the op packet and its contract.
// Stubbed (tests/helpers/replay-world.mjs): the Orca binary and the agent launch; the Critic agent launch of the settler (the stub verdict is `pass` unless a case says otherwise).
// The op itself is a scripted stand-in (tests/helpers/walk-standins.mjs): it reads the packet the dispatch wrote, runs the commands the contract names, writes the records the
// contract's `writes` name and files its report through the real `starci kernel report`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, STARCI, replayWorld } from './replay-world.mjs';

export const WALK_OPS = ['request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'brand.decide', 'interface.draw', 'provision.ask', 'work.author',
  'backend.implement', 'interface.implement', 'interface.audit', 'e2e.verify', 'integration.verify', 'review.verify', 'handover.review'];
export const FEATURE = 'identity';

/** The fixture of the approved goal: the whole leg order of the two authentication workflows, a linear plan, no job yet. */
export const walkFixture = () => ({ schema: 'replay-fixture@1', case: 'workflow-walk', workflow: { id: 'wf-walk', phase: 'running', goalRevision: 0 },
  plan: { legs: WALK_OPS.map((op) => ({ op })), edges: WALK_OPS.slice(1).map((op, index) => [WALK_OPS[index], op]) }, jobs: [], ops: WALK_OPS });

const orcaCalls = (world) => (fs.existsSync(world.env.STARCI_FAKE_ORCA_LOG) ? fs.readFileSync(world.env.STARCI_FAKE_ORCA_LOG, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/** The packet file the dispatch of `jobId` wrote: the path the worker-start spec of the Orca stub names. */
export function packetOf(world, jobId) {
  const starts = orcaCalls(world).filter((call) => call.argv.includes('worker-start')).map((call) => call.argv[call.argv.indexOf('--spec') + 1]);
  const spec = starts.reverse().find((text) => text.includes(`job ${jobId},`));
  assert.ok(spec, `no worker-start named ${jobId}`);
  const found = /wrote it verbatim to:\s+(\S+)/.exec(spec);
  assert.ok(found, `the worker-start of ${jobId} names no packet file`);
  return found[1];
}

/** The dispatched attempt's bound scratch; the prompt has its own storage custody. */
export function scratchOf(world, jobId) {
  const attempt = world.ledger((ledger) => ledger.db.prepare(
    'SELECT scratch_dir FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1'
  ).get(jobId));
  assert.ok(attempt?.scratch_dir && path.isAbsolute(attempt.scratch_dir),
    `${jobId}: dispatched attempt has no bound scratch`);
  return attempt.scratch_dir;
}

/** The workflow tree is an hfs app, as a started workflow's is: the lite example app (hfs.json, be/, fe/, the stack declaration) and the Work root's own files, committed as the tree's scaffold. */
function scaffoldApp(dir) {
  const lite = path.join(ROOT, 'examples', 'lite-app');
  fs.cpSync(lite, dir, { recursive: true, filter: (src) => !/[\\/](node_modules|\.git|\.husky)([\\/]|$)/.test(src) });
  fs.copyFileSync(path.join(ROOT, 'examples', 'ecommerce-app', '.starciwork', 'workspace.yaml'), path.join(dir, '.starciwork', 'workspace.yaml'));
}

/** The walk over `world`: verbs the Kernel, the engine and the op stand-in call. */
export function openWalk(t, { fixture = walkFixture(), launch = true, seed = null, autopilot = 'on' } = {}) {
  const world = replayWorld(t, fixture, { tree: { scaffold: scaffoldApp }, launch, seed });
  const tree = world.tree.dir;
  // Orca hands every worker its own terminal handle; the ledger and the guard bind that handle to one job.
  world.env.STARCI_FAKE_ORCA_UNIQUE_TERMINALS = '1';
  // Autopilot is on by default for every running workflow (modules/models/runtimes.yaml allocation.autopilot.enabled): the walk runs the way production does unless a case turns it off.
  world.env.STARCI_AUTOPILOT = autopilot;
  const walk = { world, tree, jobs: new Map(), stops: [] };
  const cli = (verb, args, options) => world.cli(verb, [...args], options);

  /** Records a stop in the walk's own list: the spec prints it, the findings table keeps it. */
  walk.stop = (leg, step, result) => { walk.stops.push({ leg, step, status: result.status, json: result.json, stderr: String(result.stderr ?? '').slice(0, 1200) }); return result; };

  walk.status = () => world.status();
  walk.menuItem = (op) => walk.status().menu.find((item) => item.kind === 'leg-ready' && item.id.includes(`:${op}:`));

  /** The Kernel's attestation of its READ of the op (the admission of a new leg reads it back). */
  walk.ack = (op) => { const r = world.ack([op]); assert.equal(r.status, 0, `ack ${op}: ${r.stderr || r.stdout}`); return r; };

  /** Enqueue a fixture job directly and answer its job id. */
  walk.enqueue = (op, paths, extra = []) => {
    const r = cli('enqueue', ['--workflow', world.wf, '--op', op, '--paths', paths, ...extra]);
    if (r.status !== 0) return { ok: false, result: r };
    walk.jobs.set(op, r.json.job_id);
    return { ok: true, jobId: r.json.job_id, result: r };
  };

  /** The Kernel answers the leg-ready item of `op` with the proposed write set through the real `decide`. */
  walk.decide = (item, choice) => cli('decide', ['--workflow', world.wf, '--item', item.id, '--choice', choice, '--reason', 'walk']);

  /** The Workflow controller's dispatch push (route, admission, launch trust, worker-start through the Orca stub). */
  walk.dispatch = () => cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000 });

  /** The environment of the op's terminal: Orca exports its handle into the terminal, and the ledger and the guard bind that handle to the job (scripts/guards/op-context.mjs). */
  walk.opEnv = (jobId) => ({ ORCA_TERMINAL_HANDLE: world.ledger((ledger) => ledger.db.prepare('SELECT terminal_handle FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)?.terminal_handle) });

  /** The op files its report through the real verb, from its own scratch. */
  walk.file = (jobId, envelope, attach = []) => {
    const scratch = scratchOf(world, jobId);
    const file = path.join(scratch, 'report.json');
    fs.writeFileSync(file, JSON.stringify(envelope));
    return cli('report', ['--job', jobId, '--report', file, ...attach.flatMap((a) => ['--attach', a])], { as: 'owner', extraEnv: walk.opEnv(jobId) });
  };

  /** One engine start: job + workflow controllers (the settler included) with the stubbed Critic. */
  walk.engine = ({ op, within, critic = 'codex', maker = 'claude', beauty, passes = 1, controllers = ['job'] } = {}) => world.engine({ controllers, passes,
    critic: op ? { tree, op, within: within ?? null, maker, critic, ...(beauty ? { beauty } : {}) } : null });

  walk.job = (jobId) => world.ledger((ledger) => ledger.db.prepare('SELECT job_id, op_id, status, try_no FROM jobs WHERE job_id=?').get(jobId));
  walk.events = (kinds) => world.ledger((ledger) => ledger.db.prepare(`SELECT seq, kind, entity_id, payload_json FROM events WHERE kind IN (${kinds.map(() => '?').join(',')}) ORDER BY seq`).all(...kinds));
  /** `starci <args> --json` from the app root of the tree, as an op runs it: {status, json, stdout, stderr}. */
  walk.sh = (args, { cwd = tree, timeout = 180_000, jobId = null } = {}) => {
    const r = spawnSync(process.execPath, [STARCI, ...args.map(String), '--json'], { cwd, encoding: 'utf8', windowsHide: true, timeout, env: { ...world.env, ...(jobId ? walk.opEnv(jobId) : {}) } });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { json = null; }
    return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
  };
  /** Why a job did not settle: its status, the handover/refusal events and the failing checks of its attempts. */
  walk.why = (jobId) => world.ledger((ledger) => ({ job: ledger.db.prepare('SELECT job_id, op_id, status, try_no FROM jobs WHERE job_id=?').get(jobId),
    events: ledger.db.prepare("SELECT kind, payload_json FROM events WHERE entity_id=? AND kind NOT IN ('worker-done-sent') ORDER BY seq DESC LIMIT 6").all(jobId).map((e) => [e.kind, e.payload_json.slice(0, 500)]),
    failing: ledger.db.prepare("SELECT name, runner, summary_json FROM check_runs WHERE status != 'pass' ORDER BY rowid DESC LIMIT 6").all().map((c) => [c.name, c.runner, String(c.summary_json).slice(0, 500)]) }));
  walk.ROOT = ROOT;
  return walk;
}
