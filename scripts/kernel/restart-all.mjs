#!/usr/bin/env node
// restart-all.mjs — resume every workflow after a reboot or an Orca restart,
// in one command the owner or the supervisor runs (skills/restart/SKILL.md).
//
//   node scripts/kernel/restart-all.mjs [--repo <path>]... [--wait-ms <ms>]
//       [--supervisor <id> [--label <text>]] [--no-dedupe] [--dry-run] [--json]
//
// Steps, each reported:
//   1. Orca must answer. It is never launched from here: when it does not
//      answer the owner is told to open it and nothing else runs (exit 2).
//   2. resume-all with the stray-terminal dedupe (connectors, Telegram bridge,
//      stall alert, watchdogs; scripts/kernel/resume-all.mjs).
//   3. Wait (up to --wait-ms, default 8 minutes) until every running workflow
//      has exactly one live kernel: its watchdog relaunches or adopts it
//      (start-workflow). Read-only: poll.mjs kernelState and the Orca tree
//      (DUPLICATE_KERNEL / DEAD_KERNEL).
//   4. api reconcile --orphan-kernel-jobs per ledger (kernel seats of finished
//      or archived workflows), then api reconcile --orca-tasks (the Run of each
//      workflow bound to its live kernel, open Tasks of dead ops closed).
//   5. Dead op workers are the kernels' to recover (api reconcile
//      --dead-worker); this only counts them from api status.
//   6. The supervisor channel: heartbeat (or register with --label) --supervisor
//      <id>, else heartbeat every registered supervisor (channel.mjs).
//   7. A short Vietnamese summary (the owner's language), or --json.
// Ledger writes happen only through the api verbs it runs. --dry-run writes
// nothing and closes nothing (resume-all and both reconciles run dry).
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resumeAll, resumeRepos, runningWorkflows, orcaReady } from './resume-all.mjs';
import { withLedgerRead } from '../connectors/lib.mjs';
import { kernelState, orcaTree } from '../supervisor/poll.mjs';
import { getSupervisor, heartbeatSupervisor, listSupervisors, registerSupervisor } from '../connectors/telegram-bridge.mjs';

const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..');
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'api.mjs');

export const DEFAULT_WAIT_MS = 8 * 60_000;
export const POLL_MS = 20_000;
const LIVE_KERNEL_STATES = new Set(['active', 'turn-idle', 'staged-input', 'queued-input', 'wedged', 'unknown']);
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Run one api verb with --json; {ok, status, out, stderr}. */
export function runApi(args, { env = process.env } = {}) {
  const r = spawnSync(process.execPath, [apiFile, ...args, '--json'], { cwd: skillRoot, encoding: 'utf8', windowsHide: true, timeout: 600_000, env });
  let out = null;
  try { out = JSON.parse(String(r.stdout ?? '').trim()); } catch { out = null; }
  return { ok: r.status === 0 && out?.ok !== false, status: r.status, out, stderr: String(r.stderr ?? '').replace(/^.*ExperimentalWarning.*$|^.*trace-warnings.*$/gm, '').trim().slice(0, 600) };
}

/** One kernel census over the running workflows: [{workflowId, repo, terminal, state, live, duplicate}]. Read-only. */
export function kernelCensus(repos, { state = kernelState, tree = orcaTree, workflowsOf = runningWorkflows } = {}) {
  const rows = [];
  for (const repo of repos) {
    const workflows = workflowsOf(repo);
    if (!workflows.length) continue;
    const found = withLedgerRead(repo, (db) => {
      const findings = (() => { try { return tree(db, { repo }).findings ?? []; } catch { return []; } })();
      return workflows.map(({ workflowId }) => {
        const k = state(db, workflowId);
        const duplicate = findings.find((f) => f.code === 'DUPLICATE_KERNEL' && f.workflowId === workflowId) ?? null;
        return { workflowId, repo, terminal: k.terminal ?? null, state: k.state, live: LIVE_KERNEL_STATES.has(k.state),
          ...(duplicate ? { duplicate: duplicate.terminals ?? [] } : {}) };
      });
    }, workflows.map(({ workflowId }) => ({ workflowId, repo, terminal: null, state: 'ledger-unreadable', live: false })));
    rows.push(...found);
  }
  return rows;
}

/** Census until every running workflow has one live kernel, or waitMs passes. */
export function waitForKernels(repos, { waitMs = DEFAULT_WAIT_MS, pollMs = POLL_MS, census = kernelCensus, sleep = sleepSync, now = Date.now } = {}) {
  const started = now();
  let rows = census(repos), rounds = 1;
  while (rows.some((r) => !r.live || r.duplicate) && now() - started < waitMs) {
    sleep(Math.min(pollMs, Math.max(0, waitMs - (now() - started))));
    rows = census(repos);
    rounds += 1;
  }
  return { ready: rows.every((r) => r.live && !r.duplicate), waitedMs: now() - started, rounds, kernels: rows };
}

/** Heartbeat (or register) the supervisor channel. Never throws. */
export function touchSupervisors({ id = null, label = null, repos = [] } = {}, deps = {}) {
  const get = deps.get ?? getSupervisor, beat = deps.heartbeat ?? heartbeatSupervisor, reg = deps.register ?? registerSupervisor, list = deps.list ?? listSupervisors;
  try {
    if (id) {
      if (get(id)) { const r = beat(id); return [{ id, action: 'heartbeat', ok: Boolean(r) }]; }
      if (label) { reg({ id, label, repos }); return [{ id, action: 'registered', ok: true }]; }
      return [{ id, action: 'not-registered', ok: false, hint: `node scripts/supervisor/channel.mjs register --id ${id} --label <text>` }];
    }
    return list().map((sup) => ({ id: sup.id, action: 'heartbeat', ok: Boolean(beat(sup.id)) }));
  } catch (error) {
    return [{ id, action: 'failed', ok: false, error: String(error?.message ?? error) }];
  }
}

/** The whole restart. Every host seam is injectable (specs). */
export function restartAll({ repos, missing = [], dryRun = false, dedupe = true, waitMs = DEFAULT_WAIT_MS, supervisor = {}, deps = {} } = {}) {
  const probe = deps.probe ?? orcaReady;
  const resume = deps.resume ?? resumeAll;
  const api = deps.api ?? runApi;
  const wait = deps.wait ?? waitForKernels;
  const workflowsOf = deps.workflowsOf ?? runningWorkflows;
  const touch = deps.touch ?? touchSupervisors;
  const result = { ok: true, dryRun, repos, missing, orca: null, resume: null, kernels: null, orphanKernelJobs: [], orcaTasks: [], deadWorkers: [], supervisors: [] };
  result.orca = probe() ? 'running' : 'not-running';
  if (result.orca !== 'running') { result.ok = false; return result; }

  result.resume = resume({ repos, missing, dryRun, dedupe: dedupe ? true : false });
  if (!result.resume.ok) result.ok = false;

  result.kernels = dryRun ? wait(repos, { waitMs: 0 }) : wait(repos, { waitMs });
  if (!result.kernels.ready && !dryRun) result.ok = false;

  const dry = dryRun ? ['--dry-run'] : [];
  for (const repo of repos) {
    const orphans = api(['reconcile', '--repo', repo, '--orphan-kernel-jobs', ...dry]);
    result.orphanKernelJobs.push({ repo, ok: orphans.ok, reconciled: orphans.out?.reconciled ?? [], ...(orphans.ok ? {} : { error: orphans.stderr || orphans.out?.error }) });
    const tasks = api(['reconcile', '--repo', repo, '--orca-tasks', ...dry]);
    result.orcaTasks.push({ repo, ok: tasks.ok, totals: tasks.out?.totals ?? null, ...(tasks.ok ? {} : { error: tasks.stderr || tasks.out?.error }) });
    for (const { workflowId } of workflowsOf(repo)) {
      const status = api(['status', '--repo', repo, '--workflow', workflowId]);
      const dead = status.out?.frontier?.deadWorkerJobs ?? null;
      result.deadWorkers.push({ repo, workflowId, count: Array.isArray(dead) ? dead.length : null, jobs: dead ?? [], ...(status.out ? {} : { error: status.stderr }) });
    }
  }
  if (result.orphanKernelJobs.some((o) => !o.ok) || result.orcaTasks.some((o) => !o.ok)) result.ok = false;

  result.supervisors = dryRun ? [] : touch({ ...supervisor, repos });
  return result;
}

const short = (wf) => String(wf).replace(/^wf-/, '').replace(/-[a-z0-9]{8}$/i, '');

/** The owner-facing summary, in Vietnamese (config.yaml language vi). */
export function summaryVi(r) {
  if (r.orca !== 'running') return 'Orca chưa chạy. Thầy mở Orca (không cần mở tab nào), đợi cửa sổ lên hẳn, rồi chạy lại /restart.';
  const lines = [`Khởi động lại ${r.dryRun ? '(chạy thử, không đổi gì) ' : ''}— ${r.ok ? 'xong' : 'CÓ VIỆC CẦN XEM'}.`];
  const d = r.resume?.dedupe;
  if (d) lines.push(d.skipped ? `- Dọn terminal thừa: bỏ qua (${d.skipped}).`
    : `- Dọn terminal thừa: ${r.dryRun ? 'sẽ đóng' : 'đã đóng'} ${d.closed.length}${d.closed.length ? ` (${d.closed.map((c) => c.tabTitle ?? c.paneTitle ?? c.handle).join('; ')})` : ''}${d.deferred.length ? `, hoãn ${d.deferred.length} vì đang có lệnh khởi chạy` : ''}${d.kept.length ? `, giữ ${d.kept.length} phiên không phải của StarCi` : ''}.`);
  const started = r.resume?.started?.length ?? 0, present = r.resume?.present?.length ?? 0;
  lines.push(`- Watchdog: ${present} đang chạy, ${r.dryRun ? 'sẽ khởi động' : 'đã khởi động'} ${started}${r.resume?.duplicate?.length ? `, ${r.resume.duplicate.length} workflow có 2 watchdog` : ''}.`);
  const k = r.kernels?.kernels ?? [];
  const live = k.filter((x) => x.live && !x.duplicate).length;
  lines.push(`- Kernel: ${live}/${k.length} workflow có đúng một kernel sống${r.kernels?.ready ? '' : ` — chưa ổn: ${k.filter((x) => !x.live || x.duplicate).map((x) => `${short(x.workflowId)} (${x.duplicate ? `trùng ${x.duplicate.length}` : x.state})`).join(', ')}`}.`);
  const orphans = r.orphanKernelJobs.flatMap((o) => o.reconciled);
  if (orphans.length) lines.push(`- Job kernel mồ côi (workflow đã xong): ${r.dryRun ? 'sẽ đóng' : 'đã đóng'} ${orphans.map((o) => o.jobId).join(', ')}.`);
  const t = r.orcaTasks.reduce((a, o) => ({ closed: a.closed + (o.totals?.closed ?? 0), unclosable: a.unclosable + (o.totals?.unclosable ?? 0), rebound: a.rebound + (o.totals?.rebound ?? 0) }), { closed: 0, unclosable: 0, rebound: 0 });
  lines.push(`- Task Orca của op đã chết: ${r.dryRun ? 'sẽ đóng' : 'đã đóng'} ${t.closed}${t.rebound ? `, gắn lại ${t.rebound} Run vào kernel mới` : ''}${t.unclosable ? `, ${t.unclosable} không đóng được (Run không còn kernel)` : ''}.`);
  const dead = r.deadWorkers.filter((w) => w.count);
  lines.push(dead.length ? `- Worker op đã chết (kernel tự xử lý): ${dead.map((w) => `${short(w.workflowId)} ${w.count}`).join(', ')}.` : '- Worker op đã chết: không có.');
  if (r.supervisors.length) lines.push(`- Kênh supervisor: ${r.supervisors.map((s) => `${s.id ?? '?'} ${s.action}${s.ok ? '' : ' (lỗi)'}`).join(', ')}.`);
  const errors = [...r.orphanKernelJobs, ...r.orcaTasks].filter((o) => !o.ok).map((o) => `${o.repo}: ${String(o.error ?? '').slice(0, 160)}`);
  if (errors.length) lines.push(`- Lỗi: ${errors.join(' | ')}`);
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const has = (name) => argv.includes(`--${name}`);
  const values = (name) => argv.flatMap((arg, i) => (arg === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
  if (has('help') || has('h')) {
    console.log('use: node scripts/kernel/restart-all.mjs [--repo <path>]... [--wait-ms <ms>] [--supervisor <id> [--label <text>]] [--no-dedupe] [--dry-run] [--json]');
  } else {
    const { repos, missing } = resumeRepos({ extra: values('repo') });
    const result = restartAll({ repos, missing, dryRun: has('dry-run'), dedupe: !has('no-dedupe'),
      waitMs: Number(values('wait-ms')[0]) >= 0 && values('wait-ms').length ? Number(values('wait-ms')[0]) : DEFAULT_WAIT_MS,
      supervisor: { id: values('supervisor')[0] ?? null, label: values('label')[0] ?? null } });
    console.log(has('json') ? JSON.stringify({ ...result, summary: summaryVi(result) }) : summaryVi(result));
    process.exitCode = result.orca !== 'running' ? 2 : result.ok ? 0 : 1;
  }
}
