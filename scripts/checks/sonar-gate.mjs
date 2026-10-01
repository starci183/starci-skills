// sonar-gate.mjs - the Sonar quality gate as data plus its pure judgments (knowledge/sonar-gate.yaml).
//
// The thresholds live in that one knowledge file; nothing here restates a number. Three readers use it:
//   scripts/checks/sonar-local.mjs      judges a slice's changed lines (issues, duplication, hotspots) and the coverage of
//                                       every service it touched (`judgeCoverage`), judges a project's dashboard
//                                       (`judgeDashboard`), and makes the server gate `gate.name` carry `serverConditions(gate)`
//   scripts/checks/check-starcistacks.mjs  refuses a declaration whose services.sonar.qualityGate is not `gate.name`
//   scripts/kernel/sonar-settle.mjs     `judgeSummary` reads the sonar.json an op attached and says whether the
//                                       op may settle done (`enforcedOps`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants, globExpression } from '../lib/glob.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GATE_FILE = 'knowledge/sonar-gate.yaml';
export const GATE_SCHEMA = 'starci/sonar-gate@1';
export const SCAN_SCHEMA_PREFIX = 'starci/sonar-local-scan@';

let cache = null;
/** The gate document. Read once per process; `file` bypasses the cache (a spec's own gate). */
export function loadSonarGate({ base = root, file = null } = {}) {
  if (!file && cache && cache.base === base) return cache.gate;
  const gate = parseYaml(fs.readFileSync(file ?? path.join(base, GATE_FILE), 'utf8'));
  if (gate?.schema !== GATE_SCHEMA) throw new Error(`${file ?? GATE_FILE}: schema must be ${GATE_SCHEMA}`);
  for (const key of ['gate', 'newCode', 'overall', 'enforcedOps'])
    if (gate[key] == null) throw new Error(`${file ?? GATE_FILE}: ${key} is required`);
  if (!file) cache = { base, gate };
  return gate;
}

/**
 * The conditions the server gate carries: [{metric, op, error}] (SonarQube api/qualitygates conditions): the new-code ones
 * (coverage, duplication, hotspots, blocking issues), then the overall-code ones (coverage, open issues of any origin,
 * imported HFS/ESLint/stylelint findings included, reviewed hotspots and duplication). Coverage is the services' coverage:
 * the scope is sonar.coverage.inclusions of the managed sonar-project.properties.
 */
export function serverConditions(gate) {
  const n = gate.newCode;
  const o = gate.overall;
  const out = [
    { metric: n.coverage.metric, op: 'LT', error: String(n.coverage.minPercent) },
    { metric: n.duplication.metric, op: 'GT', error: String(n.duplication.maxPercent) },
    { metric: n.hotspots.metric, op: 'LT', error: String(n.hotspots.minReviewedPercent) },
  ];
  for (const severity of n.issues.blockingSeverities) out.push({ metric: n.issues.metrics[severity], op: 'GT', error: String(n.issues.max) });
  out.push(
    { metric: o.coverage.metric, op: 'LT', error: String(o.coverage.minPercent) },
    { metric: o.issues.metric, op: 'GT', error: String(o.issues.max) },
    { metric: o.hotspots.metric, op: 'LT', error: String(o.hotspots.minReviewedPercent) },
    { metric: o.duplication.metric, op: 'GT', error: String(o.duplication.maxPercent) },
  );
  return out;
}

/** The ops the runtime holds to the gate at settle. */
export const enforcedOps = (gate) => new Set(gate.enforcedOps);

/** What the slice verdict is judged against: the numbers a scan copies into its summary (`gate`). */
export function thresholdsOf(gate) {
  const n = gate.newCode;
  return {
    name: gate.gate.name,
    ignoreBelowChangedLines: n.ignoreBelowChangedLines,
    duplicationMaxPercent: n.duplication.maxPercent,
    blockingSeverities: [...n.issues.blockingSeverities],
    blockingIssuesMax: n.issues.max,
    unreviewedHotspotsMax: n.hotspots.unreviewedMax,
    coverageMinPercent: gate.overall.coverage.minPercent,
  };
}

/** The `sonar.coverage.inclusions` globs of a sonar-project.properties map (readProperties). */
export function coverageInclusionsOf(props = {}) {
  return String(props['sonar.coverage.inclusions'] ?? '').split(',').map((glob) => glob.trim()).filter(Boolean);
}

/** True for a repository-relative path inside the coverage inclusions (Sonar's glob subset, scripts/lib/glob.mjs). */
export function coverageTargetOf(inclusions) {
  const patterns = inclusions.flatMap(braceVariants).map(globExpression);
  return (file) => patterns.some((pattern) => pattern.test(String(file).split('\\').join('/')));
}

const asNumber = (value) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * The per-file coverage verdict: `files` are [{path, coverage}] (coverage the Sonar `coverage` measure of the file, a number
 * or null when Sonar has none), `inclusions` the repository's sonar.coverage.inclusions. Only a file inside the inclusions
 * is a coverage target: every other file (a handler, a resolver, a module, a config file, a test, anything under fe/) is
 * not judged and not listed, whatever its measure. A target below `minPercent` fails, and so does a target Sonar holds no
 * coverage for (the lcov report was not imported or does not name it): a missing number is never a pass. With no
 * inclusions the repository declares no coverage scope and nothing is judged (`applied` false).
 * Returns {applied, inclusions, minPercent, files: [{path, coverage, ok}], failures: [text]}.
 */
export function judgeCoverage(files, { inclusions = [], minPercent }) {
  const isTarget = coverageTargetOf(inclusions);
  const result = { applied: inclusions.length > 0, inclusions: [...inclusions], minPercent, files: [], failures: [] };
  if (!result.applied) return { ...result, note: 'the repository declares no sonar.coverage.inclusions: no coverage target' };
  for (const file of [...files].sort(byPath)) {
    const rel = String(file.path).split('\\').join('/');
    if (!isTarget(rel)) continue;
    const coverage = asNumber(file.coverage);
    const ok = coverage !== null && coverage >= minPercent;
    result.files.push({ path: rel, coverage, ok });
    if (coverage === null) result.failures.push(`${rel} has no coverage measure (the be unit run's lcov is not imported or does not name it)`);
    else if (!ok) result.failures.push(`coverage of ${rel} ${coverage}% < ${minPercent}%`);
  }
  return result;
}

/**
 * The dashboard verdict of a whole project (`sonar-local dashboard`): `measures` the project's measures by metric key
 * (bugs, code_smells, vulnerabilities, security_hotspots, security_hotspots_reviewed, coverage), `files` the per-file
 * coverage of the project (as judgeCoverage takes it), `inclusions` its sonar.coverage.inclusions. It fails unless every
 * issue type of `overall.issues.types` is at `overall.issues.max`, every hotspot is reviewed (a project with no hotspot has
 * none to review), and every service is at the coverage threshold. Returns {verdict, numbers, coverage, failures}.
 */
export function judgeDashboard({ measures = {}, files = [], inclusions = [] }, gate) {
  const o = gate.overall;
  const failures = [];
  const numbers = {};
  for (const metric of Object.keys(o.issues.types)) {
    numbers[metric] = asNumber(measures[metric]);
    if (numbers[metric] === null) failures.push(`${metric} is not measured`);
    else if (numbers[metric] > o.issues.max) failures.push(`${metric} ${numbers[metric]} > ${o.issues.max}`);
  }
  const reviewed = asNumber(measures[o.hotspots.metric]);
  numbers.security_hotspots = asNumber(measures.security_hotspots);
  numbers[o.hotspots.metric] = reviewed === null && numbers.security_hotspots === 0 ? 100 : reviewed;
  if (numbers[o.hotspots.metric] === null) failures.push(`${o.hotspots.metric} is not measured`);
  else if (numbers[o.hotspots.metric] < o.hotspots.minReviewedPercent) failures.push(`${o.hotspots.metric} ${numbers[o.hotspots.metric]}% < ${o.hotspots.minReviewedPercent}%`);
  numbers[o.coverage.metric] = asNumber(measures[o.coverage.metric]);
  const coverage = judgeCoverage(files, { inclusions, minPercent: o.coverage.minPercent });
  if (!coverage.applied) failures.push("the repository declares no sonar.coverage.inclusions: the services' coverage cannot be judged");
  else if (!coverage.files.length) failures.push(`no file inside ${inclusions.join(',')} is measured: the coverage scope is empty or the lcov report was not imported`);
  failures.push(...coverage.failures);
  if (numbers[o.coverage.metric] === null) failures.push(`${o.coverage.metric} is not measured`);
  else if (numbers[o.coverage.metric] < o.coverage.minPercent) failures.push(`${o.coverage.metric} ${numbers[o.coverage.metric]}% < ${o.coverage.minPercent}%`);
  return { verdict: failures.length ? 'fail' : 'pass', numbers, coverage, failures };
}

/**
 * What a filed sonar.json says, as a settle judgment. `summary` is the parsed scan summary (or null when the op attached
 * none). Returns {status, code, detail, findings[]}:
 *   pass         the slice meets the gate (or Sonar is disabled by the repository's own declaration - noted)
 *   red          the slice fails the gate on new code: findings[] names every failing condition
 *   unavailable  the scan could not run (server down, custody missing, token rejected): never a pass
 *   refused      the scan was refused before it ran (unknown base, empty slice ...): the op fixes and reruns
 *   missing      no sonar.json (or one that is not a scan summary) is attached
 * A slice that changed no file is a pass with `note`: there is nothing new to fail.
 */
export function judgeSummary(summary, gate) {
  if (!summary || typeof summary !== 'object' || !String(summary.schema ?? '').startsWith(SCAN_SCHEMA_PREFIX))
    return { status: 'missing', code: 'sonar-proof-missing', detail: 'no sonar.json scan summary (schema starci/sonar-local-scan) is attached to the report', findings: [] };
  const why = String(summary.reason ?? '').replace(/\s+/g, ' ').slice(0, 300);
  switch (summary.outcome) {
    case 'pass':
      if (summary.scope !== 'slice') return { status: 'missing', code: 'sonar-proof-missing', detail: `the summary's scope is ${summary.scope ?? 'unknown'}, not the slice's own (scope slice is required)`, findings: [] };
      return { status: 'pass', code: null, detail: null, findings: [] };
    case 'fail': {
      const findings = Array.isArray(summary.slice?.failures) && summary.slice.failures.length ? summary.slice.failures.map(String) : [why || 'the slice fails the gate'];
      return { status: 'red', code: 'sonar-gate-red', detail: findings.join('; '), findings };
    }
    case 'blocked':
      return { status: 'unavailable', code: 'sonar-unavailable', detail: why || 'Sonar could not judge the slice', findings: [] };
    case 'disabled':
      return { status: 'pass', code: null, detail: null, note: `Sonar is disabled by the repository's declaration: ${why}`, findings: [] };
    case 'refused':
      if (summary.code === 'SLICE_EMPTY') return { status: 'pass', code: null, detail: null, note: 'the slice changed no file, so there is no new code to judge', findings: [] };
      return { status: 'refused', code: 'sonar-scan-refused', detail: `${summary.code ?? 'refused'}: ${why}`, findings: [] };
    case 'submitted':
      return { status: 'missing', code: 'sonar-proof-missing', detail: 'the scan was submitted without --wait: no processed verdict', findings: [] };
    default:
      return { status: 'missing', code: 'sonar-proof-missing', detail: `the summary has no verdict (outcome ${summary.outcome ?? 'absent'})`, findings: [] };
  }
}
