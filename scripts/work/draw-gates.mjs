#!/usr/bin/env node
// draw-gates.mjs — every gate an interface.draw pass is judged by, run locally in one command BEFORE the drawer reports
// (lane op-draw, 2026-09-28). Measured 2026-09-27: 18 interface.draw jobs failed after the drawer reported, most on a
// gate it never ran or ran differently from the runtime (a strict validate of a whole ui tree, a hand-picked ui-proof
// score, the owner gate mistaken for a failure). This runs exactly what starci kernel settle and starci kernel record-checks run, in their order,
// and prints the report.checks entries - each red one with `failing` (the implicated files), so starci kernel record-checks attributes
// a red gate on a record outside the job's owned paths instead of spending the attempt on it.
//
//   starci work draw-gates --ui <ui-record-dir> --repo <product repo> [--files <a,b,...>] [--no-remeasure]
//        [--checks-out <file>] [--json]
//
// The gates (names are the report.checks names):
//   draw-acceptance   scripts/work/draw/draw-acceptance.mjs over the record dir and --files (what starci kernel settle judges:
//                     token-rendered shapes of ui.shapes, no data status, draw quality, DNA, taste, rationale, the
//                     loop). DRAW_NOT_OWNER_ACCEPTED is the owner gate, reported apart (owner-review), never a red gate.
//   draw-metrics      scripts/work/draw-loop-settle.mjs: every live part re-rendered and re-measured by the runtime
//                     (DRAW_METRICS_FAILED / DRAW_METRICS_UNVERIFIED / DRAW_FEEDBACK_UNADDRESSED). --no-remeasure
//                     skips it (it renders; the settle still runs it).
//   validate-strict   starci runtime validate <ui dir> --strict: each refused record is named in `failing`; a refusal
//                     in a child record outside the job's owned paths is attributed foreign by starci kernel record-checks.
//   shell-conformance scripts/work/ui/shell-conformance.mjs <ui dir>.
//   draw-layer        scripts/work/draw/draw-layer.mjs over every live part (standard principles of every drawing, owner
//                     2026-09-28): DRAW_NESTED_VARIANT on its rendered DOM, DRAW_MEASURE_UNCAPPED on its record's
//                     measured form regions (a record without the measure is re-measured by draw-metrics).
//   draw-loop         every loop the live parts name has finished (loop.json outcome), and passed.
// Exit 0 when every gate is green (the owner gate may still be owed: then file the draw-review ask), 1 when one is
// red (fix it, or report blocked naming it - never pass), 2 usage.
import fs from 'node:fs';
import { livePartsOf, loopFileOfRef, loopLabelOf } from './draw/draw-loop-coverage.mjs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { drawAcceptanceFindings } from './draw/draw-acceptance.mjs';
import { settleDrawMetricFindings } from './draw-loop-settle.mjs';
import { layerFindingsForParts } from './draw/draw-layer.mjs';
import { slash } from './work-io.mjs';
import { isMain } from '../lib/is-main.mjs';
import { byCodeUnit } from '../lib/list.mjs';

export const GATES_SCHEMA = 'starci/draw-gates@1';
const OWNER_GATE_CODE = 'DRAW_NOT_OWNER_ACCEPTED';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REFUSAL_FILE = String.raw`(.+?\.(?:ya?ml|json))`;
const REFUSAL_SPACE = String.raw`\s*`;
const REFUSAL_MESSAGE = '(.*?)';
const REFUSAL_CODE = String.raw`(?:\s*\[([A-Z0-9_]+)\])?`;
const REFUSAL_LINE = new RegExp(`^${REFUSAL_FILE}:${REFUSAL_SPACE}${REFUSAL_MESSAGE}${REFUSAL_CODE}${REFUSAL_SPACE}$`);
const rel = (repo, p) => slash(path.relative(repo, p));
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

/** The command line a gate is re-run by (the evidence names it, starci kernel record-checks records it). */
const WORK_VERBS = new Map([
  ['scripts/work/draw/draw-acceptance.mjs', 'draw-acceptance'],
  ['scripts/work/draw-loop.mjs', 'draw-loop'],
  ['scripts/work/ui/shell-conformance.mjs', 'shell-conformance'],
  ['scripts/work/draw/draw-layer.mjs', 'draw-layer'],
]);
const cmd = (script, args) => `starci work ${WORK_VERBS.get(script)} ${args.join(' ')}`;

/** The repo-relative file a finding implicates: its path, else the record. */
const fileOf = (f, fallback) => (typeof f?.path === 'string' && f.path ? f.path.split('#')[0] : fallback);

/** Parse `<path>: <message> [CODE]` refusal lines (starci runtime validate --json) into {file, code, message}. */
export function refusalsOf(lines, cwd, repo) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const m = REFUSAL_LINE.exec(String(line));
    if (!m) return { file: null, code: null, message: String(line) };
    return { file: rel(repo, path.resolve(cwd, m[1])), code: m[3] ?? null, message: m[2] };
  });
}

const spawnJson = (script, args, cwd) => {
  const r = runNode([path.join(SKILL_ROOT, script), ...args], { cwd, timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
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
  const acceptance = acceptanceGate(root, bound, recordFile);
  gates.push(acceptance.gate);
  if (remeasure) gates.push(await metricsGate(root, uiDir, bound, recordFile, runners));
  gates.push(await validationGate(root, uiDir, uiRel, runners), await shellConformanceGate(root, uiDir, uiRel, recordFile, runners));
  const record = readUiRecord(uiDir);
  gates.push(await layerGate(root, uiDir, uiRel, recordFile, record, runners), drawLoopGate(uiDir, uiRel, recordFile, record));

  const failed = gates.filter((g) => g.exitCode !== 0);
  const checks = gates.map(({ name, command, exitCode, codes, failing, evidence }) => ({ name, command, exitCode, evidence, ...(exitCode !== 0 && codes.length ? { codes } : {}), ...(exitCode !== 0 && failing.length ? { failing } : {}) }));
  let next;
  if (failed.length) next = `red: ${failed.map((g) => g.name + ' [' + (g.codes.join(', ') || 'exit ' + g.exitCode) + ']').join('; ')} - fix and re-run this command; if a red gate is not yours to fix, report blocked naming it (report.checks below carry the failing files)`;
  else if (acceptance.owner.length) next = 'every machine gate is green; the owner gate is owed: file the draw-review ask (starci work draw-review question --job <id>) and report ask with these checks';
  else next = 'every gate is green: report with these checks';
  return {
    schema: GATES_SCHEMA, ui: uiRel, ok: failed.length === 0, gates, checks,
    owner: { owed: acceptance.owner.length > 0, detail: acceptance.owner.map((f) => f.detail).join('; ') || null },
    next,
  };
}

function acceptanceGate(root, bound, recordFile) {
  const acc = drawAcceptanceFindings({ repo: root, files: bound });
  const owner = acc.findings.filter((f) => f.code === OWNER_GATE_CODE);
  const red = acc.findings.filter((f) => f.code !== OWNER_GATE_CODE);
  return { owner, gate: { name: 'draw-acceptance', command: cmd('scripts/work/draw/draw-acceptance.mjs', ['--repo', slash(root), '--files', bound.map((b) => rel(root, b)).join(',')]),
    exitCode: red.length ? 1 : 0, codes: uniq(red.map((f) => f.code)).sort(byCodeUnit), failing: uniq(red.map((f) => fileOf(f, recordFile))),
    evidence: red.length ? `${red.length} finding(s): ${red.slice(0, 6).map((f) => '[' + f.code + '] ' + f.detail).join(' | ').slice(0, 1500)}` : `records ${acc.records.join(', ') || '(none)'} accepted by the machine gates`, findings: red.slice(0, 50) } };
}

async function metricsGate(root, uiDir, bound, recordFile, runners) {
  let metrics;
  try { metrics = await (runners.metrics ?? settleDrawMetricFindings)({ repo: root, files: bound }); }
  catch (error) { metrics = { findings: [{ code: 'DRAW_METRICS_UNVERIFIED', path: recordFile, detail: `the re-measure could not run: ${String(error?.message ?? error).split('\n')[0]}` }], loops: [] }; }
  return { name: 'draw-metrics', command: cmd('scripts/work/draw-loop.mjs', ['verify', '--ui', slash(uiDir), '--repo', slash(root)]),
    exitCode: metrics.findings.length ? 1 : 0, codes: uniq(metrics.findings.flatMap((f) => [f.code, ...(f.codes ?? [])])).sort(byCodeUnit), failing: uniq(metrics.findings.map((f) => fileOf(f, recordFile))),
    evidence: metrics.findings.length ? `${metrics.findings.length} finding(s): ${metrics.findings.slice(0, 4).map((f) => '[' + f.code + '] ' + f.detail).join(' | ').slice(0, 1500)}` : 'every live part re-rendered and re-measured green', findings: metrics.findings.slice(0, 50) };
}

async function validationGate(root, uiDir, uiRel, runners) {
  const v = await (runners.validate ? runners.validate(uiDir, root) : spawnJson('packages/cli/bin/starci.mjs', ['runtime', 'validate', slash(uiDir), '--strict', '--json'], root));
  const refused = refusalsOf(v.doc?.refused, SKILL_ROOT, root);
  const exitCode = v.doc ? Number(Boolean(v.doc.ok === false || refused.length)) : (v.exitCode || 2);
  let evidence;
  if (!v.doc) evidence = `validate did not answer JSON: ${v.stderr.slice(0, 400)}`;
  else if (refused.length) evidence = `${refused.length} refusal(s): ${refused.slice(0, 5).map((r) => r.file + ' [' + r.code + '] ' + r.message).join(' | ').slice(0, 1500)}`;
  else evidence = 'strict validation: 0 refused';
  return { name: 'validate-strict', command: `starci runtime validate ${uiRel} --strict --json`,
    exitCode, codes: uniq(refused.map((r) => r.code)).sort(byCodeUnit), failing: uniq(refused.map((r) => r.file)), evidence };
}

async function shellConformanceGate(root, uiDir, uiRel, recordFile, runners) {
  const s = await (runners.shell ? runners.shell(uiDir, root) : spawnJson('scripts/work/ui/shell-conformance.mjs', [slash(uiDir), '--json'], root));
  const findings = [...(s.doc?.refused ?? []), ...(s.doc?.findings ?? []).filter((f) => f?.level === 'refuse')];
  const codeOf = (f) => (typeof f === 'string' ? /\[([A-Z0-9_]+)\]/.exec(f)?.[1] : f?.code) ?? null;
  const exitCode = s.doc ? Number(s.doc.ok === false) : (s.exitCode || 2);
  let evidence;
  if (!s.doc) evidence = `shell-conformance did not answer JSON: ${s.stderr.slice(0, 400)}`;
  else if (s.doc.ok === false) evidence = `${findings.length} refusal(s): ${findings.slice(0, 5).map((f) => (typeof f === 'string' ? f : '[' + f.code + '] ' + (f.message ?? f.detail ?? ''))).join(' | ').slice(0, 1500)}`;
  else evidence = 'shell conformance: 0 refused';
  return { name: 'shell-conformance', command: cmd('scripts/work/ui/shell-conformance.mjs', [uiRel, '--json']),
    exitCode, codes: uniq(findings.map(codeOf)).sort(byCodeUnit), failing: s.doc?.ok === false ? [recordFile] : [], evidence };
}

function readUiRecord(uiDir) {
  let record = null;
  try { record = parseYaml(fs.readFileSync(path.join(uiDir, 'index.yaml'), 'utf8')); } catch { record = null; }
  return record;
}

async function layerGate(root, uiDir, uiRel, recordFile, record, runners) {
  const parts = (record ? livePartsOf(uiDir, record) : []).map((p) => ({ png: p.png, record: readJsonFile(p.png.replace(/\.png$/i, '.json')) })).filter((p) => p.record);
  const layer = await (runners.layer ? runners.layer(parts) : layerFindingsForParts(parts));
  const red = layer.filter((r) => r.findings.length);
  const findings = red.flatMap((r) => r.findings.map((f) => ({ ...f, path: rel(root, r.part) })));
  const unmeasured = layer.filter((r) => !r.forms).length;
  const evidence = findings.length ? `${findings.length} finding(s): ${findings.slice(0, 4).map((f) => '[' + f.code + '] ' + f.detail).join(' | ').slice(0, 1500)}`
    : `${layer.length} live part(s): every form control on a surface nested, every form region capped${unmeasured && ' (' + unmeasured + ' without a recorded measure; draw-metrics re-measures)' || ''}`;
  return { name: 'draw-layer', command: cmd('scripts/work/draw/draw-layer.mjs', [uiRel, '--playwright', '<product dir>']),
    exitCode: findings.length ? 1 : 0, codes: uniq(findings.map((f) => f.code)).sort(byCodeUnit), failing: uniq(findings.map((f) => fileOf(f, recordFile))),
    evidence, findings: findings.slice(0, 50) };
}

function drawLoopGate(uiDir, uiRel, recordFile, record) {
  const loops = [];
  for (const p of record ? livePartsOf(uiDir, record) : []) {
    const ref = loopLabelOf(p.asset.generation?.loop);
    if (!ref || loops.some((l) => l.ref === ref)) continue;
    const loopFile = loopFileOfRef(p.asset.generation?.loop);
    const doc = loopFile ? readJsonFile(loopFile) : null;
    loops.push({ ref, outcome: doc?.outcome ?? null, best: doc?.best ?? null, remaining: (doc?.remaining ?? []).map((r) => r.code) });
  }
  const unfinished = loops.filter((l) => l.outcome !== 'passed');
  return { name: 'draw-loop', command: cmd('scripts/work/draw-loop.mjs', ['status', '--out', '<loop dir>']), exitCode: unfinished.length || (record && !loops.length && livePartsOf(uiDir, record).length) ? 1 : 0,
    codes: uniq(unfinished.flatMap((l) => l.remaining)).sort(byCodeUnit), failing: unfinished.length ? [recordFile] : [],
    evidence: loops.length ? loops.map((l) => l.ref + ': ' + (l.outcome ?? 'not finished') + ' (best round ' + (l.best ?? '-') + (l.remaining.length ? '; remaining ' + uniq(l.remaining).join(', ') : '') + ')').join('; ') : 'no live part names a draw loop' };
}

async function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  const ui = get('--ui'), repo = get('--repo');
  if (!ui || !repo) { process.stderr.write('use: starci work draw-gates --ui <ui-record-dir> --repo <product repo> [--files <a,b,...>] [--no-remeasure] [--checks-out <file>] [--json]\n'); return 2; }
  const r = await drawGates({ ui: path.resolve(repo, ui), repo, files: (get('--files') ?? '').split(',').map((s) => s.trim()).filter(Boolean), remeasure: !argv.includes('--no-remeasure') });
  if (get('--checks-out')) fs.writeFileSync(path.resolve(get('--checks-out')), `${JSON.stringify({ checks: r.checks }, null, 2)}\n`);
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  else process.stdout.write([`${r.ok ? 'GREEN' : 'RED'}: ${r.ui}`, ...r.gates.map((g) => `  ${g.exitCode === 0 ? 'ok  ' : 'FAIL'} ${g.name}${g.codes.length && g.exitCode ? ' [' + g.codes.join(', ') + ']' : ''}: ${g.evidence.slice(0, 300)}`),
    `  owner gate: ${r.owner.owed ? 'owed (file the draw-review ask)' : 'not owed'}`, `next: ${r.next}`].join('\n') + '\n');
  return r.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { process.stderr.write(`draw-gates: ${e?.stack ?? e}\n`); process.exitCode = 2; }
}
