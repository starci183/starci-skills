#!/usr/bin/env node
// scripts/reconciler/start.mjs — the shared host startup and actual readiness owner.
// skills/starci/references/host-startup.md describes its lifecycle; workflow ingress excludes Kernel watchdogs.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { quickCheck } from './ledger-health.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { green, red, warn } from './checklist-items.mjs';
import { depthItems } from './depth-items.mjs';
import { ensure, crashLoopPlan, crashLoopRecord, leaderState, restartEngine, status } from './boot.mjs';
import { PROFILES, REQUIRED_ACTIVE, SKILL_ROOT, reconcilerConfig, reconcilerNumbers } from './state.mjs'; import { DEFAULT_SUPERVISOR_MODE, supervisorMode } from '../machine/home.mjs';
import { probeOrcaAsync, serviceRegistry, servicePorts, servicePlatformProblem, startService } from './services.mjs'; import { execNode } from '../api/node/exec-node.mjs';
import { sleep } from '../lib/sleep.mjs'; import { isMain } from '../lib/is-main.mjs';
import { buildUi, uiBuildState } from './ui-build.mjs';
export { buildUi, uiBuildState };
import { workflowCaller } from '../agent/caller-context.mjs';
import { PROFILE, engineItems, profileItems, safeShadowOf, serviceItems } from './start-items.mjs';
import { auditTasks } from '../machine/task-audit.mjs';
import { taskItems } from './task-health.mjs';
import { applyEngine, applyUiBuild, startDownServices, startSeats, waitForLeader } from './start-apply.mjs';
import { eachInOrder, repeatInOrder } from '../lib/in-order.mjs';
export { PROFILE, engineItems, profileItems, safeShadowOf };
export { engineIsSafe } from './start-items.mjs';

const MIN_SQLITE = '3.51.3';
const GROUPS = ['preflight', 'config', 'engine', 'controllers', 'services', 'seats', 'sla'];
const START_WAIT_MS = 120_000;

/* ------------------------------------------------------------ items */

/** -1 | 0 | 1 comparing dotted numeric versions. Pure. */
export function cmpVersion(a, b) {
  const x = String(a).split('.').map((n) => Number.parseInt(n, 10) || 0), y = String(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
}

export const sqliteItem = (version = process.versions.sqlite, node = process.version) => (cmpVersion(version, MIN_SQLITE) >= 0
  ? green('preflight', 'node-sqlite', 'Node bundled SQLite', `${version} (node ${node})`)
  : red('preflight', 'node-sqlite', 'Node bundled SQLite', `${version} is older than ${MIN_SQLITE} (WAL-reset bug; node ${node})`, `upgrade Node to a release that bundles SQLite >= ${MIN_SQLITE}`));

/** Required managed-service capability; a read-only OS row prevents startup from reaching unsupported actuators. */
export function hostPlatformItem(platform = process.platform) {
  const problem = servicePlatformProblem('harness-ui', platform);
  return problem ? red('preflight', 'host-platform', 'Managed host platform', problem, 'use a host with the declared service lifecycle implementation')
    : green('preflight', 'host-platform', 'Managed host platform', 'managed service actuators available');
}

/** A registered ledger that no product should live in: a temp or test path. Pure. */
export function isTempLedger(file, { tmp = os.tmpdir() } = {}) {
  const p = String(file ?? '').replaceAll('\\', '/').toLowerCase();
  const t = String(tmp).replaceAll('\\', '/').toLowerCase().replace(/\/$/, '');
  return Boolean(p) && (p.startsWith(`${t}/`) || /\/(?:temp|tmp)\//.test(p) || /prereq|starci-test|\/scratch\//.test(p));
}

/**
 * The registered-ledger findings: [{ledgerId, name, file, repoRoot, problem: 'temp'|'missing-repo'|'missing-file'}]. A ledger
 * under a temp directory (its file or its repo_root) or whose repo_root no longer exists is stray. Seams: exists, tmp.
 */
export function ledgerFindings(ledgers, { exists = (f) => fs.existsSync(f), tmp = os.tmpdir() } = {}) {
  const out = [];
  for (const l of ledgers ?? []) {
    if (l.state === 'retired') continue;
    const row = { ledgerId: l.ledgerId, name: l.name, file: l.file ?? null, repoRoot: l.repoRoot ?? null };
    if (isTempLedger(l.file, { tmp }) || isTempLedger(l.repoRoot, { tmp })) out.push({ ...row, problem: 'temp' });
    else if (l.repoRoot && !exists(l.repoRoot)) out.push({ ...row, problem: 'missing-repo' });
    else if (!l.file || !exists(l.file)) out.push({ ...row, problem: 'missing-file' });
  }
  return out;
}

/** quick_check of every registered ledger file that exists: {bad: [{name, result}], checked}. Seams: check, exists. */
export function ledgerIntegrity(ledgers, { check = (f) => quickCheck(f), exists = (f) => fs.existsSync(f) } = {}) {
  const out = { bad: [], checked: 0 };
  for (const l of ledgers ?? []) {
    if (l.state === 'retired' || !l.file || !exists(l.file)) continue;
    const r = check(l.file);
    out.checked += 1;
    if (!r.ok) out.bad.push({ name: l.name ?? l.ledgerId, reason: r.reason ?? 'integrity-failed', result: r.result?.[0] ?? 'failed' });
  }
  return out;
}

/** The pinned (agent, model) pairs of config.yaml kernel (the pin) and supervisor.kernel. Pure. */
function configuredPins(config) {
  const pins = [];
  const add = (where, agent, model) => { if (agent && model) pins.push({ where, agent: String(agent), model: String(model) }); };
  const kernel = config?.kernel;
  add('kernel', kernel?.agent, kernel?.model);
  const sup = config?.supervisor?.kernel;
  if (sup) add('supervisor.kernel', sup.agent, sup.model);
  return pins;
}

/**
 * Pins the launch cannot honour: {where, agent, model, problem}. A model is pinned through worker-start --model and
 * attested from worker-show's effective model, so a pin is unsound only when its agent has no card or its card takes no
 * model flag (start.modelArgument false: Orca's --model is for Claude, Codex and Cursor). Seam: card(agent) -> parsed card | null.
 */
export function pinProblems(pins, { card = (agent) => { try { return parseYaml(fs.readFileSync(path.join(SKILL_ROOT, 'modules', 'models', 'agents', `${agent}.yaml`), 'utf8')); } catch { return null; } } } = {}) {
  const out = [];
  for (const pin of pins) {
    const c = card(pin.agent);
    if (!c) { out.push({ ...pin, problem: `no agent card modules/models/agents/${pin.agent}.yaml` }); continue; }
    if (pin.model && c.start?.modelArgument === false)
      out.push({ ...pin, problem: `${pin.agent} takes no --model on worker-start (modules/models/agents/${pin.agent}.yaml start.modelArgument false); drop the model pin` });
  }
  return out;
}

/* ------------------------------------------------------------ the operational profile */

/**
 * config.yaml text with `reconciler:` set to a named profile: enabled, the profile, and (operational only) the explicit
 * controller entries the profile does not itself run active (an explicit gc/workers/learning setting survives; an explicit
 * shadow/off of job/host/workflow/resource is what the profile replaces; observe keeps none). Returns {text, changed}. Pure.
 */
export function applyProfileText(text, profile = PROFILE) {
  if (!Object.hasOwn(PROFILES, profile)) throw new Error(`unknown reconciler profile ${profile}: use ${Object.keys(PROFILES).join(' | ')}`);
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^reconciler:\s*(?:#.*)?$/.test(l));
  let end = lines.length;
  if (at >= 0) for (let i = at + 1; i < lines.length; i += 1) if (/^\S/.test(lines[i])) { end = i; break; }
  let previous = {};
  if (at >= 0) { try { previous = parseYaml(lines.slice(at, end).join('\n'))?.reconciler ?? {}; } catch { previous = {}; } }
  const keep = Object.entries(previous.controllers ?? {}).filter(([n, v]) => profile === PROFILE && !REQUIRED_ACTIVE.includes(n) && ['off', 'shadow', 'active'].includes(v?.mode));
  const block = ['reconciler:', '  enabled: true', `  profile: ${profile}`, '  controllers: {' + keep.map(([n, v]) => `${n}: {mode: ${v.mode}}`).join(', ') + '}'];
  const next = at < 0 ? [...lines.filter((l, i, a) => !(i === a.length - 1 && l === '')), ...block, ''] : [...lines.slice(0, at), ...block, ...lines.slice(end)];
  const out = next.join(eol);
  return { text: out, changed: out !== text };
}

/* ------------------------------------------------------------ engine + controllers */

/**
 * Whether the live engine runs in safe mode, from its LIVE state and not from how it started: boot.mjs leaderState().safe
 * (a controller_modes reason 'safe mode...'), or a controller configured active whose effective mode is shadow while the
 * leader is fresh (`--safe` survives a self-reload, and a crash-restart run is not the only safe run). Pure over the status.
 */
function slaItems(s) {
  const open = s.violations?.open ?? 0;
  return [open ? warn('sla', 'violations', 'open violations / SLA', `${open} open violation(s) of ${s.violations.clocks ?? open} SLA clock(s): see the Supervisor digest`, 'starci reconciler status')
    : green('sla', 'violations', 'open violations / SLA', `0 violated of ${s.violations?.clocks ?? 0} SLA clock(s)`, { required: false })];
}

/* ------------------------------------------------------------ services and seats */

/** Probe every registry service (or just `names`) in parallel: [{name, ok, detail, entry}]. Seam: registry. */
async function probeServices({ registry = serviceRegistry(), names = null } = {}) {
  const wanted = registry.filter((e) => e.kind === 'service' && (!names || names.includes(e.name)));
  return Promise.all(wanted.map(async (entry) => {
    let p;
    try { p = await entry.probe(); } catch (error) { p = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
    return { name: entry.name, ok: p?.ok === true, unmanaged: p?.unmanaged === true, detail: p, entry };
  }));
}

/** The Supervisor seat row from `start-supervisor.mjs --status --json` (or the mode). Pure. */
function supervisorItem({ mode, statusJson, startJson = null }) {
  if (mode !== 'kernel') return green('seats', 'supervisor', 'Supervisor seat', 'chat mode: the owner\'s desktop chat is the Supervisor (nothing to start)');
  const h = statusJson?.health;
  if (startJson?.ok === false) {
    const error = startJson.error || startJson.reason;
    const detail = `start-supervisor: ${startJson.action ?? 'failed'}` + (error ? ` - ${String(startJson.error ?? startJson.reason).slice(0, 160)}${startJson.detail ? `: ${String(startJson.detail).slice(0, 240)}` : ''}` : '');
    return red('seats', 'supervisor', 'Supervisor seat', detail, 'starci supervisor start --json');
  }
  if (h?.live) {
    const terminal = h.terminal ? ` (${h.terminal})` : '';
    const starting = h.starting ? ', starting' : '';
    return green('seats', 'supervisor', 'Supervisor seat', `live${terminal}${starting}`);
  }
  return red('seats', 'supervisor', 'Supervisor seat', h ? `not live: ${h.reason ?? 'unknown'}` : 'status unreadable', 'starci supervisor start --json');
}

/** A Kernel seat row from a watchdog `--once --json` answer. Pure. */
function kernelSeatItem({ ledger, workflowId, answer, seatState }) {
  const name = `Kernel seat ${workflowId}`;
  const id = `seat:kernel:${ledger}:${workflowId}`;
  const action = answer?.action ?? null;
  if (seatState === 'live' && answer?.ok !== false) return green('seats', id, name, `live (${action ?? 'ok'})`);
  const state = seatState ?? 'unknown';
  const actionText = action ? ` (${action})` : '';
  const error = answer?.error ? `: ${String(answer.error).slice(0, 120)}` : '';
  return red('seats', id, name, `${state}${actionText}${error}`,
    `starci machine kernel-watchdog --repo <repo> --workflow ${workflowId} --once --repair --json`);
}

/* ------------------------------------------------------------ the read-only gather */

function safeRun(fn, fallback) { try { return fn(); } catch { return fallback; } }

async function json(args, { timeoutMs = 120_000 } = {}) {
  const { error, stdout } = await execNode(args, { cwd: SKILL_ROOT, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  const lines = String(stdout ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* next */ } }
  return error?.killed || error?.code === 'ETIMEDOUT' ? { ok: false, error: 'timeout' } : null;
}

/** The machine.sqlite preflight row, and the ledgers it registers: `{ ledgers, rows }`. */
function machineDbRows(env) {
  try {
    const q = readMachine((m) => ({ check: m.db.prepare('PRAGMA quick_check').get()?.quick_check, ledgers: m.listLedgers() }), null, { env });
    if (!q) return { ledgers: [], rows: [red('preflight', 'machine-db', 'machine.sqlite', 'not found or unreadable', 'preserve existing machine.sqlite and WAL; resolve storage access and runtime compatibility; initialise only when absence is confirmed; project snapshots do not contain machine.sqlite')] };
    return { ledgers: q.ledgers, rows: [q.check === 'ok' ? green('preflight', 'machine-db', 'machine.sqlite quick_check', `ok, ${q.ledgers.length} ledger(s) registered`) : red('preflight', 'machine-db', 'machine.sqlite quick_check', String(q.check), 'restore machine.sqlite (owner-approved)')] };
  } catch (error) { return { ledgers: [], rows: [red('preflight', 'machine-db', 'machine.sqlite health', String(error?.message ?? error).slice(0, 200), 'preserve machine.sqlite and WAL; diagnose access, compatibility and integrity before selecting an owner-approved recovery point')] }; }
}

/** The ledger integrity and registration rows of the registered `ledgers`. */
function ledgerRows(ledgers) {
  const integrity = ledgerIntegrity(ledgers);
  const found = ledgerFindings(ledgers);
  return [integrity.bad.length ? red('preflight', 'ledger-integrity', 'registered ledger health', integrity.bad.map((b) => `${b.name} (${b.reason}): ${b.result}`).join('; ').slice(0, 400), 'preserve original database and WAL; resolve schema/SQLite compatibility, identity or access; restore only confirmed integrity failures from an inspected snapshot with every writer stopped and owner approval of its loss window')
    : green('preflight', 'ledger-integrity', 'registered ledgers quick_check', `${integrity.checked} ledger file(s) ok`, { required: false }),
  found.length ? warn('preflight', 'ledgers', 'registered ledgers', found.map((f) => `${f.name ?? f.ledgerId} (${f.problem}: ${(f.problem === 'missing-repo' ? f.repoRoot : f.file) ?? '-'})`).join('; ').slice(0, 400), 'starci reconciler up --retire-stale-ledgers (retires temp/test ledgers via the machine-db API)')
    : green('preflight', 'ledgers', 'registered ledgers', 'no temp/test path and no missing file', { required: false })];
}

/** The model-pin row of the kernel and supervisor seats. */
function pinRows(config) {
  const pinBad = pinProblems(configuredPins(config));
  return pinBad.length ? red('preflight', 'pins', 'kernel/supervisor model pins', pinBad.map((p) => `${p.where}: ${p.problem}`).join('; ').slice(0, 400), 'drop the model pin of an agent that takes no --model (modules/models/agents/<agent>.yaml start.modelArgument)')
    : green('preflight', 'pins', 'kernel/supervisor model pins', 'every pinned model is one worker-start can launch and attest');
}

/** The config, engine and SLA rows. */
function engineRows(env, config) {
  const profile = profileItems(reconcilerConfig({ config }), config?.reconciler ?? null);
  const s = status({ env });
  const plan = crashLoopPlan(safeRun(() => crashLoopRecord({ env, windowMs: reconcilerNumbers().crashLoop.windowMs }), { starts: [] }), { max: reconcilerNumbers().crashLoop.max, windowMs: reconcilerNumbers().crashLoop.windowMs });
  return [profile, s.ok ? engineItems(s, { safeIsCrashLoop: plan.looping }) : red('engine', 'engine', 'reconciler engine', `status unreadable: ${s.error}`, 'starci reconciler status'), s.ok ? slaItems(s) : []];
}

/** The service rows and the harness UI build row. */
async function serviceRows(config, platform) {
  const probes = await probeServices();
  const tasks = servicePlatformProblem('harness-ui', platform) ? null : await auditTasks();
  const services = [...serviceItems(probes, { publicUrl: safeRun(() => servicePorts().harnessPublicUrl, null), config, audits: tasks?.audits }), ...taskItems(tasks)];
  const ui = uiBuildState();
  return [services, ui.stale ? red('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason, 'starci reconciler up (rebuilds the harness UI)') : green('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason)];
}

/** The Supervisor seat row (read through `start-supervisor --status` when its seat can be reached). */
async function supervisorRow({ env, config, orca, seats, orcaProbe }) {
  const mode = safeRun(() => supervisorMode({ env, config }), DEFAULT_SUPERVISOR_MODE);
  if (mode === 'kernel' && seats && orcaProbe.ok) {
    const st = await json([path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--status', '--json'], { timeoutMs: 90_000 });
    return supervisorItem({ mode, statusJson: st });
  }
  if (mode === 'kernel') return red('seats', 'supervisor', 'Supervisor seat', orca ? 'Orca is not reachable' : 'not checked', 'open Orca, then run start again');
  return supervisorItem({ mode });
}

/** The Orca reachability rows: one row, or none when Orca was not probed. */
function orcaRow(orcaProbe) {
  if (orcaProbe.ok === false) {
    const error = orcaProbe.error ? `: ${orcaProbe.error}` : '';
    return [red('preflight', 'orca', 'Orca reachable', `${orcaProbe.verdict}${error}`, 'open Orca yourself, then run start again')];
  }
  return orcaProbe.ok ? [green('preflight', 'orca', 'Orca reachable', `${orcaProbe.terminals ?? 0} terminal(s)`)] : [];
}

/** The Core debug seat row. */
async function coreDebugRow(env) {
  let health;
  try { health = (await import('./core-debug.mjs')).coreDebugStatus({ env }); }
  catch (error) { health = { ready: false, error: String(error?.message ?? error) }; }
  return health.ready === true ? green('seats', 'core-debug', 'Core debug seat', 'native worker live on its bound caller route')
    : red('seats', 'core-debug', 'Core debug seat', health.error ?? health.health?.reason ?? 'not ready', 'run the approved StarCi start with its declared caller route');
}

/**
 * Every checklist row, read-only: preflight, config, engine, controllers, services, seats, sla, ui build. Never throws
 * (a failing section is one red row). Seams (specs): env, config, machine reads, probes.
 */
export async function gather({ env = process.env, config = safeRun(() => loadConfig(), null), orca = true, seats = true, workflowSeats = true, coreDebug = true, depthProbe = null, platform = process.platform } = {}) {
  const items = [];
  const push = (...rows) => items.push(...rows.flat());
  // preflight
  push(sqliteItem(), hostPlatformItem(platform));
  const machine = machineDbRows(env);
  push(machine.rows, ledgerRows(machine.ledgers));
  push(await worktreeItems({ env, repos: machine.ledgers.filter((l) => l.state !== 'retired').map((l) => l.repoRoot) }));
  push(pinRows(config));
  const orcaProbe = orca ? await probeOrcaAsync({ timeoutMs: 30_000 }) : { ok: null };
  // config + engine + controllers + sla
  push(engineRows(env, config));
  // services
  push(await serviceRows(config, platform));
  // seats
  push(await supervisorRow({ env, config, orca, seats, orcaProbe }), orcaRow(orcaProbe));
  if (seats && workflowSeats) push(await kernelSeatItems({ orcaOk: orcaProbe.ok !== false, config }));
  if (coreDebug && config?.debug === true) push(await coreDebugRow(env));
  push(await depthItems({ env, config, orcaOk: orcaProbe.ok === true, ...(depthProbe ? { probe: depthProbe } : {}) }));
  return items;
}

/**
 * One row per repository the runtime keeps worktrees in, its own included (scripts/machine/worktrees.mjs worktreeCounts): its
 * runtime and linked worktree counts against worktrees.capPerRepo, red when either is over the cap or it holds orphans (a registered tree whose directory is gone, or a tree
 * under <repo>/.starciwork/worktrees no live registry row owns). The GC controller's gc:worktrees pass clears orphans.
 * Seam: counts.
 */
async function worktreeItems({ env = process.env, repos = [], counts = null } = {}) {
  let rows;
  try { rows = counts ?? (await import('../machine/worktrees.mjs')).worktreeCounts({ env, repos: [SKILL_ROOT, ...(await import('../kernel/target-repo.mjs')).boundRepoRoots(repos)] }); }
  catch (error) { return [warn('preflight', 'worktrees', 'worktrees per repo', `unreadable: ${String(error?.message ?? error).slice(0, 200)}`, 'starci reconciler up --check again')]; }
  if (!rows.length) return [green('preflight', 'worktrees', 'worktrees per repo', 'no runtime worktree', { required: false })];
  return rows.map((r) => {
    const id = `worktrees:${path.basename(r.repoRoot)}`, name = `worktrees ${path.basename(r.repoRoot)}`;
    const orphans = r.orphans.length ? ', ' + r.orphans.length + ' orphan(s): ' + r.orphans.slice(0, 3).map((o) => `${o.path} (${o.why})`).join('; ') : '';
    const detail = `${r.live}/${r.cap} runtime, ${r.linked} linked${orphans}`;
    return r.over || r.orphans.length
      ? red('preflight', id, name, detail, 'the reconciler GC controller (key gc:worktrees, always active) preserves and removes them; to run it now: starci machine worktrees gc')
      : green('preflight', id, name, detail);
  });
}

/** Every running workflow of every managed repo, its Kernel seat read through the watchdog's read-only pass. */
async function kernelSeatItems({ orcaOk = true, config = null, repair = false } = {}) {
  const { resumeRepos, runningWorkflows } = await import('../kernel/managed-repos.mjs');
  const { seatStateOf } = await import('./controllers/host.mjs');
  const { repos } = resumeRepos({ config });
  const rows = [];
  for (const repo of repos) for (const wf of runningWorkflows(repo)) rows.push({ repo, workflowId: wf.workflowId });
  if (!rows.length) return [green('seats', 'seat:kernel', 'Kernel seats', 'no running workflow', { required: false })];
  const out = [];
  await eachInOrder(rows, async ({ repo, workflowId }) => {
    const ledger = path.basename(repo);
    if (!orcaOk) { out.push(red('seats', `seat:kernel:${ledger}:${workflowId}`, `Kernel seat ${workflowId}`, 'Orca is not reachable', 'open Orca, then run start again')); return; }
    const args = [path.join(SKILL_ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs'), '--repo', repo, '--workflow', workflowId, '--once', '--json', ...(repair ? ['--repair'] : [])];
    const answer = await json(args, { timeoutMs: 300_000 });
    out.push(kernelSeatItem({ ledger, workflowId, answer, seatState: answer?.action ? seatStateOf(answer.action) : null }));
  });
  return out;
}

/* ------------------------------------------------------------ render */

export function summarize(items) {
  const redRequired = items.filter((i) => i.status === 'red' && i.required);
  const warns = items.filter((i) => i.status === 'warn');
  return { ok: redRequired.length === 0, red: redRequired.length, warn: warns.length, green: items.filter((i) => i.status === 'green').length };
}

function renderText(items, { applied = [] } = {}) {
  const mark = { green: '[GREEN]', red: '[RED]  ', warn: '[WARN] ' };
  const lines = [];
  for (const group of GROUPS) {
    const rows = items.filter((i) => i.group === group);
    if (!rows.length) continue;
    lines.push(`${group.toUpperCase()}`);
    for (const r of rows) {
      lines.push('  ' + mark[r.status] + ' ' + r.name + (r.detail ? ' - ' + r.detail : ''));
      if (r.fix && r.status !== 'green') lines.push(`           fix: ${r.fix}`);
    }
  }
  if (applied.length) lines.push('APPLIED', ...applied.map((a) => `  ${a}`));
  const s = summarize(items);
  lines.push(`START ${s.ok ? 'GREEN' : 'RED'}: ${s.green} green, ${s.red} red, ${s.warn} warn`);
  return lines.join('\n');
}

/* ------------------------------------------------------------ apply */


/** Write a named profile to config.yaml (backup first): only `start --set-profile` calls it. {changed, backup} or {error}. */
function applyProfileFile({ file = path.join(SKILL_ROOT, 'config.yaml'), now = Date.now(), profile = PROFILE } = {}) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { changed: false, error: `${file} is not readable` }; }
  const out = applyProfileText(text, profile);
  if (!out.changed) return { changed: false };
  const backup = `${file}.bak-${new Date(now).toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, out.text);
  return { changed: true, backup };
}

/** The `--retire-stale-ledgers` step: retire the temp/test ledgers and name them. */
function retireStaleLedgers(env) {
  const stale = ledgerFindings(readMachine((m) => m.listLedgers(), [], { env })).filter((f) => f.problem === 'temp');
  if (stale.length) withMachine((m) => { for (const f of stale) m.setLedgerState(f.ledgerId, 'retired', { reason: 'start --retire-stale-ledgers: temp/test path' }); }, { env });
  const names = stale.length ? `: ${stale.map((f) => f.name ?? f.ledgerId).join(', ')}` : '';
  return `retired ${stale.length} temp/test ledger(s)${names}`;
}

/** The `--set-profile` step: write the profile to config.yaml and say what happened. */
function setProfileResult(setProfile) {
  const r = applyProfileFile({ profile: setProfile });
  if (r.error) return `profile NOT set: ${r.error}`;
  if (r.changed) return `config.yaml reconciler.profile: ${setProfile} (backup ${path.basename(r.backup)})`;
  return `config.yaml already on profile ${setProfile}`;
}

export async function applyHost(opts, deps = {}) {
  const applied = [];
  const { env = process.env, waitMs, setProfile, noBuild, retire, workflowSeats = true, platform = process.platform } = opts;
  const unsupported = servicePlatformProblem('harness-ui', platform);
  if (unsupported) return [`host startup refused: ${unsupported}`];
  const api = { uiBuildState, buildUi, leaderState, reconcilerNumbers, crashLoopRecord, status, restartEngine, ensure,
    sleep, probeServices, startService, auditTasks, loadConfig, probeOrcaAsync, supervisorMode, json, kernelSeatItems, ...deps };
  if (retire) applied.push(retireStaleLedgers(env));
  if (setProfile) applied.push(setProfileResult(setProfile));
  let rebuilt = false;
  if (!noBuild) {
    const ui = await applyUiBuild(api, env, applied);
    if (ui.failed) return applied;
    rebuilt = ui.rebuilt;
  }
  const leader = api.leaderState({ env });
  const numbers = api.reconcilerNumbers();
  const plan = crashLoopPlan(api.crashLoopRecord({ env, windowMs: numbers.crashLoop.windowMs }), { max: numbers.crashLoop.max, windowMs: numbers.crashLoop.windowMs });
  const live = safeRun(() => api.status({ env }), null);
  const shadowed = live ? safeShadowOf(live) : [];
  await applyEngine(api, { env, leader, plan, shadowed }, applied);
  await waitForLeader(api, env, waitMs);
  await startDownServices(api, { loadConfig: () => safeRun(() => api.loadConfig(), null), rebuilt }, applied);
  const orcaUp = (await api.probeOrcaAsync({ timeoutMs: 30_000 })).ok;
  const config = safeRun(() => api.loadConfig(), null);
  await startSeats(api, { env, orcaUp, config, workflowSeats }, applied);
  return applied;
}

export async function ensureHostRuntime({ env = process.env, waitMs = START_WAIT_MS, workflowSeats = false, check = false, platform = process.platform, ...opts } = {}, deps = {}) {
  const read = deps.gather ?? gather, apply = deps.applyHost ?? applyHost, wait = deps.sleep ?? sleep, now = deps.now ?? Date.now;
  const readOptions = { env, workflowSeats, coreDebug: check, platform };
  let items = await read(readOptions);
  const blockers = items.filter((item) => item.required && item.status === 'red' && ['preflight', 'config'].includes(item.group)
    && !(opts.setProfile && item.group === 'config' && item.id === 'profile'));
  let applied = [];
  if (!check && blockers.length === 0 && (!summarize(items).ok || opts.setProfile || opts.retire)) {
    try { applied = await apply({ env, waitMs, workflowSeats, platform, ...opts }); }
    catch (error) { return { ok: false, summary: summarize(items), applied, items, error: String(error?.message ?? error) }; }
    items = await read(readOptions);
    const until = now() + waitMs;
    await repeatInOrder(async () => {
      if (!summarize(items).ok && now() < until) { await wait(10_000); items = await read(readOptions); return undefined; }
      return true;
    });
  }
  const summary = summarize(items);
  return { ok: summary.ok, summary, applied, items };
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const has = (f) => argv.includes(f);
  const workflowEntry = deps.workflowEntry === true;
  const wait = argv.indexOf('--wait');
  const waitMs = Math.max(0, (Number(wait >= 0 ? argv[wait + 1] : START_WAIT_MS / 1000) || START_WAIT_MS / 1000) * 1000);
  const sp = argv.indexOf('--set-profile');
  const setProfile = sp >= 0 ? argv[sp + 1] : null;
  if (sp >= 0 && (!Object.hasOwn(PROFILES, setProfile) || has('--check'))) {
    console.error(`start: --set-profile takes ${Object.keys(PROFILES).join(' | ')} and cannot be combined with --check`);
    process.exitCode = 2;
    return;
  }
  const opts = { waitMs, setProfile, noBuild: has('--no-build'), retire: has('--retire-stale-ledgers') };
  const env = deps.env ?? process.env;
  const result = await (deps.ensureHostRuntime ?? ensureHostRuntime)({ ...opts, env, workflowSeats: !workflowEntry, check: has('--check') });
  if (workflowEntry) result.hostOk = result.ok;
  if (result.ok && !has('--check') && safeRun(() => (deps.loadConfig ?? loadConfig)(), null)?.debug === true) {
    const ensureCoreDebug = deps.ensureDebug ?? (await import('./core-debug.mjs')).ensureCoreDebug;
    result.maintenance = await ensureCoreDebug({ caller: workflowCaller(argv), env, plan: false });
    const ready = result.maintenance?.ok === true && result.maintenance?.ready === true;
    result.items.push(ready ? green('seats', 'core-debug', 'Core debug seat', result.maintenance.action ?? 'ready')
      : red('seats', 'core-debug', 'Core debug seat', result.maintenance.reason ?? result.maintenance.action ?? 'not ready', 'supply the declared caller route and reconcile its native seat'));
    result.summary = summarize(result.items);
    result.ok = result.summary.ok;
  }
  (deps.print ?? console.log)(has('--json') ? JSON.stringify(result) : renderText(result.items, { applied: result.applied }));
  process.exitCode = result.ok ? 0 : 1;
  return result;
}

if (isMain(import.meta.url)) await main();
