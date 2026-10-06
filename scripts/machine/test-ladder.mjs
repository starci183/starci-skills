// test-ladder.mjs - the single L0-L5 scope model used by every ladder verb.
// Keeping the matrix here prevents test, lint, check and typecheck from giving the same level different meanings.

export const LEVELS = Object.freeze(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);

const MODEL = Object.freeze({
  L0: Object.freeze({
    specs: Object.freeze([]),
    lint: Object.freeze(['staged-files', 'format']),
    checks: Object.freeze(['work-hygiene']),
    typecheck: Object.freeze([]),
  }),
  L1: Object.freeze({
    specs: Object.freeze(['changed-unit', 'importers']),
    lint: Object.freeze(['changed-files']),
    checks: Object.freeze(['checks-touching-change']),
    typecheck: Object.freeze(['projects-holding-changed-files']),
  }),
  L2: Object.freeze({
    specs: Object.freeze(['dependent-specs']),
    lint: Object.freeze(['changed-files']),
    checks: Object.freeze(['full']),
    typecheck: Object.freeze(['affected-projects']),
  }),
  L3: Object.freeze({
    specs: Object.freeze(['dependent-specs', 'affected-integration', 'affected-contract', 'affected-e2e']),
    lint: Object.freeze(['changed-files']),
    checks: Object.freeze(['full']),
    typecheck: Object.freeze(['affected-projects']),
  }),
  L4: Object.freeze({
    specs: Object.freeze(['all-runtime', 'all-packages', 'all-example-unit', 'all-example-integration', 'all-example-e2e', 'all-example-contract']),
    lint: Object.freeze(['whole-repo', 'stylelint']),
    checks: Object.freeze(['full', 'every-example', 'sonar-zero', 'coverage-per-component']),
    typecheck: Object.freeze(['every-project']),
  }),
  L5: Object.freeze({
    specs: Object.freeze(['all-runtime', 'all-packages', 'all-example-unit', 'all-example-integration', 'all-example-e2e', 'all-example-contract']),
    lint: Object.freeze(['whole-repo', 'stylelint']),
    checks: Object.freeze(['full', 'every-example', 'sonar-zero', 'coverage-per-component']),
    typecheck: Object.freeze(['every-project']),
  }),
});

/** The immutable scope row for one ladder level. L5 is descriptive only: local verbs refuse it. */
export function scopeFor(level) {
  if (!LEVELS.includes(level)) throw new RangeError(`unknown test ladder level ${String(level)}`);
  return MODEL[level];
}

/** Normalize one catalog list flag (undefined, a string or repeated values) to unique repository paths. */
export function pathList(value) {
  let values;
  if (Array.isArray(value)) values = value;
  else if (value == null) values = [];
  else values = [value];
  return [...new Set(values.flatMap((item) => String(item).split(',')).map((item) => item.trim().replaceAll('\\', '/').replace(/^\.\//, '')).filter(Boolean))];
}

/** A consistent machine envelope for ladder verbs. */
export function ladderResult({ schema, level, scope = [], ok, findings = [], ...extra }) {
  const data = { schema, level, scope: [...scope], ok: Boolean(ok), findings: [...findings], ...extra };
  const head = `${schema}: ${ok ? 'GREEN' : 'RED'} ${level} (${scope.length} scope item(s), ${findings.length} finding(s))`;
  // A red run names what is red: the first lines of each finding, so the caller never has to re-run with --json to learn why.
  const detail = ok ? [] : findings.flatMap((finding) => String(finding.message ?? '').split(/\r?\n/).filter(Boolean).slice(0, 12).map((line) => `  ${line.slice(0, 300)}`));
  return { code: ok ? 0 : 1, text: [head, ...detail].join('\n'), data };
}

/** A usage or policy refusal is code 2 while preserving the same JSON shape as a completed run. */
export function ladderRefusal({ schema, level, message, scope = [] }) {
  const finding = { kind: 'refusal', message };
  return { code: 2, text: message, data: { schema, level: level ?? null, scope: [...scope], ok: false, findings: [finding] } };
}
