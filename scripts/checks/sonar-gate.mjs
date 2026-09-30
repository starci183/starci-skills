// sonar-gate.mjs - the Sonar quality gate as data plus its pure judgments (knowledge/sonar-gate.yaml).
//
// The thresholds live in that one knowledge file; nothing here restates a number. Three readers use it:
//   scripts/checks/sonar-local.mjs      judges a slice's changed lines (issues, duplication, coverage, hotspots)
//                                       and makes the server gate `gate.name` carry `serverConditions(gate)`
//   scripts/checks/check-starcistacks.mjs  refuses a declaration whose services.sonar.qualityGate is not `gate.name`
//   scripts/kernel/sonar-settle.mjs     `judgeSummary` reads the sonar.json an op attached and says whether the
//                                       op may settle done (`enforcedOps`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

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
 * The conditions the server gate carries: [{metric, op, error}] (SonarQube api/qualitygates conditions): the new-code ones,
 * then the overall-code ones (open issues of any origin, imported HFS/ESLint/stylelint findings included, and duplication).
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
  out.push({ metric: o.issues.metric, op: 'GT', error: String(o.issues.max) }, { metric: o.duplication.metric, op: 'GT', error: String(o.duplication.maxPercent) });
  return out;
}

/** The ops the runtime holds to the gate at settle. */
export const enforcedOps = (gate) => new Set(gate.enforcedOps);

/** What the slice verdict is judged against: the numbers a scan copies into its summary (`gate`). */
export function thresholdsOf(gate) {
  const n = gate.newCode;
  return {
    name: gate.gate.name,
    coverageMinPercent: n.coverage.minPercent,
    ignoreBelowChangedLines: n.coverage.ignoreBelowChangedLines,
    duplicationMaxPercent: n.duplication.maxPercent,
    blockingSeverities: [...n.issues.blockingSeverities],
    blockingIssuesMax: n.issues.max,
    unreviewedHotspotsMax: n.hotspots.unreviewedMax,
  };
}

/**
 * What a filed sonar.json says, as a settle judgment. `summary` is the parsed scan summary (or null when the op attached
 * none). Returns {status, code, detail, findings[]}:
 *   pass         the slice meets the gate (or Sonar is disabled by the repository's own declaration - noted)
 *   red          the slice fails the gate on new code: findings[] names every failing condition
 *   unavailable  the scan could not run (server down, custody missing, token rejected): never a pass
 *   refused      the scan was refused before it ran (stale or missing coverage, unknown base ...): the op fixes and reruns
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
