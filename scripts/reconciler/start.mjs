#!/usr/bin/env node
// scripts/reconciler/start.mjs — `start`: bring EVERYTHING on this host up (except defining or starting new workflows)
// and print ONE green/red checklist. Owner ask 2026-09-29; skill skills/start/SKILL.md (skills/restart is a wrapper).
//
//   node scripts/reconciler/start.mjs [--check] [--json] [--wait <sec>] [--no-apply-profile] [--no-build]
//                                     [--retire-stale-ledgers]
//
// Order of an apply run:
//   1. preflight (read-only): bundled SQLite >= 3.51.3, machine.sqlite quick_check, registered ledgers that are temp/test
//      paths or missing files, legacy in-repo .starciwork/runtime.sqlite stores, kernel/supervisor pins whose model the
//      agent card cannot attest (modelAttestation.displayNames), Orca reachable;
//   2. the operational profile: config.yaml reconciler.profile operational (job/host/workflow/resource active; gc/fleet/
//      learning shadow unless configured). Applied unless --no-apply-profile (config.yaml is backed up first);
//   3. ui/dist rebuilt (npm run build in ui/) when any ui source is newer than the build, before harness-ui is started;
//   4. the reconciler engine: started when down, restarted (planned, never a crash) when it runs --safe without a real
//      crash loop behind it;
//   5. every host service that is down, started through services.mjs startService (Orca is never launched: the owner does);
//   6. the Supervisor seat (start-supervisor.mjs, only when supervisor.mode is kernel) and every running workflow's
//      Kernel seat (scripts/kernel/watchdog.mjs --once --repair, the Host controller's own call);
//   7. the checklist, re-read until green or --wait seconds (default 120) pass.
// --check runs only the read-only checklist (steps 1 and 7, one pass). Exit 0 only when every REQUIRED item is green.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { readMachine, withMachine } from '../../engine/machine-db.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { ensure, crashLoopPlan, crashLoopRecord, leaderState, restartEngine, status } from './boot.mjs';
import { PROFILES, REQUIRED_ACTIVE, SKILL_ROOT, reconcilerConfig, reconcilerNumbers } from './state.mjs';
import { probeOrcaAsync, runChild, serviceRegistry, servicePorts, startService } from './services.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const MIN_SQLITE = '3.51.3';
export const PROFILE = 'operational';
/** Services `start` never launches itself: Orca is a GUI app (the owner opens it); the scheduled task is the owner's. */
const NOT_ACTUATED = new Set(['orca']);
const GROUPS = ['preflight', 'config', 'engine', 'controllers', 'services', 'seats', 'sla'];

/* ------------------------------------------------------------ items */

/** One checklist row. status green|red|warn; required rows decide the exit code, warn never does. */
export const item = (group, id, name, status, detail = '', { fix = null, required = true } = {}) => ({ group, id, name, status, required: required && status !== 'warn', detail, ...(fix && status !== 'green' ? { fix } : {}) });
const green = (group, id, name, detail, opts) => item(group, id, name, 'green', detail, opts);
const red = (group, id, name, detail, fix, opts) => item(group, id, name, 'red', detail, { fix, ...opts });
const warn = (group, id, name, detail, fix) => item(group, id, name, 'warn', detail, { fix, required: false });

/** -1 | 0 | 1 comparing dotted numeric versions. Pure. */
export function cmpVersion(a, b) {
  const x = String(a).split('.').map((n) => Number.parseInt(n, 10) || 0), y = String(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
}

export const sqliteItem = (version = process.versions.sqlite, node = process.version) => (cmpVersion(version, MIN_SQLITE) >= 0
  ? green('preflight', 'node-sqlite', 'Node bundled SQLite', `${version} (node ${node})`)
  : red('preflight', 'node-sqlite', 'Node bundled SQLite', `${version} is older than ${MIN_SQLITE} (WAL-reset bug; node ${node})`, `upgrade Node to a release that bundles SQLite >= ${MIN_SQLITE}`));

/** A registered ledger that no product should live in: a temp or test path. Pure. */
export function isTempLedger(file, { tmp = os.tmpdir() } = {}) {
  const p = String(file ?? '').replace(/\\/g, '/').toLowerCase();
  const t = String(tmp).replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
  return Boolean(p) && (p.startsWith(`${t}/`) || /\/(?:temp|tmp)\//.test(p) || /prereq|starci-test|\/scratch\//.test(p));
}

/** The registered-ledger findings: [{ledgerId, name, file, problem: 'temp'|'missing'}]. Seams: exists, tmp. */
export function ledgerFindings(ledgers, { exists = (f) => fs.existsSync(f), tmp = os.tmpdir() } = {}) {
  const out = [];
  for (const l of ledgers ?? []) {
    if (l.state === 'retired') continue;
    if (isTempLedger(l.file, { tmp }) || isTempLedger(l.repoRoot, { tmp })) out.push({ ledgerId: l.ledgerId, name: l.name, file: l.file, problem: 'temp' });
    else if (!l.file || !exists(l.file)) out.push({ ledgerId: l.ledgerId, name: l.name, file: l.file ?? null, problem: 'missing' });
  }
  return out;
}

/** The pinned (agent, model) pairs of config.yaml kernel (group or single pin) and supervisor.kernel. Pure. */
export function configuredPins(config) {
  const pins = [];
  const add = (where, agent, model) => { if (agent && model) pins.push({ where, agent: String(agent), model: String(model) }); };
  const kernel = config?.kernel;
  if (Array.isArray(kernel?.group)) kernel.group.forEach((m, i) => add(`kernel.group[${i}]`, m?.agent, m?.model));
  else add('kernel', kernel?.agent, kernel?.model);
  const sup = config?.supervisor?.kernel;
  if (sup) add('supervisor.kernel', sup.agent, sup.model);
  return pins;
}

/** Pins whose agent card cannot attest the model: {where, agent, model, problem}. Seam: card(agent) -> parsed card | null. */
export function pinProblems(pins, { card = (agent) => { try { return parseYaml(fs.readFileSync(path.join(SKILL_ROOT, 'modules', 'models', 'agents', `${agent}.yaml`), 'utf8')); } catch { return null; } } } = {}) {
  const out = [];
  for (const pin of pins) {
    const c = card(pin.agent);
    if (!c) { out.push({ ...pin, problem: `no agent card modules/models/agents/${pin.agent}.yaml` }); continue; }
    const att = c.modelAttestation ?? {};
    if (att.mode === 'launch-flag') continue;
    if (att.displayNames && typeof att.displayNames === 'object' && !att.displayNames[pin.model])
      out.push({ ...pin, problem: `modules/models/agents/${pin.agent}.yaml modelAttestation.displayNames has no entry for ${pin.model}` });
  }
  return out;
}

/** The newest mtime under `root` (files only, node_modules and dist skipped), or 0. Seam: fs. */
export function newestMtime(root, { fsImpl = fs } = {}) {
  let newest = 0;
  const walk = (dir) => {
    let entries = [];
    try { entries = fsImpl.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else { try { newest = Math.max(newest, fsImpl.statSync(full).mtimeMs); } catch { /* gone */ } }
    }
  };
  walk(root);
  return newest;
}

/**
 * Whether ui/dist is older than its sources: any file under ui/src, or ui/package.json, ui/vite.config.*, ui/index.html,
 * ui/tsconfig.json newer than the newest dist file (or dist missing). {stale, reason, srcMs, distMs}. Seam: fs.
 */
export function uiBuildState({ uiDir = path.join(SKILL_ROOT, 'ui'), fsImpl = fs } = {}) {
  const distMs = newestMtime(path.join(uiDir, 'dist'), { fsImpl });
  const stat = (f) => { try { return fsImpl.statSync(path.join(uiDir, f)).mtimeMs; } catch { return 0; } };
  const loose = ['package.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'vite.config.mjs', 'vite.config.js'].map(stat);
  const srcMs = Math.max(newestMtime(path.join(uiDir, 'src'), { fsImpl }), ...loose);
  if (!distMs) return { stale: true, reason: 'ui/dist is missing', srcMs, distMs };
  if (srcMs > distMs) return { stale: true, reason: `a ui source is ${Math.round((srcMs - distMs) / 1000)}s newer than ui/dist`, srcMs, distMs };
  return { stale: false, reason: 'ui/dist is newer than every ui source', srcMs, distMs };
}

/** `npm run build` in ui/: {ok, output}. Seam: run. */
export function buildUi({ uiDir = path.join(SKILL_ROOT, 'ui'), run = spawnSync } = {}) {
  const r = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: uiDir, encoding: 'utf8', windowsHide: true, timeout: 900_000, shell: process.platform === 'win32' });
  return { ok: r.status === 0, output: String(r.stdout ?? '').concat(String(r.stderr ?? '')).trim().split(/\r?\n/).slice(-6).join(' | ').slice(0, 500) };
}

/* ------------------------------------------------------------ the operational profile */

/**
 * config.yaml text with `reconciler:` set to the operational profile: enabled, profile operational, and only the explicit
 * controller entries the profile does not itself run active (an explicit gc/fleet/learning setting survives; an explicit
 * shadow/off of job/host/workflow/resource is what the profile replaces). Returns {text, changed}. Pure.
 */
export function applyProfileText(text) {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^reconciler:\s*(?:#.*)?$/.test(l));
  let end = at < 0 ? lines.length : lines.length;
  if (at >= 0) for (let i = at + 1; i < lines.length; i += 1) if (/^\S/.test(lines[i])) { end = i; break; }
  let previous = {};
  if (at >= 0) { try { previous = parseYaml(lines.slice(at, end).join('\n'))?.reconciler ?? {}; } catch { previous = {}; } }
  const keep = Object.entries(previous.controllers ?? {}).filter(([n, v]) => !REQUIRED_ACTIVE.includes(n) && ['off', 'shadow', 'active'].includes(v?.mode));
  const block = ['reconciler:', '  enabled: true', `  profile: ${PROFILE}`, `  controllers: {${keep.map(([n, v]) => `${n}: {mode: ${v.mode}}`).join(', ')}}`];
  const next = at < 0 ? [...lines.filter((l, i, a) => !(i === a.length - 1 && l === '')), ...block, ''] : [...lines.slice(0, at), ...block, ...lines.slice(end)];
  const out = next.join(eol);
  return { text: out, changed: out !== text };
}

/** The config profile rows. `conf` is reconcilerConfig(); `raw` the config's own reconciler block. Pure. */
export function profileItems(conf, raw) {
  const fix = 'node scripts/reconciler/start.mjs (applies reconciler.profile: operational to config.yaml)';
  if (!conf.enabled) return [red('config', 'profile', 'reconciler config', 'reconciler.enabled is not true: no controller runs', fix)];
  if (conf.profile !== PROFILE) {
    const shadow = REQUIRED_ACTIVE.filter((n) => conf.controllers[n]?.mode !== 'active');
    return [shadow.length ? red('config', 'profile', 'reconciler profile', `profile ${conf.profile ?? 'none'}: ${shadow.map((n) => `${n}=${conf.controllers[n]?.mode ?? 'off'}`).join(' ')} - start needs them active`, fix)
      : green('config', 'profile', 'reconciler profile', `no profile, but ${REQUIRED_ACTIVE.join(', ')} are explicitly active`)];
  }
  const overridden = REQUIRED_ACTIVE.filter((n) => conf.controllers[n]?.mode !== 'active');
  return [overridden.length ? red('config', 'profile', 'reconciler profile', `operational, but controllers.${overridden.join(', ')} is set explicitly to ${overridden.map((n) => conf.controllers[n]?.mode).join('/')}`, `remove controllers.${overridden.join(', controllers.')} from config.yaml reconciler (or run start.mjs)`)
    : green('config', 'profile', 'reconciler profile', `operational (${Object.entries(PROFILES.operational).map(([n, m]) => `${n}=${m}`).join(' ')}${raw?.controllers && Object.keys(raw.controllers).length ? '; explicit overrides kept' : ''})`)];
}

/* ------------------------------------------------------------ engine + controllers */

/** Engine and controller rows from boot.mjs status(). Pure over the status. */
export function engineItems(s, { safeIsCrashLoop = false } = {}) {
  const l = s.leader;
  const items = [];
  if (!l.fresh) items.push(red('engine', 'engine', 'reconciler engine', l.holder ? `stale: leader ${l.holder} pid ${l.pid} heartbeat ${l.ageMs == null ? 'never' : `${Math.round(l.ageMs / 1000)}s`} old` : 'not running', 'node scripts/reconciler/start.mjs'));
  else items.push(green('engine', 'engine', 'reconciler engine', `leader ${l.holder} pid ${l.pid} epoch ${l.epoch} heartbeat ${Math.round(l.ageMs / 1000)}s ago${l.draining ? ' (draining a reload)' : ''}`));
  items.push(l.safe ? red('engine', 'safe-mode', 'engine safe mode', safeIsCrashLoop ? 'running --safe: a real crash loop is on record (every controller is forced shadow)' : 'running --safe (every controller forced shadow) without a crash loop behind it', 'node scripts/reconciler/start.mjs (restarts it normally)')
    : green('engine', 'safe-mode', 'engine safe mode', 'normal mode'));
  for (const name of Object.keys(s.modes)) {
    const m = s.modes[name];
    const want = PROFILES.operational[name];
    const required = REQUIRED_ACTIVE.includes(name);
    const shown = `${m.effective}${m.configured !== m.effective ? ` (configured ${m.configured})` : ''}`;
    if (required) items.push(m.effective === 'active' ? green('controllers', `mode:${name}`, `controller ${name}`, shown) : red('controllers', `mode:${name}`, `controller ${name}`, `${shown}, start needs active`,
      m.configured === 'active' ? 'the engine is not running it yet: node scripts/reconciler/start.mjs' : 'node scripts/reconciler/start.mjs (applies the operational profile)'));
    else items.push(m.effective === 'off' && want !== 'off' ? warn('controllers', `mode:${name}`, `controller ${name}`, `${shown}, profile expects ${want}`) : green('controllers', `mode:${name}`, `controller ${name}`, shown, { required: false }));
  }
  return items;
}

export function slaItems(s) {
  const open = s.violations?.open ?? 0;
  return [open ? warn('sla', 'violations', 'open violations / SLA', `${open} open violation(s) of ${s.violations.clocks ?? open} SLA clock(s): see the Supervisor digest`, 'node scripts/reconciler/boot.mjs --status')
    : green('sla', 'violations', 'open violations / SLA', `0 violated of ${s.violations?.clocks ?? 0} SLA clock(s)`, { required: false })];
}

/* ------------------------------------------------------------ services and seats */

const SERVICE_LABEL = { orca: 'Orca', 'harness-ui': 'harness UI (local /healthz)', 'harness-tunnel': 'harness tunnel (public /healthz)', 'ask-gateway': 'ask gateway', 'ask-tunnel': 'ask tunnel', 'telegram-bridge': 'Telegram bridge' };

/** Probe every registry service in parallel: [{name, ok, detail, entry}]. Seam: registry. */
export async function probeServices({ registry = serviceRegistry() } = {}) {
  const wanted = registry.filter((e) => e.kind === 'service');
  return Promise.all(wanted.map(async (entry) => {
    let p;
    try { p = await entry.probe(); } catch (error) { p = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
    return { name: entry.name, ok: p?.ok === true, unmanaged: p?.unmanaged === true, detail: p, entry };
  }));
}

/** Whether config.yaml wants a connector service at all (an `off` one is not required). Pure. */
export const serviceWanted = (name, config) => (name === 'ask-tunnel' ? (config?.connectors?.cloudflare?.mode ?? 'off') !== 'off' : name === 'telegram-bridge' ? config?.connectors?.telegram?.enabled === true : true);

export function serviceItems(probes, { publicUrl = null, config = null } = {}) {
  return probes.map((p) => {
    const label = SERVICE_LABEL[p.name] ?? p.name;
    const d = p.detail ?? {};
    const detail = p.ok ? `up${d.status ? ` (HTTP ${d.status}` : ''}${d.ms != null ? `${d.status ? ', ' : ' ('}${d.ms}ms` : ''}${d.status || d.ms != null ? ')' : ''}${p.name === 'harness-tunnel' && publicUrl ? ` ${publicUrl}` : ''}`
      : `down: ${d.error ?? d.status ?? d.verdict ?? (d.value ? (d.value.health?.problems?.[0] ?? (d.value.running === false ? 'not running' : JSON.stringify(d.value).slice(0, 120))) : 'no answer')}`;
    if (p.name.startsWith('sched-task:')) return p.ok ? green('services', p.name, `scheduled task ${p.name.slice(11)}`, `exists (${d.status ?? 'ok'})`, { required: false })
      : warn('services', p.name, `scheduled task ${p.name.slice(11)}`, p.unmanaged ? 'missing (unmanaged)' : 'not healthy', 'node scripts/reconciler/boot.mjs --install-task --apply (the owner)');
    if (p.ok) return green('services', p.name, label, detail);
    if (!serviceWanted(p.name, config)) return green('services', p.name, label, 'off in config.yaml connectors (not required)', { required: false });
    return red('services', p.name, label, detail, p.name === 'orca' ? 'open Orca yourself, then run start again (start never launches a GUI app)' : `node scripts/reconciler/services.mjs --start ${p.name}`);
  });
}

/** The Supervisor seat row from `start-supervisor.mjs --status --json` (or the mode). Pure. */
export function supervisorItem({ mode, statusJson, startJson = null }) {
  if (mode !== 'kernel') return green('seats', 'supervisor', 'Supervisor seat', 'chat mode: the owner\'s desktop chat is the Supervisor (nothing to start)');
  const h = statusJson?.health;
  if (startJson && startJson.ok === false) return red('seats', 'supervisor', 'Supervisor seat', `start-supervisor: ${startJson.action ?? 'failed'}${startJson.error || startJson.reason ? ` - ${String(startJson.error ?? startJson.reason).slice(0, 160)}` : ''}`, 'node scripts/supervisor/start-supervisor.mjs --json');
  if (h?.live) return green('seats', 'supervisor', 'Supervisor seat', `live${h.terminal ? ` (${h.terminal})` : ''}${h.starting ? ', starting' : ''}`);
  return red('seats', 'supervisor', 'Supervisor seat', h ? `not live: ${h.reason ?? 'unknown'}` : 'status unreadable', 'node scripts/supervisor/start-supervisor.mjs --json');
}

/** A Kernel seat row from a watchdog `--once --json` answer. Pure. */
export function kernelSeatItem({ ledger, workflowId, answer, seatState }) {
  const name = `Kernel seat ${workflowId}`;
  const id = `seat:kernel:${ledger}:${workflowId}`;
  const action = answer?.action ?? null;
  if (seatState === 'live' && answer?.ok !== false) return green('seats', id, name, `live (${action ?? 'ok'})`);
  return red('seats', id, name, `${seatState ?? 'unknown'}${action ? ` (${action})` : ''}${answer?.error ? `: ${String(answer.error).slice(0, 120)}` : ''}`,
    `node scripts/kernel/watchdog.mjs --repo <repo> --workflow ${workflowId} --once --repair --json`);
}

/* ------------------------------------------------------------ the read-only gather */

function safeRun(fn, fallback) { try { return fn(); } catch { return fallback; } }

async function json(cmd, args, { timeoutMs = 120_000, run = runChild } = {}) {
  const r = await run(cmd, args, { timeoutMs });
  const lines = String(r.stdout ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* next */ } }
  return r.timedOut ? { ok: false, error: 'timeout' } : null;
}

/**
 * Every checklist row, read-only: preflight, config, engine, controllers, services, seats, sla, ui build. Never throws
 * (a failing section is one red row). Seams (specs): env, config, machine reads, probes.
 */
export async function gather({ env = process.env, config = safeRun(() => loadConfig(), null), orca = true, seats = true } = {}) {
  const items = [];
  const push = (...rows) => items.push(...rows.flat());
  // preflight
  push(sqliteItem());
  let ledgers = [];
  try {
    const q = readMachine((m) => ({ check: m.db.prepare('PRAGMA quick_check').get()?.quick_check, ledgers: m.listLedgers() }), null, { env });
    if (!q) push(red('preflight', 'machine-db', 'machine.sqlite', 'not found or unreadable', 'node engine/machine-db.mjs (initialises it) or restore from D:/starci-archive/ledger-backups'));
    else { ledgers = q.ledgers; push(q.check === 'ok' ? green('preflight', 'machine-db', 'machine.sqlite quick_check', `ok, ${ledgers.length} ledger(s) registered`) : red('preflight', 'machine-db', 'machine.sqlite quick_check', String(q.check), 'restore machine.sqlite (owner-approved)')); }
  } catch (error) { push(red('preflight', 'machine-db', 'machine.sqlite quick_check', String(error?.message ?? error).slice(0, 200), 'restore machine.sqlite (owner-approved)')); }
  const found = ledgerFindings(ledgers);
  push(found.length ? warn('preflight', 'ledgers', 'registered ledgers', found.map((f) => `${f.name ?? f.ledgerId} (${f.problem}: ${f.file ?? '-'})`).join('; ').slice(0, 400), 'node scripts/reconciler/start.mjs --retire-stale-ledgers (retires temp/test ledgers via the machine-db API)')
    : green('preflight', 'ledgers', 'registered ledgers', 'no temp/test path and no missing file', { required: false }));
  const legacy = [];
  for (const l of ledgers) if (l.state !== 'retired' && l.repoRoot && fs.existsSync(path.join(l.repoRoot, '.starciwork', 'runtime.sqlite'))) legacy.push(l.repoRoot);
  push(legacy.length ? warn('preflight', 'legacy-stores', 'legacy in-repo runtime.sqlite', `${legacy.length} store(s): ${legacy.join(', ').slice(0, 300)}`, 'the ledger lives in %LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite; archive the in-repo copy')
    : green('preflight', 'legacy-stores', 'legacy in-repo runtime.sqlite', 'none', { required: false }));
  const pinBad = pinProblems(configuredPins(config));
  push(pinBad.length ? red('preflight', 'pins', 'kernel/supervisor model pins', pinBad.map((p) => `${p.where}: ${p.problem}`).join('; ').slice(0, 400), 'declare the display name in modules/models/agents/<agent>.yaml modelAttestation.displayNames')
    : green('preflight', 'pins', 'kernel/supervisor model pins', 'every pin resolves to a model its agent card can attest'));
  const orcaProbe = orca ? await probeOrcaAsync({ timeoutMs: 30_000 }) : { ok: null };
  // config + engine + controllers + sla
  const raw = config?.reconciler ?? null;
  push(profileItems(reconcilerConfig({ config }), raw));
  const s = status({ env });
  const plan = crashLoopPlan(safeRun(() => crashLoopRecord({ env, windowMs: reconcilerNumbers().crashLoop.windowMs }), { starts: [] }), { max: reconcilerNumbers().crashLoop.max, windowMs: reconcilerNumbers().crashLoop.windowMs });
  push(s.ok ? engineItems(s, { safeIsCrashLoop: plan.looping }) : red('engine', 'engine', 'reconciler engine', `status unreadable: ${s.error}`, 'node scripts/reconciler/boot.mjs --status'), s.ok ? slaItems(s) : []);
  // services
  const probes = await probeServices();
  push(serviceItems(probes, { publicUrl: safeRun(() => servicePorts().harnessPublicUrl, null), config }));
  const ui = uiBuildState();
  push(ui.stale ? red('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason, 'node scripts/reconciler/start.mjs (runs npm run build in ui/)') : green('services', 'ui-build', 'harness UI build (ui/dist)', ui.reason));
  // seats
  const mode = safeRun(() => (env.STARCI_SUPERVISOR_MODE || config?.supervisor?.mode || 'chat'), 'chat');
  if (mode === 'kernel' && seats && orcaProbe.ok) {
    const st = await json(process.execPath, [path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--status', '--json'], { timeoutMs: 90_000 });
    push(supervisorItem({ mode, statusJson: st }));
  } else push(mode === 'kernel' ? red('seats', 'supervisor', 'Supervisor seat', orca ? 'Orca is not reachable' : 'not checked', 'open Orca, then run start again') : supervisorItem({ mode }));
  push(orcaProbe.ok === false ? red('preflight', 'orca', 'Orca reachable', `${orcaProbe.verdict}${orcaProbe.error ? `: ${orcaProbe.error}` : ''}`, 'open Orca yourself, then run start again') : orcaProbe.ok ? green('preflight', 'orca', 'Orca reachable', `${orcaProbe.terminals ?? 0} terminal(s)`) : []);
  if (seats) push(await kernelSeatItems({ orcaOk: orcaProbe.ok !== false, config }));
  return items;
}

/** Every running workflow of every managed repo, its Kernel seat read through the watchdog's read-only pass. */
export async function kernelSeatItems({ orcaOk = true, config = null, repair = false } = {}) {
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
    const args = [path.join(SKILL_ROOT, 'scripts', 'kernel', 'watchdog.mjs'), '--repo', repo, '--workflow', workflowId, '--once', '--json', ...(repair ? ['--repair'] : [])];
    const answer = await json(process.execPath, args, { timeoutMs: 300_000 });
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

export function renderText(items, { applied = [] } = {}) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Apply the operational profile to config.yaml (backup first). {changed, backup} or {error}. */
export function applyProfileFile({ file = path.join(SKILL_ROOT, 'config.yaml'), now = Date.now() } = {}) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { changed: false, error: `${file} is not readable` }; }
  const out = applyProfileText(text);
  if (!out.changed) return { changed: false };
  const backup = `${file}.bak-${new Date(now).toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, out.text);
  return { changed: true, backup };
}

async function up(opts) {
  const applied = [];
  const { env = process.env, waitMs, noProfile, noBuild, retire } = opts;
  if (retire) {
    const stale = ledgerFindings(readMachine((m) => m.listLedgers(), [], { env })).filter((f) => f.problem === 'temp');
    if (stale.length) withMachine((m) => { for (const f of stale) m.setLedgerState(f.ledgerId, 'retired', { reason: 'start --retire-stale-ledgers: temp/test path' }); }, { env });
    applied.push(`retired ${stale.length} temp/test ledger(s)${stale.length ? `: ${stale.map((f) => f.name ?? f.ledgerId).join(', ')}` : ''}`);
  }
  if (!noProfile) {
    const r = applyProfileFile();
    applied.push(r.error ? `profile NOT applied: ${r.error}` : r.changed ? `config.yaml reconciler.profile: ${PROFILE} (backup ${path.basename(r.backup)})` : `config.yaml already on profile ${PROFILE}`);
  }
  let rebuilt = false;
  if (!noBuild) {
    const ui = uiBuildState();
    if (ui.stale) { const b = buildUi(); rebuilt = b.ok; applied.push(b.ok ? `ui/dist rebuilt (${ui.reason})` : `ui build FAILED: ${b.output}`); }
  }
  // engine: down -> ensure; safe without a real crash loop -> a planned restart; a config change applies live (refreshConfig).
  let l = leaderState({ env });
  const numbers = reconcilerNumbers();
  const plan = crashLoopPlan(crashLoopRecord({ env, windowMs: numbers.crashLoop.windowMs }), { max: numbers.crashLoop.max, windowMs: numbers.crashLoop.windowMs });
  if (l.fresh && l.safe && !plan.looping) { const r = await restartEngine({ env }); applied.push(`engine restarted out of safe mode: ${r.action} pid ${r.pid ?? '-'}`); }
  else if (!l.fresh) { const r = await ensure({ env, reason: 'start' }); applied.push(`engine ${r.action}${r.pid ? ` pid ${r.pid}` : ''}${r.safe ? ' SAFE (real crash loop)' : ''}`); }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) { l = leaderState({ env }); if (l.fresh) break; await sleep(3000); }
  // services that are down (never Orca)
  const probes = await probeServices();
  for (const p of probes) {
    if (p.ok || NOT_ACTUATED.has(p.name) || !serviceWanted(p.name, safeRun(() => loadConfig(), null)) || p.name.startsWith('sched-task:') || !p.entry.restart) continue;
    const r = await startService(p.name);
    applied.push(`service ${p.name}: ${r.ok ? 'start requested' : `start FAILED ${String(r.error ?? r.output ?? '').slice(0, 120)}`}`);
  }
  if (rebuilt && probes.find((p) => p.name === 'harness-ui')?.ok) { const r = await startService('harness-ui'); applied.push(`service harness-ui restarted to serve the new build: ${r.ok ? 'ok' : 'FAILED'}`); }
  // Supervisor seat (kernel mode only) and the Kernel seats of running workflows
  const orcaUp = (await probeOrcaAsync({ timeoutMs: 30_000 })).ok;
  const config = safeRun(() => loadConfig(), null);
  if (orcaUp) {
    if ((env.STARCI_SUPERVISOR_MODE || config?.supervisor?.mode || 'chat') === 'kernel') {
      const r = await json(process.execPath, [path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--json'], { timeoutMs: 300_000 });
      applied.push(`Supervisor seat: ${r?.action ?? 'no answer'}${r?.ok === false ? ` (${String(r.error ?? r.reason ?? '').slice(0, 120)})` : ''}`);
    }
    const seats = await kernelSeatItems({ orcaOk: true, config, repair: true });
    applied.push(`Kernel seats: ${seats.filter((i) => i.status === 'green').length}/${seats.length} live after repair`);
  } else applied.push('Orca is not reachable: services, Supervisor seat and Kernel seats were not touched (open Orca, run start again)');
  return applied;
}

export async function main(argv = process.argv.slice(2)) {
  const has = (f) => argv.includes(f);
  const wait = argv.indexOf('--wait');
  const waitMs = Math.max(0, (Number(wait >= 0 ? argv[wait + 1] : 120) || 120) * 1000);
  const opts = { waitMs, noProfile: has('--no-apply-profile'), noBuild: has('--no-build'), retire: has('--retire-stale-ledgers') };
  let applied = [];
  if (!has('--check')) applied = await up(opts);
  let items = await gather({ config: safeRun(() => loadConfig(), null) });
  if (!has('--check')) {
    const until = Date.now() + waitMs;
    while (!summarize(items).ok && Date.now() < until) { await sleep(10_000); items = await gather({ config: safeRun(() => loadConfig(), null) }); }
  }
  const summary = summarize(items);
  console.log(has('--json') ? JSON.stringify({ ok: summary.ok, summary, applied, items }) : renderText(items, { applied }));
  process.exitCode = summary.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) await main();
