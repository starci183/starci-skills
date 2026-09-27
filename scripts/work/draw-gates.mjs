#!/usr/bin/env node
// draw-gates.mjs — every gate an interface.draw pass is judged by, run locally in one command BEFORE the drawer reports
// (lane op-draw, 2026-09-28). Measured 2026-09-27: 18 interface.draw jobs failed after the drawer reported, most on a
// gate it never ran or ran differently from the runtime (a strict validate of a whole ui tree, a hand-picked ui-proof
// score, the owner gate mistaken for a failure). This runs exactly what api settle and api check run, in their order,
// and prints the report.checks entries - each red one with `failing` (the implicated files), so api check attributes
// a red gate on a record outside the job's owned paths instead of spending the attempt on it.
//
//   node scripts/work/draw-gates.mjs --ui <ui-record-dir> --repo <product repo> [--files <a,b,...>] [--no-remeasure]
//        [--checks-out <file>] [--json]
//
// The gates (names are the report.checks names):
//   draw-acceptance   scripts/checks/draw-acceptance.mjs over the record dir and --files (what api settle judges:
//                     token-rendered shapes of ui.shapes, no data status, draw quality, DNA, taste, rationale, the
//                     loop). DRAW_NOT_OWNER_ACCEPTED is the owner gate, reported apart (owner-review), never a red gate.
//   draw-metrics      scripts/work/draw-loop-settle.mjs: every live part re-rendered and re-measured by the runtime
//                     (DRAW_METRICS_FAILED / DRAW_METRICS_UNVERIFIED / DRAW_FEEDBACK_UNADDRESSED). --no-remeasure
//                     skips it (it renders; the settle still runs it).
//   validate-strict   bin/starci.mjs validate <ui dir> --strict: each refused record is named in `failing`; a refusal
//                     in a child record outside the job's owned paths is attributed foreign by api check.
//   shell-conformance scripts/checks/shell-conformance.mjs <ui dir>.
//   draw-loop         every loop the live parts name has finished (loop.json outcome), and passed.
// Exit 0 when every gate is green (the owner gate may still be owed: then file the draw-review ask), 1 when one is
// red (fix it, or report blocked naming it - never pass), 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { drawAcceptanceFindings } from '../checks/draw-acceptance.mjs';
import { livePartsOf } from '../checks/draw-loop-coverage.mjs';
import { settleDrawMetricFindings } from './draw-loop-settle.mjs';

export const GATES_SCHEMA = 'starci/draw-gates@1';
export const OWNER_GATE_CODE = 'DRAW_NOT_OWNER_ACCEPTED';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const slash = (p) => String(p).split(path.sep).join('/');
const rel = (repo, p) => slash(path.relative(repo, p));
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** The command line a gate is re-run by (the evidence names it, api check records it). */
const cmd = (script, args) => `node ${slash(path.join(SKILL_ROOT, script))} ${args.join(' ')}`;

/** The repo-relative file a finding implicates: its path, else the record. */
const fileOf = (f, fallback) => (typeof f?.path === 'string' && f.path ? f.path.split('#')[0] : fallback);

/** Parse `<path>: <message> [CODE]` refusal lines (starci validate --json) into {file, code, message}. */
export function refusalsOf(lines, cwd, repo) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const m = /^(.+?\.(?:ya?ml|json)):\s*(.*?)(?:\s*\[([A-Z0-9_]+)\])?\s*$/.exec(String(line));
    if (!m) return { file: null, code: null, message: String(line) };
    return { file: rel(repo, path.resolve(cwd, m[1])), code: m[3] ?? null, message: m[2] };
  });
}

const spawnJson = (script, args, cwd) => {
  const r = spawnSync(process.execPath, [path.join(SKILL_ROOT, script), ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
  let doc = null;
  try { doc = JSON.parse(r.stdout); } catch { doc = null; }
  return { exitCode: r.status ?? 2, doc, stderr: String(r.stderr ?? '').replace(/\(node:\d+\) ExperimentalWarning[^\n]*\n?|\(Use `node --trace-warnings[^\n]*\n?/g, '').trim() };
};

/**
 * Run every gate. `remeasure` false skips the draw-metrics re-render. `runners` replaces the spawned gates and the
 * re-measure (tests): {validate(uiDir, repo), shell(uiDir, repo), metrics({repo, files})}.
 */
export async function drawGates({ ui, repo, files = [], remeasure = true, runners = {} }) {
  const uiDir = path.resolve(ui);
  const root = path.resolve(repo);
  const uiRel = rel(root, uiDir);
  const recordFile = `${uiRel}/index.yaml`;
  const bound = uniq([uiDir, ...files.map((f) => path.resolve(root, f))]);
  const gates = [];

  // 1. draw-acceptance: exactly what api settle judges (draw-not-accepted); the owner gate is reported apart.
  const acc = drawAcceptanceFindings({ repo: root, files: bound });
  const owner = acc.findings.filter((f) => f.code === OWNER_GATE_CODE);
  const red = acc.findings.filter((f) => f.code !== OWNER_GATE_CODE);
  gates.push({ name: 'draw-acceptance', command: cmd('scripts/checks/draw-acceptance.mjs', ['--repo', slash(root), '--files', bound.map((b) => rel(root, b)).join(',')]),
    exitCode: red.length ? 1 : 0, codes: uniq(red.map((f) => f.code)).sort(), failing: uniq(red.map((f) => fileOf(f, recordFile))),
    evidence: red.length ? `${red.length} finding(s): ${red.slice(0, 6).map((f) => `[${f.code}] ${f.detail}`).join(' | ').slice(0, 1500)}` : `records ${acc.records.join(', ') || '(none)'} accepted by the machine gates`, findings: red.slice(0, 50) });

  // 2. draw-metrics: the settle re-render and re-measure of every live part.
  if (remeasure) {
    let m;
    try { m = await (runners.metrics ?? settleDrawMetricFindings)({ repo: root, files: bound }); } catch (error) { m = { findings: [{ code: 'DRAW_METRICS_UNVERIFIED', path: recordFile, detail: `the re-measure could not run: ${String(error?.message ?? error).split('\n')[0]}` }], loops: [] }; }
    gates.push({ name: 'draw-metrics', command: cmd('scripts/work/draw-loop.mjs', ['verify', '--ui', slash(uiDir), '--repo', slash(root)]),
      exitCode: m.findings.length ? 1 : 0, codes: uniq(m.findings.flatMap((f) => [f.code, ...(f.codes ?? [])])).sort(), failing: uniq(m.findings.map((f) => fileOf(f, recordFile))),
      evidence: m.findings.length ? `${m.findings.length} finding(s): ${m.findings.slice(0, 4).map((f) => `[${f.code}] ${f.detail}`).join(' | ').slice(0, 1500)}` : 'every live part re-rendered and re-measured green', findings: m.findings.slice(0, 50) });
  }

  // 3. validate-strict on the record dir; each refused record is a failing file (a child outside the slice is foreign).
  const v = runners.validate ? await runners.validate(uiDir, root) : spawnJson('bin/starci.mjs', ['validate', slash(uiDir), '--strict', '--json'], root);
  const refused = refusalsOf(v.doc?.refused, SKILL_ROOT, root);
  gates.push({ name: 'validate-strict', command: `node ${slash(path.join(SKILL_ROOT, 'bin', 'starci.mjs'))} validate ${uiRel} --strict --json`,
    exitCode: v.doc ? (v.doc.ok === false || refused.length ? 1 : 0) : (v.exitCode || 2), codes: uniq(refused.map((r) => r.code)).sort(), failing: uniq(refused.map((r) => r.file)),
    evidence: v.doc ? (refused.length ? `${refused.length} refusal(s): ${refused.slice(0, 5).map((r) => `${r.file} [${r.code}] ${r.message}`).join(' | ').slice(0, 1500)}` : 'strict validation: 0 refused') : `validate did not answer JSON: ${v.stderr.slice(0, 400)}` });

  // 4. shell-conformance.
  const s = runners.shell ? await runners.shell(uiDir, root) : spawnJson('scripts/checks/shell-conformance.mjs', [slash(uiDir), '--json'], root);
  const sFindings = [...(s.doc?.refused ?? []), ...(s.doc?.findings ?? []).filter((f) => f?.level === 'refuse')];
  const sCode = (f) => (typeof f === 'string' ? /\[([A-Z0-9_]+)\]/.exec(f)?.[1] : f?.code) ?? null;
  gates.push({ name: 'shell-conformance', command: cmd('scripts/checks/shell-conformance.mjs', [uiRel, '--json']),
    exitCode: s.doc ? (s.doc.ok === false ? 1 : 0) : (s.exitCode || 2), codes: uniq(sFindings.map(sCode)).sort(), failing: s.doc?.ok === false ? [recordFile] : [],
    evidence: s.doc ? (s.doc.ok === false ? `${sFindings.length} refusal(s): ${sFindings.slice(0, 5).map((f) => (typeof f === 'string' ? f : `[${f.code}] ${f.message ?? f.detail ?? ''}`)).join(' | ').slice(0, 1500)}` : 'shell conformance: 0 refused') : `shell-conformance did not answer JSON: ${s.stderr.slice(0, 400)}` });

  // 5. draw-loop: every loop a live part names finished and passed.
  let record = null;
  try { record = parseYaml(fs.readFileSync(path.join(uiDir, 'index.yaml'), 'utf8')); } catch { record = null; }
  const loops = [];
  for (const p of record ? livePartsOf(uiDir, record) : []) {
    const ref = p.asset.generation?.loop?.path;
    if (!ref || loops.some((l) => l.ref === ref)) continue;
    const doc = readJson(path.resolve(uiDir, ref));
    loops.push({ ref, outcome: doc?.outcome ?? null, best: doc?.best ?? null, remaining: (doc?.remaining ?? []).map((r) => r.code) });
  }
  const unfinished = loops.filter((l) => l.outcome !== 'passed');
  gates.push({ name: 'draw-loop', command: cmd('scripts/work/draw-loop.mjs', ['status', '--out', '<loop dir>']), exitCode: unfinished.length || (record && !loops.length && livePartsOf(uiDir, record).length) ? 1 : 0,
    codes: uniq(unfinished.flatMap((l) => l.remaining)).sort(), failing: unfinished.length ? [recordFile] : [],
    evidence: loops.length ? loops.map((l) => `${l.ref}: ${l.outcome ?? 'not finished'} (best round ${l.best ?? '-'}${l.remaining.length ? `; remaining ${uniq(l.remaining).join(', ')}` : ''})`).join('; ') : 'no live part names a draw loop' });

  const failed = gates.filter((g) => g.exitCode !== 0);
  const checks = gates.map(({ name, command, exitCode, codes, failing, evidence }) => ({ name, command, exitCode, evidence, ...(exitCode !== 0 && codes.length ? { codes } : {}), ...(exitCode !== 0 && failing.length ? { failing } : {}) }));
  return {
    schema: GATES_SCHEMA, ui: uiRel, ok: failed.length === 0, gates, checks,
    owner: { owed: owner.length > 0, detail: owner.map((f) => f.detail).join('; ') || null },
    next: failed.length
      ? `red: ${failed.map((g) => `${g.name} [${g.codes.join(', ') || 'exit ' + g.exitCode}]`).join('; ')} - fix and re-run this command; if a red gate is not yours to fix, report blocked naming it (report.checks below carry the failing files)`
      : owner.length ? 'every machine gate is green; the owner gate is owed: file the draw-review ask (node scripts/work/draw-review.mjs question --job <id>) and report ask with these checks'
        : 'every gate is green: report with these checks',
  };
}

async function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  const ui = get('--ui'), repo = get('--repo');
  if (!ui || !repo) { process.stderr.write('use: node scripts/work/draw-gates.mjs --ui <ui-record-dir> --repo <product repo> [--files <a,b,...>] [--no-remeasure] [--checks-out <file>] [--json]\n'); return 2; }
  const r = await drawGates({ ui: path.resolve(repo, ui), repo, files: (get('--files') ?? '').split(',').map((s) => s.trim()).filter(Boolean), remeasure: !argv.includes('--no-remeasure') });
  if (get('--checks-out')) fs.writeFileSync(path.resolve(get('--checks-out')), `${JSON.stringify({ checks: r.checks }, null, 2)}\n`);
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  else process.stdout.write([`${r.ok ? 'GREEN' : 'RED'}: ${r.ui}`, ...r.gates.map((g) => `  ${g.exitCode === 0 ? 'ok  ' : 'FAIL'} ${g.name}${g.codes.length && g.exitCode ? ` [${g.codes.join(', ')}]` : ''}: ${g.evidence.slice(0, 300)}`),
    `  owner gate: ${r.owner.owed ? 'owed (file the draw-review ask)' : 'not owed'}`, `next: ${r.next}`].join('\n') + '\n');
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { process.stderr.write(`draw-gates: ${e?.stack ?? e}\n`); process.exitCode = 2; });
}
