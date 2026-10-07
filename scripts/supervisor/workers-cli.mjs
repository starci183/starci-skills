// CLI dispatch for the Supervisor's worker job and board commands.
import fs from 'node:fs';
import { readEnv } from '../lib/env.mjs';

export async function runWorkersCli(api) {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  const out = (r, text = null) => { console.log(workerOutput(r, text, asJson)); if (r?.ok === false) process.exitCode = 1; };
  if (!verb || has('help')) { console.log('use: starci supervisor workers create|spawn|stage|report|list|cap|show|cancel|ack|cleanup ... (see the header)'); return; }
  if (['list', 'cap', 'show'].includes(verb)) return readWorkerCommand(verb, value, out, api);
  const m = api.openMachine();
  try {
    if (verb === 'spawn') return await runWorkerWriteCommand(verb, m, { has, value, out }, api);
    return runWorkerWriteCommand(verb, m, { has, value, out }, api);
  } finally { m.close(); }
}

function workerOutput(result, text, asJson) {
  if (asJson || !text) {
    const indent = asJson ? 0 : 2;
    return JSON.stringify(result, null, indent);
  }
  return text;
}

function readWorkerCommand(verb, value, out, api) {
  const { readSupervisor, workerBoard, supervisorSettings, jobsOf, ACTIVE_STATUSES, machineLoad, adaptiveCap, jobOf, reportOf } = api;
  if (verb === 'list') {
    const board = readSupervisor((m) => workerBoard(m), { active: [], queued: [], reported: [], recent: [] });
    const line = (j) => { const terminal = j.terminal ? ` ${j.terminal}` : ''; const report = j.report ? ` commit ${String(j.report.commit ?? '').slice(0, 9)}` : ''; const result = j.result ? ` ${JSON.stringify(j.result).slice(0, 120)}` : ''; return `  ${j.jobId} [${j.status}] ${j.cluster} ${j.agent ?? '-'} age ${j.ageMin}m${terminal}${report}${result}`; };
    return out(board, [`active ${board.active.length}`, ...board.active.map(line), `queued ${board.queued.length}`, ...board.queued.map(line),
      `reported (land queue) ${board.reported.length}`, ...board.reported.map(line), 'recent', ...board.recent.map(line)].join('\n'));
  }
  if (verb === 'cap') {
    const settings = supervisorSettings();
    const counts = readSupervisor((m) => ({ queued: jobsOf(m, ['queued']).length, running: jobsOf(m, ACTIVE_STATUSES).filter((j) => !j.payload.self).length }), { queued: 0, running: 0 });
    const cap = adaptiveCap({ ...settings.workers, ...counts, load: machineLoad() });
    return out(cap, `cap ${cap.cap} (${cap.reason}); running ${cap.running}, queued ${cap.queued}, free ${cap.free}; cpu ${Math.round(cap.load.cpuBusy * 100)}% free mem ${Math.round(cap.load.freeMem * 100)}%`);
  }
  return out(readSupervisor((m) => ({ job: jobOf(m, value('job')), report: reportOf(m, value('job')) }), null));
}

function runWorkerWriteCommand(verb, m, args, api) {
  switch (verb) {
    case 'create': return createWorkerCommand(m, args.value, args.out, api);
    case 'spawn': return spawnWorkerCommand(m, args.value, args.has, args.out, api);
    case 'stage': return stageWorkerCommand(m, args.value, args.has, args.out, api);
    case 'report': return reportWorkerCommand(m, args.value, args.out, api);
    case 'cancel': return args.out(api.cancelJob(m, { jobId: args.value('job'), reason: args.value('reason') ?? undefined }));
    case 'ack': return args.out(api.ackReport(m, { jobId: args.value('job'), reason: args.value('reason') }));
    case 'cleanup': return args.out(api.cleanupStaging(m, { jobId: args.value('job') }));
    default: return args.out({ ok: false, error: `unknown verb ${verb}` });
  }
}

function createWorkerCommand(m, value, out, api) {
  let brief = value('brief') ?? '';
  if (value('brief-file')) brief = fs.readFileSync(value('brief-file'), 'utf8');
  const r = api.createJob(m, { cluster: value('cluster'), title: value('title'), files: api.csv(value('files')), incidents: api.csv(value('incidents')), specs: api.csv(value('specs')), brief, agent: value('agent') });
  return out({ ok: true, created: r.created, jobId: r.job.job_id, status: r.job.status }, `${r.created ? 'created' : 'exists'} ${r.job.job_id} [${r.job.status}]`);
}

async function spawnWorkerCommand(m, value, has, out, api) {
  const r = await api.spawnWorkers(m, { jobId: value('job'), dryRun: has('dry-run') });
  api.supervisorLog('workers', `spawn: launched ${r.launched.length}, skipped ${r.skipped.length}, failed ${r.failed.length}`, { data: r });
  return out(r);
}

function stageWorkerCommand(m, value, has, out, api) {
  if (!has('self')) return out({ ok: false, error: 'stage is the Supervisor\'s own checkout: starci supervisor workers stage --self --name <slug> --files <csv>' });
  return out(api.stageSelf(m, { name: value('name') ?? 'change', files: api.csv(value('files')) }));
}

function reportWorkerCommand(m, value, out, api) {
  const summary = value('summary-file') ? fs.readFileSync(value('summary-file'), 'utf8') : value('summary') ?? '';
  const r = api.fileReport(m, { jobId: value('job'), outcome: value('outcome'), commit: value('commit'), specs: api.csv(value('specs')), summary,
    needs: api.csv(value('needs')), terminal: readEnv('ORCA_TERMINAL_HANDLE') ?? null });
  api.supervisorLog('workers', `report ${value('job')}: ${r.ok ? r.outcome : r.error}`, { level: r.ok ? 'info' : 'warn', data: r });
  return out(r);
}
