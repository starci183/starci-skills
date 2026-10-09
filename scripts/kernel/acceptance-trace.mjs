// acceptance-trace.mjs - the measure `acceptance-trace` of modules/kernel/op-judges.yaml (owner ruling acceptance-trace-report-mode).
//
// The maker never judges its own work: a test the same attempt wrote proves behaviour only as far as it traces to acceptance the maker did not
// write. The acceptance records (ac.*, schema work/acceptance-criterion@1) of the op's scope are written by an earlier leg. The scope of an
// attempt is the acceptance its bound records prove: an ac id the record `proves` itself, or the criteria (ac.rule) of a business rule it proves,
// directly or through a requirement's refs. A test counts toward the proof when its text cites at least one of those ids; one that cites none
// is uncounted. REPORT MODE: the settle records "acceptance-trace: N of M cited, K tests uncited" as the runtime check `acceptance-trace` on the
// attempt (always exit 0) and a miss fails and opens nothing; `starci kernel status --full` shows it.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { recordCheck } from '../machine/evidence-store.mjs';
import { oneLine } from '../lib/clip.mjs';
import { judgeRegistry } from './op-judge.mjs';
import { byCodeUnit } from '../lib/list.mjs';

export const TRACE_CHECK = 'acceptance-trace';
const WORK_ROOT = '.starciwork';
const AC_ID = /\bac(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){3,}\b/g;
const TEST_FILE = /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$/;
const MAX_RECORDS = 4000;
const MAX_TEST_BYTES = 1_000_000;

const listOf = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

function readDoc(file) {
  try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Every record of a work root's features as Map(id -> document), bounded. */
function recordIndex(workRoot) {
  const index = new Map();
  const stack = [path.join(workRoot, 'features')];
  while (stack.length && index.size < MAX_RECORDS) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { entries = []; }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
      else if (entry.name === 'index.yaml') {
        const doc = readDoc(path.join(dir, entry.name));
        if (typeof doc?.id === 'string') index.set(doc.id, doc);
      }
    }
  }
  return index;
}

/** The business rules a record id leads to: itself when a rule, its refs when a requirement. */
function rulesOf(id, index) {
  if (id.startsWith('br.')) return [id];
  return id.startsWith('fr.') ? listOf(index.get(id)?.refs).filter((ref) => ref.startsWith('br.')) : [];
}

/** The acceptance ids a set of proved record ids stands for. */
export function acceptanceIdsOf(proved, index) {
  const rules = new Set(proved.flatMap((id) => rulesOf(id, index)));
  const direct = proved.filter((id) => id.startsWith('ac.'));
  const viaRule = [...index.values()].filter((doc) => doc.id?.startsWith('ac.') && rules.has(doc.rule)).map((doc) => doc.id);
  return [...new Set([...direct, ...viaRule])].sort(byCodeUnit);
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
export const traceLine = (trace) => `acceptance-trace: ${trace.cited} of ${trace.total} cited, ${trace.uncitedTests.length} tests uncited`;

/** Where a bound record of the job sits: the work root and the record file, or null. */
function boundRecord(owned, roots) {
  const text = String(owned).replaceAll('\\', '/');
  const at = text.indexOf(`${WORK_ROOT}/`);
  if (at < 0 || text.includes(':')) return null;
  for (const root of roots) {
    const file = path.join(root, text.endsWith('.yaml') ? text : `${text.replace(/\/$/, '')}/index.yaml`);
    if (fs.existsSync(file)) return { workRoot: path.join(root, text.slice(0, at + WORK_ROOT.length)), file };
  }
  return null;
}

function testFilesOf(reportFiles, roots) {
  const tests = [];
  for (const rel of listOf(reportFiles).filter((file) => TEST_FILE.test(file))) {
    const file = roots.map((root) => path.resolve(root, rel)).find((candidate) => fs.existsSync(candidate));
    if (file && fs.statSync(file).size <= MAX_TEST_BYTES) tests.push({ path: rel, text: fs.readFileSync(file, 'utf8') });
  }
  return tests;
}

/** The trace of one attempt from its roots, bound (owned) paths and the files its report names. */
export function acceptanceTraceOf({ roots, owned, reportFiles }) {
  const bound = owned.map((entry) => boundRecord(entry, roots)).filter(Boolean);
  const workRoots = [...new Set(bound.map((record) => record.workRoot))];
  const indexes = new Map(workRoots.map((root) => [root, recordIndex(root)]));
  const acceptance = [...new Set(bound.flatMap((record) => {
    const index = indexes.get(record.workRoot);
    const doc = readDoc(record.file);
    return acceptanceIdsOf([...listOf(doc?.proves), ...(typeof doc?.id === 'string' ? [doc.id] : [])], index);
  }))].sort(byCodeUnit);
  return traceOf(acceptance, testFilesOf(reportFiles, roots));
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
  const rows = db.prepare(`SELECT a.op_id, a.job_id, c.summary_json FROM check_runs c JOIN op_attempts a ON a.attempt_id=c.attempt_id
    WHERE a.workflow_id=? AND c.name=? ORDER BY c.check_id`).all(workflowId, TRACE_CHECK);
  const latest = new Map();
  for (const row of rows) {
    let summary = null;
    try { summary = JSON.parse(row.summary_json); } catch { summary = null; }
    if (summary?.line) latest.set(row.job_id, { op: row.op_id, jobId: row.job_id, line: summary.line, missing: summary.trace?.missing ?? [], uncitedTests: summary.trace?.uncitedTests ?? [] });
  }
  return [...latest.values()];
}
