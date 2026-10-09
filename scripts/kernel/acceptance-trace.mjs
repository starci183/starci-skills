// acceptance-trace.mjs - the measure `acceptance-trace` of modules/kernel/op-judges.yaml (owner ruling acceptance-trace-report-mode).
//
// The maker never judges its own work: a test the same attempt wrote proves behaviour only as far as it traces to acceptance the maker did not
// write. The acceptance records (ac.*, schema work/acceptance-criterion@1) of the op's scope are written by an earlier leg. The scope of an
// attempt is the acceptance its bound records prove: an ac id the record `proves` itself, or the criteria (ac.rule) of a business rule it proves,
// directly or through a requirement's refs. A test counts toward the proof when its text cites at least one of those ids; one that cites none
// is uncounted. REPORT MODE: the settle records "acceptance-trace: N of M cited, K tests uncited" as the runtime check `acceptance-trace` on the
// attempt (always exit 0) and a miss fails and opens nothing; `starci kernel status --full` and the debug digest show it. Executed files come
// from verified native check receipts, and compact criteria use the shared Work record resolver.
import fs from 'node:fs';
import path from 'node:path';
import { recordCheck } from '../machine/evidence-store.mjs';
import { oneLine } from '../lib/clip.mjs';
import { judgeRegistry } from './op-judge.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { WORK_DIR_NAME } from '../lib/roots.mjs';
import { insidePath } from '../lib/path-key.mjs';
import { indexFilesUnder, readYamlOrNull as readDoc } from '../work/work-io.mjs';
import { indexInlineCriteria, splitRef } from '../work/record-ownership.mjs';
import { GATE_SCHEMA } from '../gates/gate.mjs';
import { UNIT_RUN_SCHEMA } from '../gates/unit-run.mjs';
import { TEST_WORLD_RUN_SCHEMA } from '../gates/test-world-run.mjs';

const TRACE_CHECK = 'acceptance-trace';
const AC_ID = /\bac(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){3,}\b/g;
const MAX_RECORDS = 4000;
const MAX_TEST_BYTES = 1_000_000;

const listOf = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

/** Every record of a work root's features as Map(id -> document), bounded. */
function recordIndex(workRoot) {
  return new Map(indexFilesUnder(path.join(workRoot, 'features')).slice(0, MAX_RECORDS).map((file) => readDoc(file))
    .filter((doc) => typeof doc?.id === 'string').map((doc) => [doc.id, doc]));
}

function acceptanceStep(ref, index, inline) {
  const { id, frag } = splitRef(ref);
  const direct = id.startsWith('ac.') ? [id] : [];
  if (frag) return { ids: [...direct, ...[inline.byParent.get(id)?.get(frag)?.id].filter((value) => value?.startsWith('ac.'))], links: [] };
  const doc = index.get(id);
  const compact = [...(inline.byParent.get(id)?.values() ?? [])].map((criterion) => criterion.id).filter((value) => value?.startsWith('ac.'));
  const records = [...index.values()].filter((criterion) => criterion.id?.startsWith('ac.') && criterion.rule === id).map((criterion) => criterion.id);
  return { ids: [...direct, ...compact, ...records], links: [...listOf(doc?.proves), ...listOf(doc?.refs)] };
}

/** The acceptance ids a set of proved record ids stands for, following declared links and compact criteria without cycling. */
export function acceptanceIdsOf(proved, index) {
  const inline = indexInlineCriteria(new Map([...index].map(([id, data]) => [id, { data }])));
  const pending = [...proved], seen = new Set(), acceptance = new Set();
  while (pending.length) {
    const ref = pending.pop();
    if (seen.has(ref)) continue;
    seen.add(ref);
    const step = acceptanceStep(ref, index, inline);
    pending.push(...step.links);
    step.ids.forEach((id) => acceptance.add(id));
  }
  return [...acceptance].sort(byCodeUnit);
}

/** Pure: the trace of acceptance ids against tests [{path, text}]. */
export function traceOf(acceptance, tests) {
  const wanted = new Set(acceptance);
  const citedBy = tests.map((test) => ({ path: test.path, cites: new Set((test.text.match(AC_ID) ?? []).filter((id) => wanted.has(id))) }));
  const cited = new Set(citedBy.flatMap((test) => [...test.cites]));
  return { total: acceptance.length, cited: cited.size, missing: acceptance.filter((id) => !cited.has(id)),
    tests: tests.length, uncitedTests: citedBy.filter((test) => !test.cites.size).map((test) => test.path) };
}

/** The line status shows for a trace. */
export function traceLine(trace) {
  const availability = trace.unavailable ? '; unavailable: ' + oneLine(trace.unavailable) : '';
  return `acceptance-trace: ${trace.cited} of ${trace.total} cited, ${trace.uncitedTests.length} tests uncited${availability}`;
}

/** Where a bound record of the job sits: the work root and the record file, or null. */
function boundRecord(owned, roots) {
  const text = String(owned).replaceAll('\\', '/').replace(/\/(?:\*\*|\*)\/?$/, '');
  const at = text.indexOf(`${WORK_DIR_NAME}/`);
  if (at < 0 || text.includes(':')) return null;
  for (const root of roots) {
    const file = path.resolve(root, text);
    if (insidePath(root, file) && fs.existsSync(file)) return { workRoot: path.join(root, text.slice(0, at + WORK_DIR_NAME.length)), file };
  }
  return null;
}

/** Executed files from verified native receipts only; a report's changed files and selected patterns do not prove execution. */
export function traceRunsOf(observations) {
  return (observations ?? []).filter((run) => !run.judged && run.native?.subject && [GATE_SCHEMA, UNIT_RUN_SCHEMA, TEST_WORLD_RUN_SCHEMA].includes(run.doc?.schema))
    .map((run) => ({ root: run.native.subject, files: listOf(run.doc.schema === GATE_SCHEMA ? run.doc.steps?.tests?.testFiles : run.doc.run?.testFiles) }));
}

function testFilesOf(runs) {
  const tests = [];
  const seen = new Set();
  for (const run of runs) for (const rel of listOf(run.files)) {
    const file = path.resolve(run.root, rel);
    if (seen.has(file) || !insidePath(run.root, file)) continue;
    seen.add(file);
    let text = '';
    try { if (fs.statSync(file).size <= MAX_TEST_BYTES) text = fs.readFileSync(file, 'utf8'); } catch { /* An unreadable executed test cites nothing. */ }
    tests.push({ path: rel, text });
  }
  return tests;
}

/** The trace of one attempt from its roots, bound paths and files named in verified test-run receipts. */
export function acceptanceTraceOf({ roots, owned, testRuns = [] }) {
  const bound = owned.map((entry) => boundRecord(entry, roots)).filter(Boolean);
  const workRoots = [...new Set(bound.map((record) => record.workRoot))];
  const indexes = new Map(workRoots.map((root) => [root, recordIndex(root)]));
  const acceptance = [...new Set(bound.flatMap((record) => {
    const index = indexes.get(record.workRoot);
    const files = fs.statSync(record.file).isDirectory() ? indexFilesUnder(record.file) : [record.file];
    return files.flatMap((file) => {
      const doc = readDoc(file);
      return acceptanceIdsOf([...listOf(doc?.proves), ...listOf(doc?.refs), ...(typeof doc?.id === 'string' ? [doc.id] : [])], index);
    });
  }))].sort(byCodeUnit);
  return traceOf(acceptance, testFilesOf(testRuns));
}

/** The ops the measure applies to, from the registry. */
export const traceOpsOf = (root) => judgeRegistry(root).measures[TRACE_CHECK].applies.ops;

/** The op prompt line that tells a measured op to cite the acceptance id in each test it writes ([] for any other op). */
export function tracePromptLines(op, root) {
  if (!traceOpsOf(root).includes(op)) return [];
  return ['acceptance_trace: cite the id of the acceptance record (ac.<rule>.<name>, the records of your scope that an earlier leg wrote) each test you write covers, in its name or a comment; the runtime records how many acceptance records the tests you ran cite and how many cite none, and a test that cites none is not counted toward your proof'];
}

/** Record the trace on the attempt as the runtime check `acceptance-trace`: evidence only, exit 0 whatever the result. */
export function recordTrace(ledger, { attemptId, trace, now = Date.now() }) {
  const line = traceLine(trace);
  ledger.transaction(() => recordCheck(ledger.db, { attemptId, name: TRACE_CHECK, phase: 'verify', runner: 'settler', authority: 'runtime',
    command: 'acceptance-trace settle over the attempt tests (report mode)', exitCode: 0,
    summary: { mode: 'report', line, trace: { ...trace, missing: trace.missing.slice(0, 40), uncitedTests: trace.uncitedTests.slice(0, 40) },
      entry: { name: TRACE_CHECK, exitCode: 0, codes: [], evidence: oneLine(line) } }, now }));
  return line;
}

/** The newest trace of each op of a workflow: [{op, jobId, line, missing, uncitedTests}]. */
export function tracesOf(db, workflowId) {
  const rows = db.prepare(`SELECT a.op_id, a.job_id, a.attempt_id, c.summary_json FROM check_runs c JOIN op_attempts a ON a.attempt_id=c.attempt_id
    WHERE a.workflow_id=? AND c.name=? ORDER BY c.created_at, c.check_id`).all(workflowId, TRACE_CHECK);
  const latest = new Map();
  for (const row of rows) {
    let summary = null;
    try { summary = JSON.parse(row.summary_json); } catch { summary = null; }
    if (summary?.line) latest.set(row.job_id, { op: row.op_id, jobId: row.job_id, attemptId: row.attempt_id, line: summary.line, missing: summary.trace?.missing ?? [], uncitedTests: summary.trace?.uncitedTests ?? [] });
  }
  return [...latest.values()];
}
