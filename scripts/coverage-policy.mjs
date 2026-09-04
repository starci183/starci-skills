// Resolve the coverage bar from frozen request evidence; never execute a project configuration.
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';

export const COVERAGE_METRICS = ['statements', 'lines', 'functions', 'branches'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const percentage = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const blank = () => Object.fromEntries(COVERAGE_METRICS.map(metric => [metric, null]));
const fail = message => { throw new Error(message); };

export function requestedCoverageThresholds(value) {
  const result = blank();
  const maps = value == null ? [] : Array.isArray(value) ? value : [value];
  for (const map of maps) {
    if (!object(map) || Object.keys(map).some(key => !COVERAGE_METRICS.includes(key))) fail('thresholds must contain only coverage metric maps');
    for (const metric of COVERAGE_METRICS) {
      if (!Object.hasOwn(map, metric) || map[metric] === null) continue;
      if (!percentage(map[metric])) fail(`requested threshold for ${metric} must be a percentage or null`);
      result[metric] = result[metric] === null ? map[metric] : Math.max(result[metric], map[metric]);
    }
  }
  return result;
}

export function configuredCoverageThresholds(report) {
  if (!object(report) || typeof report.version !== 'string' || !/^29\.\d+\.\d+(?:[-+].*)?$/.test(report.version) ||
    !object(report.globalConfig) || !Array.isArray(report.configs) || report.configs.length === 0 ||
    report.configs.some(config => !object(config))) fail('unsupported or incomplete resolved coverage configuration report');
  if (Object.hasOwn(report, 'coverageThreshold') || report.configs.some(config => Object.hasOwn(config, 'coverageThreshold'))) {
    fail('project-local or ambiguous coverage thresholds are unsupported by this report adapter');
  }
  if (!Object.hasOwn(report.globalConfig, 'coverageThreshold')) return blank();
  const thresholds = report.globalConfig.coverageThreshold;
  if (!object(thresholds) || Object.keys(thresholds).some(key => key !== 'global')) fail('scoped or non-object coverage thresholds are unsupported by this report adapter');
  if (!Object.hasOwn(thresholds, 'global')) return blank();
  if (!object(thresholds.global) || Object.values(thresholds.global).some(value => !percentage(value))) {
    fail('count-based or non-percentage coverage thresholds are unsupported by this report adapter');
  }
  return requestedCoverageThresholds(thresholds.global);
}

const samePath = (left, right) => {
  const a = path.resolve(left), b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};
function readPolicy(root, branchDir, request) {
  const policy = request.requirements.coveragePolicy;
  const schema = JSON.parse(readFileSync(path.join(root, 'templates/kinds/coverage.schema.json'), 'utf8'));
  const errors = validateAgainst({ ...schema, $ref: '#/$defs/policyEvidence' }, policy, 'coveragePolicy');
  if (errors.length) fail(errors.join('; '));
  const plan = request.requirements.gates;
  const units = Array.isArray(plan) ? plan.filter(gate => gate.gate === 'unit-coverage') : [];
  if (units.length !== 1) fail('coveragePolicy requires exactly one explicit planned unit-coverage gate');
  const unit = units[0];
  const heads = (request.contexts ?? []).filter(context => ['@workspaces/be', '@workspaces/fe'].includes(context.alias)).map(context => context.head);
  if (heads.length === 0 || heads.some(head => head !== policy.sourceHead)) fail('coveragePolicy sourceHead differs from the frozen source');
  if (policy.commandRef !== unit.commandRef || policy.configRef !== unit.configRef) fail('coveragePolicy commandRef or configRef differs from the planned unit gate');
  const base = realpathSync(branchDir);
  const file = path.resolve(base, policy.evidenceRef);
  const relative = path.relative(base, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
    !samePath(realpathSync(file), file) || !lstatSync(file).isFile()) fail('coveragePolicy evidence must be a regular artifact inside its request branch');
  const bytes = readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== policy.evidenceSha256) fail('coveragePolicy evidence hash differs from the frozen request');
  let report;
  try { report = JSON.parse(bytes.toString('utf8')); } catch { fail('coveragePolicy evidence is not a readable resolved configuration report'); }
  return configuredCoverageThresholds(report);
}

export function validateCoveragePolicyRequest(root, branchDir, request) {
  try {
    requestedCoverageThresholds(request.requirements?.thresholds);
    if (request.requirements?.coveragePolicy != null) readPolicy(root, branchDir, request);
    return [];
  } catch (error) {
    return [`request.json: ${error.code ? 'coveragePolicy evidence cannot be read safely' : error.message}`];
  }
}

export function coveragePolicyResult(root, branchDir, request, coverage) {
  const result = { errors: [], expected: null, requireCompleteTable: false };
  try {
    const requested = requestedCoverageThresholds(request.requirements?.thresholds);
    const hasPolicy = request.requirements?.coveragePolicy != null;
    result.requireCompleteTable = hasPolicy || COVERAGE_METRICS.some(metric => requested[metric] === null || coverage?.thresholds?.[metric] === null);
    if (!hasPolicy && result.requireCompleteTable) fail('coverage requires frozen coveragePolicy evidence when a configured bar must be derived or a threshold is null; [] does not prove absence');
    const configured = hasPolicy ? readPolicy(root, branchDir, request) : blank();
    result.expected = Object.fromEntries(COVERAGE_METRICS.map(metric => {
      const bars = [configured[metric], requested[metric]].filter(value => value !== null);
      return [metric, bars.length ? Math.max(...bars) : null];
    }));
    for (const metric of COVERAGE_METRICS) {
      if (coverage?.thresholds?.[metric] !== result.expected[metric]) result.errors.push(`response/data/coverage.json: threshold for ${metric} is ${coverage?.thresholds?.[metric]} but the request pinned an effective bar of ${result.expected[metric]} with its configured policy`);
    }
  } catch (error) {
    result.errors.push(`response/data/coverage.json: ${error.code ? 'coveragePolicy evidence cannot be read safely' : error.message}`);
  }
  return result;
}

export function coverageTableErrors(rows, coverage, requireCompleteTable) {
  const errors = [], seen = new Set();
  for (const [metric, measured, threshold, verdict] of rows ?? []) {
    if (!COVERAGE_METRICS.includes(metric) || seen.has(metric)) { errors.push('response/response.md: Coverage has an unknown or repeated metric'); continue; }
    seen.add(metric);
    const bar = coverage?.thresholds?.[metric];
    const expectedVerdict = bar === null ? 'unconfigured' : coverage?.[metric] < bar ? 'below' : 'at-or-above';
    if (String(measured) !== String(coverage?.[metric]) || threshold !== (bar === null ? '—' : String(bar)) || verdict !== expectedVerdict) {
      errors.push(`response/response.md: Coverage ${metric} differs from the measured value, threshold or verdict`);
    }
  }
  if (requireCompleteTable && COVERAGE_METRICS.some(metric => !seen.has(metric))) errors.push('response/response.md: evidence-bound coverage must print all four metrics');
  return errors;
}
