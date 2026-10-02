#!/usr/bin/env node
// gate-stability.mjs — would a gate change newly fail work the live workflows already accepted?
//
// Owner ruling 2026-09-28 ("Freeze the drawing rules"): a gate or checker change of a frozen op family
// (modules/kernel/contract-freeze.yaml) is released to running workflows only at a release point the Supervisor
// decides (api contract-release). To decide it, the land gate (scripts/supervisor/land.mjs) runs this report when a
// land touches the family's gatePaths or registers a change that adds checks/codes for it: the family's gates, as
// the BASE tree and as the CANDIDATE tree have them, over the latest accepted leg (newest succeeded)
// of the family op in every live workflow of every ledger on this host's registry - read-only. A flip is a leg the
// base gates pass and the candidate gates fail; newFindings are the candidate findings the base did not report.
//
//   node scripts/supervisor/gate-stability.mjs --family <op> --tree <gate tree> [--ledger <runtime.sqlite>]... [--json]
//     one side: the findings of --tree's gates (default this tree) on the accepted legs
//   node scripts/supervisor/gate-stability.mjs --family <op> --base <tree> --head <tree> [--ledger <file>]... [--json]
//     both sides and the flips (each side runs in its own process, so each tree's modules load their own data)
// Exit 0 always when it could run (a report, never a refusal), 2 on bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineFileFor, readMachine } from '../../engine/db/machine.mjs';
import { loadContractFreeze } from '../machine/contract-version.mjs';
import { parseJson } from '../lib/json.mjs';
import { asList } from '../lib/list.mjs';
import { isMain } from '../lib/is-main.mjs';

const selfFile = fileURLToPath(import.meta.url);
const SELF_ROOT = path.resolve(path.dirname(selfFile), '..', '..');

/** The ledger files of this host's registry (machine.sqlite `ledgers`) that still exist. */
function registeredLedgers({ machine = machineFileFor() } = {}) {
  if (!fs.existsSync(machine)) return [];
  return readMachine((m) => m.listLedgers().map((l) => l.file).sort(), [], { file: machine }).filter((file) => fs.existsSync(file));
}

/** The latest accepted leg of `family` per live workflow of one ledger: [{workflowId, jobId, attempt, files[]}]. */
function acceptedLegsOf(ledgerFile, family) {
  let db;
  try { db = openLedgerReader(ledgerFile); } catch { return []; }
  try {
    const out = [];
    const workflows = db.prepare("SELECT workflow_id FROM workflows WHERE archived_at IS NULL AND (phase IS NULL OR phase<>'finished') ORDER BY created_at").all();
    for (const { workflow_id: workflowId } of workflows) {
      const jobs = db.prepare("SELECT job_id,op_id,try_no AS attempt,payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND status='succeeded' ORDER BY created_at DESC,job_id DESC").all(workflowId, family);
      const job = jobs[0];
      if (!job) continue;
      const payload = parseJson(job.payload_json, {}) ?? {};
      const files = [...asList(payload.owned_paths)];
      for (const r of db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND job_id=?').all(workflowId, job.job_id)) files.push(...asList(parseJson(r.report_json, {})?.files));
      out.push({ workflowId, jobId: job.job_id, attempt: job.attempt, files: [...new Set(files.filter((f) => typeof f === 'string' && f.trim()))] });
    }
    return out;
  } catch { return []; } finally { db.close(); }
}

/** One side: the findings of `tree`'s gates on the accepted legs. {tree, family, gates[], legs:[{ledger, repo, workflowId, jobId, attempt, findings[], errors[]}]} */
export async function gateSide({ tree = SELF_ROOT, family, ledgers = registeredLedgers(), gates = null }) {
  const freeze = loadContractFreeze(tree, { file: path.join(tree, 'modules', 'kernel', 'contract-freeze.yaml') });
  const spec = gates ?? freeze.families.find((f) => f.family === family)?.gates ?? [];
  const fns = [];
  for (const gate of spec) {
    const file = path.join(tree, gate.module);
    if (!fs.existsSync(file)) { fns.push({ gate, error: 'module absent in this tree' }); continue; }
    try { const mod = await import(pathToFileURL(file).href); fns.push({ gate, fn: mod[gate.export], error: typeof mod[gate.export] === 'function' ? null : 'export absent' }); } catch (error) { fns.push({ gate, error: String(error?.message ?? error).slice(0, 200) }); }
  }
  const legs = [];
  for (const ledger of ledgers) {
    const repo = path.dirname(path.dirname(path.resolve(ledger)));
    for (const leg of acceptedLegsOf(ledger, family)) {
      const findings = [], errors = [];
      for (const { gate, fn, error } of fns) {
        if (error || !fn) { errors.push(`${gate.module}#${gate.export}: ${error}`); continue; }
        try {
          const verdict = await fn({ repo, files: leg.files });
          for (const f of asList(verdict?.findings)) findings.push({ code: f.code, path: f.path ?? null, gate: `${gate.module}#${gate.export}` });
        } catch (e) { errors.push(`${gate.module}#${gate.export}: ${String(e?.message ?? e).slice(0, 200)}`); }
      }
      legs.push({ ledger, repo, workflowId: leg.workflowId, jobId: leg.jobId, attempt: leg.attempt, findings, errors });
    }
  }
  return { tree, family, gates: spec, legs };
}

const keyOf = (f) => `${f.code}|${f.path ?? ''}`;

/** Compare two sides: {family, legs, flips, newFindings, perLeg:[{workflowId, jobId, baseFindings, headFindings, flipped, newFindings[]}]}. */
export function compareSides(base, head) {
  const byLeg = new Map(base.legs.map((leg) => [`${leg.ledger}\0${leg.jobId}`, leg]));
  const perLeg = head.legs.map((leg) => {
    const before = byLeg.get(`${leg.ledger}\0${leg.jobId}`) ?? { findings: [], errors: ['no base side'] };
    const seen = new Set(before.findings.map(keyOf));
    const fresh = leg.findings.filter((f) => !seen.has(keyOf(f)));
    return { repo: leg.repo, workflowId: leg.workflowId, jobId: leg.jobId, attempt: leg.attempt, baseFindings: before.findings.length, headFindings: leg.findings.length,
      flipped: before.findings.length === 0 && leg.findings.length > 0 && !before.errors.length, newFindings: fresh.map((f) => ({ code: f.code, path: f.path })),
      errors: [...before.errors.map((e) => `base: ${e}`), ...leg.errors.map((e) => `head: ${e}`)] };
  });
  return { family: head.family, legs: perLeg.length, flips: perLeg.filter((l) => l.flipped).length, newlyFailing: perLeg.filter((l) => l.newFindings.length).length,
    newFindings: perLeg.reduce((n, l) => n + l.newFindings.length, 0), perLeg };
}

/** Run one side of `tree` in its own node process (this script from `runner`), returning the parsed side or {error}. */
function runSide({ runner = SELF_ROOT, tree, family, ledgers = null, gates = null, timeout = 180_000, env = process.env }) {
  const args = [path.join(runner, 'scripts', 'supervisor', 'gate-stability.mjs'), '--family', family, '--tree', tree, '--json', ...(ledgers ?? []).flatMap((l) => ['--ledger', l]),
    ...(gates ?? []).flatMap((g) => ['--gate', `${g.module}#${g.export}`])];
  const r = runNode(args, { cwd: runner, timeout, env, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { error: String(r.stderr || r.error?.message || `exit ${r.status}`).trim().slice(-400) };
  return parseJson(r.stdout.trim().split(/\r?\n/).pop(), null) ?? { error: 'unparseable side output' };
}

/**
 * Both sides and the comparison; `runner` is the tree whose copy of this script runs both. Both sides run the gates
 * the HEAD tree's contract-freeze.yaml names (a module the base tree lacks reads as an error there, never a flip).
 */
export function gateStability({ runner = SELF_ROOT, base, head, family, ledgers = null, env = process.env }) {
  const gates = loadContractFreeze(head, { file: path.join(head, 'modules', 'kernel', 'contract-freeze.yaml') }).families.find((f) => f.family === family)?.gates ?? [];
  if (!gates.length) return { family, error: `no gates for ${family} in ${head}/modules/kernel/contract-freeze.yaml` };
  const b = runSide({ runner, tree: base, family, ledgers, gates, env });
  const h = runSide({ runner, tree: head, family, ledgers, gates, env });
  if (b.error || h.error) return { family, error: b.error ? `base: ${b.error}` : `head: ${h.error}` };
  return compareSides(b, h);
}

async function main(argv) {
  const values = (name) => argv.flatMap((a, i) => (a === name && i + 1 < argv.length ? [argv[i + 1]] : []));
  const one = (name) => values(name)[0] ?? null;
  const family = one('--family'), json = argv.includes('--json');
  if (!family) { process.stderr.write('use: gate-stability.mjs --family <op> (--tree <dir> | --base <dir> --head <dir>) [--ledger <file>]... [--json]\n'); return 2; }
  const ledgers = values('--ledger').length ? values('--ledger').map((l) => path.resolve(l)) : null;
  if (one('--base') || one('--head')) {
    if (!one('--base') || !one('--head')) { process.stderr.write('--base and --head go together\n'); return 2; }
    const out = gateStability({ base: path.resolve(one('--base')), head: path.resolve(one('--head')), family, ledgers });
    process.stdout.write(json ? `${JSON.stringify(out)}\n` : `${out.error ? `gate-stability ${family}: ${out.error}` : `gate-stability ${family}: ${out.flips} of ${out.legs} accepted leg(s) would flip, ${out.newlyFailing} get new findings\n${out.perLeg.map((l) => `  ${l.workflowId} ${l.jobId}: ${l.baseFindings} -> ${l.headFindings}${l.flipped ? ' FLIP' : ''}${l.newFindings.length ? ` new ${[...new Set(l.newFindings.map((f) => f.code))].join(', ')}` : ''}`).join('\n')}`}\n`);
    return 0;
  }
  const gates = values('--gate').map((g) => { const [module, fn] = g.split('#'); return { module, export: fn }; }).filter((g) => g.module && g.export);
  const side = await gateSide({ tree: path.resolve(one('--tree') ?? SELF_ROOT), family, ...(ledgers ? { ledgers } : {}), ...(gates.length ? { gates } : {}) });
  process.stdout.write(json ? `${JSON.stringify(side)}\n` : `${side.legs.map((l) => `${l.workflowId} ${l.jobId}: ${l.findings.length} finding(s)${l.errors.length ? ` errors ${l.errors.join('; ')}` : ''}`).join('\n')}\n`);
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 2; });
