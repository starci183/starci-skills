#!/usr/bin/env node
// scripts/reconciler/start.mjs — the shared host startup and actual readiness owner.
// skills/starci/references/host-startup.md describes its lifecycle; workflow ingress excludes Kernel watchdogs.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { legacyWorkSqliteFindings, workspaceBoundRepoRoots } from '../housekeeping/hk-orphan-ledgers.mjs';
import { quickCheck } from './ledger-health.mjs';
import { CONNECTOR_DEFAULTS, loadConfig } from '../../engine/config.mjs';
import { green, red, warn } from './checklist-items.mjs';
import { depthItems } from './depth-items.mjs';
import { ensure, crashLoopPlan, crashLoopRecord, leaderState, restartEngine, status } from './boot.mjs';
import { PROFILES, REQUIRED_ACTIVE, SKILL_ROOT, configuredMode, reconcilerConfig, reconcilerNumbers } from './state.mjs'; import { DEFAULT_SUPERVISOR_MODE, supervisorMode } from '../machine/home.mjs';
import { probeOrcaAsync, serviceRegistry, servicePorts, servicePlatformProblem, startService } from './services.mjs'; import { execNode } from '../api/node/exec-node.mjs';
import { sleep } from '../lib/sleep.mjs'; import { isMain } from '../lib/is-main.mjs';
import { buildUi, uiBuildState } from './ui-build.mjs';
export { buildUi, uiBuildState };
import { workflowCaller } from '../agent/caller-context.mjs';

const MIN_SQLITE = '3.51.3';
export const PROFILE = 'operational';
/** Services `start` never launches itself: Orca is a GUI app (the owner opens it); the scheduled task is the owner's. */
const NOT_ACTUATED = new Set(['orca']);
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
  const p = String(file ?? '').replace(/\\/g, '/').toLowerCase();
  const t = String(tmp).replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
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

/** The pinned (agent, model) pairs of config.yaml kernel (group or single pin) and supervisor.kernel. Pure. */
function configuredPins(config) {
  const pins = [];
  const add = (where, agent, model) => { if (agent && model) pins.push({ where, agent: String(agent), model: String(model) }); };
  const kernel = config?.kernel;
  if (Array.isArray(kernel?.group)) kernel.group.forEach((m, i) => add(`kernel.group[${i}]`, m?.agent, m?.model));
  else add('kernel', kernel?.agent, kernel?.model);
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
  const block = ['reconciler:', '  enabled: true', `  profile: ${profile}`, `  controllers: {${keep.map(([n, v]) => `${n}: {mode: ${v.mode}}`).join(', ')}}`];
  const next = at < 0 ? [...lines.filter((l, i, a) => !(i === a.length - 1 && l === '')), ...block, ''] : [...lines.slice(0, at), ...block, ...lines.slice(end)];
  const out = next.join(eol);
  return { text: out, changed: out !== text };
}

/** The config profile rows. `conf` is reconcilerConfig(); `raw` the config's own reconciler block. Pure. */
export function profileItems(conf, raw) {
  const fix = 'starci reconciler up --set-profile operational (writes that one block to config.yaml, backup kept)';
  if (!conf.enabled) return [red('config', 'profile', 'reconciler config', 'reconciler.enabled is not true: no controller runs', fix)];
  if (conf.profile !== PROFILE) {
    const shadow = REQUIRED_ACTIVE.filter((n) => conf.controllers[n]?.mode !== 'active');
    return [shadow.length ? red('config', 'profile', 'reconciler profile', `${conf.profile ? `profile ${conf.profile}` : 'no reconciler.profile: an unnamed controller is not run (shadow at most)'}: ${shadow.map((n) => `${n}=${configuredMode(n, conf)}`).join(' ')} - start needs them active`, fix)
      : green('config', 'profile', 'reconciler profile', `no profile, but ${REQUIRED_ACTIVE.join(', ')} are explicitly active`)];
  }
  const overridden = REQUIRED_ACTIVE.filter((n) => conf.controllers[n]?.mode !== 'active');
  return [overridden.length ? red('config', 'profile', 'reconciler profile', `operational, but controllers.${overridden.join(', ')} is set explicitly to ${overridden.map((n) => conf.controllers[n]?.mode).join('/')}`, `remove controllers.${overridden.join(', controllers.')} from config.yaml reconciler (or run start.mjs --set-profile operational)`)
    : green('config', 'profile', 'reconciler profile', `operational (${Object.entries(PROFILES.operational).map(([n, m]) => `${n}=${m}`).join(' ')}${raw?.controllers && Object.keys(raw.controllers).length ? '; explicit overrides kept' : ''})`)];
}

/* ------------------------------------------------------------ engine + controllers */

/**
 * Whether the live engine runs in safe mode, from its LIVE state and not from how it started: boot.mjs leaderState().safe
 * (a controller_modes reason 'safe mode...'), or a controller configured active whose effective mode is shadow while the
 * leader is fresh (`--safe` survives a self-reload, and a crash-restart run is not the only safe run). Pure over the status.
 */
export function safeShadowOf(s) {
  if (!s?.leader?.fresh) return [];
  return Object.entries(s.modes ?? {}).filter(([, m]) => m.configured === 'active' && m.effective === 'shadow').map(([name]) => name);
}
export const engineIsSafe = (s) => Boolean(s?.leader?.safe) || safeShadowOf(s).length > 0;

/** Engine and controller rows from boot.mjs status(). Pure over the status. */
export function engineItems(s, { safeIsCrashLoop = false } = {}) {
  const l = s.leader;
  const items = [];
  const shadowed = safeShadowOf(s);
  if (!l.fresh) items.push(red('engine', 'engine', 'reconciler engine', l.holder ? `stale: leader ${l.holder} pid ${l.pid} heartbeat ${l.ageMs == null ? 'never' : `${Math.round(l.ageMs / 1000)}s`} old` : 'not running', 'starci reconciler up'));
  else items.push(green('engine', 'engine', 'reconciler engine', `leader ${l.holder} pid ${l.pid} epoch ${l.epoch} heartbeat ${Math.round(l.ageMs / 1000)}s ago${l.draining ? ' (draining a reload)' : ''}`));
  items.push(engineIsSafe(s) ? red('engine', 'safe-mode', 'engine safe mode', `${safeIsCrashLoop ? 'running --safe: a real crash loop is on record (every controller is forced shadow)' : 'running --safe (every controller forced shadow) without a crash loop behind it'}${shadowed.length ? `; configured active but running shadow: ${shadowed.join(', ')}` : ''}`, 'starci reconciler up (restarts it normally)')
    : green('engine', 'safe-mode', 'engine safe mode', 'normal mode'));
  for (const name of Object.keys(s.modes)) {
    const m = s.modes[name];
    const want = PROFILES.operational[name];
    const required = REQUIRED_ACTIVE.includes(name);
    const shown = `${m.effective}${m.configured !== m.effective ? ` (configured ${m.configured})` : ''}`;
    if (required) items.push(m.effective === 'active' ? green('controllers', `mode:${name}`, `controller ${name}`, shown) : red('controllers', `mode:${name}`, `controller ${name}`, `${shown}, start needs active`,
      m.configured === 'active' ? 'the engine is not running it yet: starci reconciler up' : 'starci reconciler up --set-profile operational'));
    else items.push(m.effective === 'off' && want !== 'off' ? warn('controllers', `mode:${name}`, `controller ${name}`, `${shown}, profile expects ${want}`) : green('controllers', `mode:${name}`, `controller ${name}`, shown, { required: false }));
  }
  return items;
}

function slaItems(s) {
  const open = s.violations?.open ?? 0;
  return [open ? warn('sla', 'violations', 'open violations / SLA', `${open} open violation(s) of ${s.violations.clocks ?? open} SLA clock(s): see the Supervisor digest`, 'starci reconciler status')
    : green('sla', 'violations', 'open violations / SLA', `0 violated of ${s.violations?.clocks ?? 0} SLA clock(s)`, { required: false })];
}

/* ------------------------------------------------------------ services and seats */

const SERVICE_LABEL = { orca: 'Orca', 'harness-ui': 'harness UI (local /healthz)', 'harness-tunnel': 'harness tunnel (public /healthz)', 'ask-gateway': 'ask gateway', 'ask-tunnel': 'ask tunnel', 'telegram-bridge': 'Telegram bridge' };

/** Probe every registry service in parallel: [{name, ok, detail, entry}]. Seam: registry. */
async function probeServices({ registry = serviceRegistry() } = {}) {
  const wanted = registry.filter((e) => e.kind === 'service');
  return Promise.all(wanted.map(async (entry) => {
    let p;
    try { p = await entry.probe(); } catch (error) { p = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
    return { name: entry.name, ok: p?.ok === true, unmanaged: p?.unmanaged === true, detail: p, entry };
  }));
}

/** Whether config.yaml wants a connector service at all (an `off` one is not required). Pure. */
const serviceWanted = (name, config) => (name === 'ask-tunnel' ? (config?.connectors?.cloudflare?.mode ?? CONNECTOR_DEFAULTS.cloudflare.mode) !== 'off' : name === 'telegram-bridge' ? config?.connectors?.telegram?.enabled === true : true);

function serviceItems(probes, { publicUrl = null, config = null } = {}) {
  return probes.map((p) => {
    const label = SERVICE_LABEL[p.name] ?? p.name;
    const d = p.detail ?? {};
    const detail = p.ok ? `up${d.status ? ` (HTTP ${d.status}` : ''}${d.ms != null ? `${d.status ? ', ' : ' ('}${d.ms}ms` : ''}${d.status || d.ms != null ? ')' : ''}${p.name === 'harness-tunnel' && publicUrl ? ` ${publicUrl}` : ''}`
      : `down: ${d.error ?? d.status ?? d.verdict ?? (d.value ? (d.value.health?.problems?.[0] ?? (d.value.running === false ? 'not running' : JSON.stringify(d.value).slice(0, 120))) : 'no answer')}`;
    if (p.name.startsWith('sched-task:')) return p.ok ? green('services', p.name, `scheduled task ${p.name.slice(11)}`, `exists (${d.status ?? 'ok'})`, { required: false })
      : warn('services', p.name, `scheduled task ${p.name.slice(11)}`, p.unmanaged ? 'missing (unmanaged)' : 'not healthy', 'starci task register reconciler --apply (the owner)');
    if (p.ok) return green('services', p.name, label, detail);
    if (!serviceWanted(p.name, config)) return green('services', p.name, label, 'off in config.yaml connectors (not required)', { required: false });
    return red('services', p.name, label, detail, p.name === 'orca' ? 'open Orca yourself, then run start again (start never launches a GUI app)' : 'the reconciler Host controller manages this service; run starci reconciler start');
  });
}

/** The Supervisor seat row from `start-supervisor.mjs --status --json` (or the mode). Pure. */
function supervisorItem({ mode, statusJson, startJson = null }) {
  if (mode !== 'kernel') return green('seats', 'supervisor', 'Supervisor seat', 'chat mode: the owner\'s desktop chat is the Supervisor (nothing to start)');
  const h = statusJson?.health;
  if (startJson && startJson.ok === false) return red('seats', 'supervisor', 'Supervisor seat', `start-supervisor: ${startJson.action ?? 'failed'}${startJson.error || startJson.reason ? ` - ${String(startJson.error ?? startJson.reason).slice(0, 160)}` : ''}`, 'starci supervisor start --json');
  if (h?.live) return green('seats', 'supervisor', 'Supervisor seat', `live${h.terminal ? ` (${h.terminal})` : ''}${h.starting ? ', starting' : ''}`);
  return red('seats', 'supervisor', 'Supervisor seat', h ? `not live: ${h.reason ?? 'unknown'}` : 'status unreadable', 'starci supervisor start --json');
}

/** A Kernel seat row from a watchdog `--once --json` answer. Pure. */
function kernelSeatItem({ ledger, workflowId, answer, seatState }) {
  const name = `Kernel seat ${workflowId}`;
  const id = `seat:kernel:${ledger}:${workflowId}`;
  const action = answer?.action ?? null;
  if (seatState === 'live' && answer?.ok !== false) return green('seats', id, name, `live (${action ?? 'ok'})`);
  return red('seats', id, name, `${seatState ?? 'unknown'}${action ? ` (${action})` : ''}${answer?.error ? `: ${String(answer.error).slice(0, 120)}` : ''}`,
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

/**
 * Every checklist row, read-only: preflight, config, engine, controllers, services, seats, sla, ui build. Never throws
 * (a failing section is one red row). Seams (specs): env, config, machine reads, probes.
 */
export async function gather({ env = process.env, config = safeRun(() => loadConfig(), null), orca = true, seats = true, workflowSeats = true, coreDebug = true, depthProbe = null, platform = process.platform } = {}) {
  const items = [];
  const push = (...rows) => items.push(...rows.flat());
  // preflight
  push(sqliteItem(), hostPlatformItem(platform));
  let ledgers = [];
  try {
    const q = readMachine((m) => ({ check: m.db.prepare('PRAGMA quick_check').get()?.quick_check, ledgers: m.listLedgers() }), null, { env });
    if (!q) push(red('preflight', 'machine-db', 'machine.sqlite', 'not found or unreadable', 'preserve existing machine.sqlite and WAL; resolve storage access and runtime compatibility; initialise only when absence is confirmed; project snapshots do not contain machine.sqlite'));
    else { ledgers = q.ledgers; push(q.check === 'ok' ? green('preflight', 'machine-db', 'machine.sqlite quick_check', `ok, ${ledgers.length} ledger(s) registered`) : red('preflight', 'machine-db', 'machine.sqlite quick_check', String(q.check), 'restore machine.sqlite (owner-approved)')); }
  } catch (error) { push(red('preflight', 'machine-db', 'machine.sqlite health', String(error?.message ?? error).slice(0, 200), 'preserve machine.sqlite and WAL; diagnose access, compatibility and integrity before selecting an owner-approved recovery point')); }
  const integrity = ledgerIntegrity(ledgers);
  push(integrity.bad.length ? red('preflight', 'ledger-integrity', 'registered ledger health', integrity.bad.map((b) => `${b.name} (${b.reason}): ${b.result}`).join('; ').slice(0, 400), 'preserve original database and WAL; resolve schema/SQLite compatibility, identity or access; restore only confirmed integrity failures from an inspected snapshot with every writer stopped and owner approval of its loss window')
    : green('preflight', 'ledger-integrity', 'registered ledgers quick_check', `${integrity.checked} ledger file(s) ok`, { required: false }));
  const found = ledgerFindings(ledgers);
  push(found.length ? warn('preflight', 'ledgers', 'registered ledgers', found.map((f) => `${f.name ?? f.ledgerId} (${f.problem}: ${(f.problem === 'missing-repo' ? f.repoRoot : f.file) ?? '-'})`).join('; ').slice(0, 400), 'starci reconciler up --retire-stale-ledgers (retires temp/test ledgers via the machine-db API)')
    : green('preflight', 'ledgers', 'registered ledgers', 'no temp/test path and no missing file', { required: false }));
  const legacy = legacyWorkSqliteFindings([...ledgers.filter((l) => l.state !== 'retired').map((l) => l.repoRoot), ...workspaceBoundRepoRoots({ env })]);
  push(legacy.length ? warn('preflight', 'legacy-stores', 'legacy in-repo runtime.sqlite', `${legacy.length} store(s): ${legacy.map((f) => f.repoRoot).join(', ').slice(0, 300)}`, 'the ledger lives in <runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite; archive the in-repo copy (LEDGER_LEGACY_WORK_SQLITE, starci runtime ledger-hygiene)')
    : green('preflight', 'legacy-stores', 'legacy in-repo runtime.sqlite', 'none', { required: false }));
  push(await worktreeItems({ env, repos: ledgers.filter((l) => l.state !== 'retired').map((l) => l.repoRoot) }));
  const pinBad = pinProblems(configuredPins(config));
  push(pinBad.length ? red('preflight', 'pins', 'kernel/supervisor model pins', pinBad.map((p) => `${p.where}: ${p.problem}`).join('; ').slice(0, 400), 'drop the model pin of an agent that takes no --model (modules/models/agents/<agent>.yaml start.modelArgument)')
    : green('preflight', 'pins', 'kernel/supervisor model pins', 'every pinned model is one worker-start can launch and attest'));
  const orcaProbe = orca ? await probeOrcaAsync({ timeoutMs: 30_000 }) : { ok: null };
  // config + engine + controllers + sla
  const raw = config?.reconciler ?? null;
  push(profileItems(reconcilerConfig({ config }), raw));
  const s = status({ env });
  const plan = crashLoopPlan(safeRun(() => crashLoopRecord({ env, windowMs: reconcilerNumbers().crashLoop.windowMs }), { starts: [] }), { max: reconcilerNumbers().crashLoop.max, windowMs: reconcilerNumbers().crashLoop.windowMs });
  push(s.ok ? engineItems(s, { safeIsCrashLoop: plan.looping }) : red('engine', 'engine', 'reconciler engine', `status unreadable: ${s.error}`, 'starci reconciler status'), s.ok ? slaItems(s) : []);
  // services
  const probes = await probeServices();
  push(serviceItems(probes, { publicUrl: safeRun(() => servicePorts().harnessPublicUrl, null), config }));
  const ui = uiBuildState();
  push(ui.stale ? red('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason, 'starci reconciler up (rebuilds the harness UI)') : green('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason));
  // seats
  const mode = safeRun(() => supervisorMode({ env, config }), DEFAULT_SUPERVISOR_MODE);
  if (mode === 'kernel' && seats && orcaProbe.ok) {
    const st = await json([path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--status', '--json'], { timeoutMs: 90_000 });
    push(supervisorItem({ mode, statusJson: st }));
  } else push(mode === 'kernel' ? red('seats', 'supervisor', 'Supervisor seat', orca ? 'Orca is not reachable' : 'not checked', 'open Orca, then run start again') : supervisorItem({ mode }));
  push(orcaProbe.ok === false ? red('preflight', 'orca', 'Orca reachable', `${orcaProbe.verdict}${orcaProbe.error ? `: ${orcaProbe.error}` : ''}`, 'open Orca yourself, then run start again') : orcaProbe.ok ? green('preflight', 'orca', 'Orca reachable', `${orcaProbe.terminals ?? 0} terminal(s)`) : []);
  if (seats && workflowSeats) push(await kernelSeatItems({ orcaOk: orcaProbe.ok !== false, config }));
  if (coreDebug && config?.debug === true) {
    let health;
    try { health = (await import('./core-debug.mjs')).coreDebugStatus({ env }); }
    catch (error) { health = { ready: false, error: String(error?.message ?? error) }; }
    push(health.ready === true ? green('seats', 'core-debug', 'Core debug seat', 'native worker live on its bound caller route')
      : red('seats', 'core-debug', 'Core debug seat', health.error ?? health.health?.reason ?? 'not ready', 'run the approved StarCi start with its declared caller route'));
  }
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
    const detail = `${r.live}/${r.cap} runtime, ${r.linked} linked${r.orphans.length ? `, ${r.orphans.length} orphan(s): ${r.orphans.slice(0, 3).map((o) => `${o.path} (${o.why})`).join('; ')}` : ''}`;
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
  for (const { repo, workflowId } of rows) {
    const ledger = path.basename(repo);
    if (!orcaOk) { out.push(red('seats', `seat:kernel:${ledger}:${workflowId}`, `Kernel seat ${workflowId}`, 'Orca is not reachable', 'open Orca, then run start again')); continue; }
    const args = [path.join(SKILL_ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs'), '--repo', repo, '--workflow', workflowId, '--once', '--json', ...(repair ? ['--repair'] : [])];
    const answer = await json(args, { timeoutMs: 300_000 });
    out.push(kernelSeatItem({ ledger, workflowId, answer, seatState: answer?.action ? seatStateOf(answer.action) : null }));
  }
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
      lines.push(`  ${mark[r.status]} ${r.name}${r.detail ? ` - ${r.detail}` : ''}`);
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

export async function applyHost(opts, deps = {}) {
  const applied = [];
  const { env = process.env, waitMs, setProfile, noBuild, retire, workflowSeats = true, platform = process.platform } = opts;
  const unsupported = servicePlatformProblem('harness-ui', platform);
  if (unsupported) return [`host startup refused: ${unsupported}`];
  const api = { uiBuildState, buildUi, leaderState, reconcilerNumbers, crashLoopRecord, status, restartEngine, ensure,
    sleep, probeServices, startService, loadConfig, probeOrcaAsync, supervisorMode, json, kernelSeatItems, ...deps };
  if (retire) {
    const stale = ledgerFindings(readMachine((m) => m.listLedgers(), [], { env })).filter((f) => f.problem === 'temp');
    if (stale.length) withMachine((m) => { for (const f of stale) m.setLedgerState(f.ledgerId, 'retired', { reason: 'start --retire-stale-ledgers: temp/test path' }); }, { env });
    applied.push(`retired ${stale.length} temp/test ledger(s)${stale.length ? `: ${stale.map((f) => f.name ?? f.ledgerId).join(', ')}` : ''}`);
  }
  if (setProfile) {
    const r = applyProfileFile({ profile: setProfile });
    applied.push(r.error ? `profile NOT set: ${r.error}` : r.changed ? `config.yaml reconciler.profile: ${setProfile} (backup ${path.basename(r.backup)})` : `config.yaml already on profile ${setProfile}`);
  }
  let rebuilt = false;
  if (!noBuild) {
    const ui = api.uiBuildState();
    if (ui.stale) {
      const b = await api.buildUi({ env }); rebuilt = b.ok;
      applied.push(b.ok ? `ui/dist rebuilt (${ui.reason})` : `ui build FAILED: ${b.output}`);
      if (!b.ok) return applied;
    }
  }
  // engine: down -> ensure; safe without a real crash loop -> a planned restart; a config change applies live (refreshConfig).
  let l = api.leaderState({ env });
  const numbers = api.reconcilerNumbers();
  const plan = crashLoopPlan(api.crashLoopRecord({ env, windowMs: numbers.crashLoop.windowMs }), { max: numbers.crashLoop.max, windowMs: numbers.crashLoop.windowMs });
  const live = safeRun(() => api.status({ env }), null);
  const shadowed = live ? safeShadowOf(live) : [];
  if (l.fresh && (l.safe || shadowed.length) && !plan.looping) {
    const r = await api.restartEngine({ env });
    applied.push(`engine restarted out of safe mode (${l.safeModes?.length ? `controller_modes: ${l.safeModes.join(', ')}` : 'configured active but running shadow'}${shadowed.length ? `: ${shadowed.join(', ')}` : ''}): ${r.action} pid ${r.pid ?? '-'}${r.safe ? ' SAFE (real crash loop)' : ''}`);
  } else if (l.fresh && (l.safe || shadowed.length)) applied.push(`engine left in safe mode: a real crash loop is on record (${plan.starts.length} abnormal start(s) in the window)`);
  else if (!l.fresh) { const r = await api.ensure({ env, reason: 'start' }); applied.push(`engine ${r.action}${r.pid ? ` pid ${r.pid}` : ''}${r.safe ? ' SAFE (real crash loop)' : ''}`); }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) { l = api.leaderState({ env }); if (l.fresh) break; await api.sleep(3000); }
  // services that are down (never Orca)
  const probes = await api.probeServices();
  for (const p of probes) {
    if (p.ok || NOT_ACTUATED.has(p.name) || !serviceWanted(p.name, safeRun(() => api.loadConfig(), null)) || p.name.startsWith('sched-task:') || !p.entry.restart) continue;
    const r = await api.startService(p.name);
    applied.push(`service ${p.name}: ${r.ok ? 'start requested' : `start FAILED ${String(r.error ?? r.output ?? '').slice(0, 120)}`}`);
  }
  if (rebuilt && probes.find((p) => p.name === 'harness-ui')?.ok) { const r = await api.startService('harness-ui'); applied.push(`service harness-ui restarted to serve the new build: ${r.ok ? 'ok' : 'FAILED'}`); }
  // Supervisor seat (kernel mode only) and the Kernel seats of running workflows
  const orcaUp = (await api.probeOrcaAsync({ timeoutMs: 30_000 })).ok;
  const config = safeRun(() => api.loadConfig(), null);
  if (orcaUp) {
    if (api.supervisorMode({ env, config }) === 'kernel') {
      const r = await api.json([path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--json'], { timeoutMs: 300_000 });
      applied.push(`Supervisor seat: ${r?.action ?? 'no answer'}${r?.ok === false ? ` (${String(r.error ?? r.reason ?? '').slice(0, 120)})` : ''}`);
    }
    if (workflowSeats) {
      const seats = await api.kernelSeatItems({ orcaOk: true, config, repair: true });
      applied.push(`Kernel seats: ${seats.filter((i) => i.status === 'green').length}/${seats.length} live after repair`);
    }
  } else applied.push('Orca is not reachable: services, Supervisor seat and Kernel seats were not touched (open Orca, run start again)');
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
    while (!summarize(items).ok && now() < until) { await wait(10_000); items = await read(readOptions); }
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
