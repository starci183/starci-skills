// sonar-gate.mjs - the Sonar quality gate as data plus its pure judgments (knowledge/sonar-gate.yaml).
//
// The thresholds live in that one knowledge file; nothing here restates a number. Three readers use it:
//   scripts/gates/sonar-local.mjs      judges a slice's changed lines (issues, duplication, hotspots) and the coverage of
//                                       every service it touched (`judgeCoverage`), judges a project's dashboard
//                                       (`judgeDashboard`), and makes the server gate `gate.name` carry `serverConditions(gate)`
//   scripts/gates/starcistacks.mjs  refuses a declaration whose services.sonar.qualityGate is not `gate.name`
//   scripts/kernel/sonar-settle.mjs     `judgeSummary` reads the sonar.json an op attached and says whether the
//                                       op may settle done (`enforcedOps`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants, globExpression } from '../lib/glob.mjs';
import { declarationEdition } from '../hfs/edition-slots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE_FILE = 'knowledge/sonar-gate.yaml';
export const GATE_SCHEMA = 'starci/sonar-gate@1';
export const SCAN_SCHEMA_PREFIX = 'starci/sonar-local-scan@';

let cache = null;
/** Read the canonical gate for the repository's declared edition; cache the document, never a selected app view. */
export function loadSonarGate({ base = root, file = null, cwd = null } = {}) {
  const gate = !file && cache?.base === base ? cache.gate : parseYaml(fs.readFileSync(file ?? path.join(base, GATE_FILE), 'utf8'));
  if (gate?.schema !== GATE_SCHEMA) throw new Error(`${file ?? GATE_FILE}: schema must be ${GATE_SCHEMA}`);
  for (const key of ['gate', 'newCode', 'overall', 'enforcedOps'])
    if (gate[key] == null) throw new Error(`${file ?? GATE_FILE}: ${key} is required`);
  // Full coverage is a required policy descriptor; only the selected canonical lite block may omit it.
  for (const area of ['newCode', 'overall']) {
    const coverage = gate[area].coverage;
    if (!coverage || typeof coverage.metric !== 'string' || !coverage.metric.trim() || !Number.isFinite(coverage.minPercent) || coverage.minPercent < 0 || coverage.minPercent > 100)
      throw new Error(`${file ?? GATE_FILE}: ${area}.coverage requires a metric and minPercent from 0 to 100`);
  }
  if (!file) cache = { base, gate };
  if (!cwd) return gate;
  return gateForCwd(gate, { cwd, file });
}

/** The canonical gate limited to the repository's declared edition (the lite block may omit the coverage descriptor). */
const gateForCwd = (gate, { cwd, file }) => {
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(path.join(cwd, 'hfs.json'), 'utf8')); }
  catch (error) {
    if (error?.code === 'ENOENT') return gate;
    throw error;
  }
  const { edition, valid } = declarationEdition({}, declaration);
  if (!valid) throw new Error('hfs.json declares an unsupported Sonar edition');
  if (edition === 'full') return gate;
  if (declaration.kind !== 'app') throw new Error('hfs.json lite Sonar policy requires an app declaration');
  const selected = gate[edition];
  for (const key of ['gate', 'newCode', 'overall'])
    if (selected?.[key] == null) throw new Error(`${file ?? GATE_FILE}: ${edition}.${key} is required`);
  return { ...gate, ...selected };
};

/**
 * The conditions the server gate carries: [{metric, op, error}] (SonarQube api/qualitygates conditions): the new-code ones
 * (coverage, duplication, hotspots, blocking issues), then the overall-code ones (coverage, open issues of any origin,
 * imported HFS/ESLint/stylelint findings included, reviewed hotspots and duplication). Coverage is the services' coverage:
 * the scope is what sonar.coverage.exclusions of the managed sonar-project.properties leaves (coverageScopeOf).
 */
export function serverConditions(gate) {
  const n = gate.newCode;
  const o = gate.overall;
  const out = [
    ...(n.coverage ? [{ metric: n.coverage.metric, op: 'LT', error: String(n.coverage.minPercent) }] : []),
    { metric: n.duplication.metric, op: 'GT', error: String(n.duplication.maxPercent) },
    { metric: n.hotspots.metric, op: 'LT', error: String(n.hotspots.minReviewedPercent) },
  ];
  for (const severity of n.issues.blockingSeverities) out.push({ metric: n.issues.metrics[severity], op: 'GT', error: String(n.issues.max) });
  out.push(
    ...(o.coverage ? [{ metric: o.coverage.metric, op: 'LT', error: String(o.coverage.minPercent) }] : []),
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
    coverageMinPercent: gate.overall.coverage?.minPercent ?? null,
  };
}

const listOf = (props, key) => String(props[key] ?? '').split(',').map((glob) => glob.trim()).filter(Boolean);

/**
 * The coverage scope of a sonar-project.properties map (readProperties), as Sonar computes it: SonarQube has no coverage
 * inclusions, so the files it measures coverage on are the source files of `sonar.sources` that neither `sonar.exclusions`,
 * `sonar.coverage.exclusions` nor the test patterns (`sonar.test.inclusions`) take. The managed properties render
 * sonar.coverage.exclusions as the complement of the services (starci app sync coverageExclusions), so what is left is the services.
 * Returns {exclusions, sources, excluded, tests}; `exclusions` empty means the repository declares no coverage scope.
 */
export function coverageScopeOf(props = {}) {
  return { exclusions: listOf(props, 'sonar.coverage.exclusions'), sources: listOf(props, 'sonar.sources'), excluded: listOf(props, 'sonar.exclusions'), tests: listOf(props, 'sonar.test.inclusions') };
}

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

/** True for a repository-relative path Sonar measures coverage on under `scope` (coverageScopeOf; Sonar's glob subset, scripts/lib/glob.mjs). */
export function coverageTargetOf(scope) {
  const patterns = (globs) => (globs ?? []).flatMap(braceVariants).map(globExpression);
  const excluded = patterns([...(scope.exclusions ?? []), ...(scope.excluded ?? [])]);
  const tests = patterns(scope.tests);
  const roots = (scope.sources ?? []).map((dir) => `${String(dir).replace(/\/+$/, '')}/`);
  return (file) => {
    const rel = String(file).replaceAll('\\', '/');
    return SOURCE_FILE.test(rel) && (!roots.length || roots.some((dir) => rel.startsWith(dir)))
      && !excluded.some((pattern) => pattern.test(rel)) && !tests.some((pattern) => pattern.test(rel));
  };
}

const asNumber = (value) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const byPath = (a, b) => {
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
};

/**
 * The per-file coverage verdict: `files` are [{path, coverage}] (coverage the Sonar `coverage` measure of the file, a number
 * or null when Sonar has none), `scope` the repository's coverage scope (coverageScopeOf). Only a file of the scope is a
 * coverage target: every other file (a handler, a resolver, a module, a config file, a test, anything under fe/) is not
 * judged and not listed, whatever its measure. A target below `minPercent` fails, and so does a target Sonar holds no
 * coverage for (the lcov report was not imported or does not name it): a missing number is never a pass. With no
 * sonar.coverage.exclusions the repository declares no coverage scope and nothing is judged (`applied` false).
 * Returns {applied, exclusions, minPercent, files: [{path, coverage, ok}], failures: [text]}.
 */
export function judgeCoverage(files, { scope = coverageScopeOf(), minPercent }) {
  const isTarget = coverageTargetOf(scope);
  const result = { applied: scope.exclusions.length > 0, exclusions: [...scope.exclusions], minPercent, files: [], failures: [] };
  if (!result.applied) return { ...result, note: 'the repository declares no sonar.coverage.exclusions: no coverage scope' };
  for (const file of [...files].sort(byPath)) {
    const rel = String(file.path).replaceAll('\\', '/');
    if (!isTarget(rel)) continue;
    const coverage = asNumber(file.coverage);
    const ok = coverage !== null && coverage >= minPercent;
    result.files.push({ path: rel, coverage, ok });
    if (coverage === null) result.failures.push(`${rel} has no coverage measure (the be unit run's lcov is not imported or does not name it)`);
    else if (!ok) result.failures.push(`coverage of ${rel} ${coverage}% < ${minPercent}%`);
  }
  return result;
}

/** The issue, hotspot and duplication measures of the dashboard: their numbers and failures. */
const measureFailures = (o, measures, numbers) => {
  const failures = [];
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
  numbers[o.duplication.metric] = asNumber(measures[o.duplication.metric]);
  if (numbers[o.duplication.metric] === null) failures.push(`${o.duplication.metric} is not measured`);
  else if (numbers[o.duplication.metric] > o.duplication.maxPercent) failures.push(`${o.duplication.metric} ${numbers[o.duplication.metric]}% > ${o.duplication.maxPercent}%`);
  return failures;
};

/** The coverage block of the dashboard verdict: {coverage, failures}. */
const coverageBlock = (o, files, scope, measures, numbers) => {
  const coverage = o.coverage ? judgeCoverage(files, { scope, minPercent: o.coverage.minPercent })
    : { applied: false, status: 'not-required', files: [], failures: [], note: 'the declared Sonar policy has no coverage condition' };
  const failures = [];
  if (o.coverage) {
    numbers[o.coverage.metric] = asNumber(measures[o.coverage.metric]);
    if (!coverage.applied) failures.push("the repository declares no sonar.coverage.exclusions: the services' coverage cannot be judged");
    else if (!coverage.files.length) failures.push('no file of the coverage scope is measured: the scope is empty or the lcov report was not imported');
    failures.push(...coverage.failures);
    if (numbers[o.coverage.metric] === null) failures.push(`${o.coverage.metric} is not measured`);
    else if (numbers[o.coverage.metric] < o.coverage.minPercent) failures.push(`${o.coverage.metric} ${numbers[o.coverage.metric]}% < ${o.coverage.minPercent}%`);
  }
  return { coverage, failures };
};

/**
 * The dashboard verdict of a whole project (`sonar-local dashboard`): `measures` the project's measures by metric key
 * (bugs, code_smells, vulnerabilities, security_hotspots, security_hotspots_reviewed, duplicated_lines_density, coverage), `files` the per-file
 * coverage of the project (as judgeCoverage takes it), `scope` its coverage scope (coverageScopeOf). It fails unless every
 * issue type of `overall.issues.types` is at `overall.issues.max`, every hotspot is reviewed (a project with no hotspot has
 * none to review), duplication meets its declared maximum, and required coverage meets its per-file threshold. Returns {verdict, numbers, coverage, failures}.
 */
export function judgeDashboard({ measures = {}, files = [], scope = coverageScopeOf() }, gate) {
  const o = gate.overall;
  const numbers = {};
  const failures = [...measureFailures(o, measures, numbers)];
  const block = coverageBlock(o, files, scope, measures, numbers);
  failures.push(...block.failures);
  return { verdict: failures.length ? 'fail' : 'pass', numbers, coverage: block.coverage, failures };
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
 * Owner mode: a summary that says `ownerMode.coverage: not-measured` (the owner's specs.unit off) passes on its other
 * conditions with `coverage: 'not-measured'` and the owner-mode `note`, never as a plain pass, and only when `specs` (the
 * owner switches the caller read) confirms unit is off; otherwise the claim is refused as sonar-proof-missing.
 */
export function judgeSummary(summary, gate, { specs = null } = {}) {
  if (!summary || typeof summary !== 'object' || !String(summary.schema ?? '').startsWith(SCAN_SCHEMA_PREFIX))
    return { status: 'missing', code: 'sonar-proof-missing', detail: 'no sonar.json scan summary (schema starci/sonar-local-scan) is attached to the report', findings: [] };
  const why = String(summary.reason ?? '').replace(/\s+/g, ' ').slice(0, 300);
  switch (summary.outcome) {
    case 'pass':
      if (summary.scope !== 'slice') return { status: 'missing', code: 'sonar-proof-missing', detail: `the summary's scope is ${summary.scope ?? 'unknown'}, not the slice's own (scope slice is required)`, findings: [] };
      // Owner mode (specs.unit off): the slice passes on the other conditions, and the judgment says coverage was not measured.
      if (summary.ownerMode && specs?.unit !== false) return { status: 'missing', code: 'sonar-proof-missing', detail: 'the summary claims owner mode specs.unit=false (coverage not measured) but the owner config has unit tests on: rerun the scan', findings: [] };
      if (summary.ownerMode?.coverage === 'not-measured') return { status: 'pass', code: null, detail: null, coverage: 'not-measured', note: String(summary.ownerMode.note ?? 'owner mode: coverage not measured'), findings: [] };
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
