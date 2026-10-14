// Coverage metadata is adopted per rule; the pre-alpha.15 inventory remains visible as backlog.
import { effectiveSlot } from '../../hfs/edition-slots.mjs';

const META_FIELDS = Object.freeze(['editions', 'docs', 'exemplifiedBy', 'proves', 'witness']);
export const REPORT_ONLY_CODES = Object.freeze(['RT_COVERAGE_NO_WITNESS', 'RT_COVERAGE_NO_EXAMPLE']);
const ruleNumber = (rule) => Number(/^R([0-9]+)$/.exec(rule.id)?.[1] ?? Infinity);
const list = (value) => Array.isArray(value) ? value : [];

export function legacyCoverageRule(rule) {
  return ruleNumber(rule) < 247 && !META_FIELDS.some((field) => Object.hasOwn(rule, field));
}

export function coverageRuleFindingLevel(rule, code) {
  if (code === 'RT_COVERAGE_NO_ENFORCER') return 'error';
  if (legacyCoverageRule(rule)) return 'warning';
  if (!REPORT_ONLY_CODES.includes(code)) return 'error';
  return ruleNumber(rule) >= 247 && ruleNumber(rule) <= 292 ? 'error' : 'warning';
}

function referenceIndex(rules) {
  const index = new Map();
  for (const rule of rules) for (const ref of [rule.id, rule.code, ...list(rule.failureCodes)]) index.set(ref, rule);
  return index;
}

function slotReferences(slot, context, edition) {
  const editions = edition ? [edition] : context.manifest.editions ?? ['lite', 'full'];
  const profiles = slot.profiles ?? context.manifest.profiles ?? ['app'];
  return editions.flatMap((view) => profiles.flatMap((profile) => list(effectiveSlot(slot, profile, view).rules)));
}

function findingReferences(finding, context, index) {
  const explicit = list(finding.rules);
  if (index.has(finding.rule)) return [finding.rule, ...explicit];
  const slot = (context.manifest.slots ?? []).find((item) => item.id === (finding.slot ?? finding.rule));
  if (slot) return [...slotReferences(slot, context, finding.edition), ...explicit];
  return explicit;
}

/** Preserve global inventory errors unless the finding identifies an exclusively legacy chain. */
export function applyCoverageRatchet(context, findings) {
  const index = referenceIndex(context.catalog.rules);
  return findings.map((finding) => {
    if (finding.code === 'RT_COVERAGE_NO_ENFORCER') return { ...finding, level: 'error' };
    const references = findingReferences(finding, context, index);
    const rules = references.map((reference) => index.get(reference));
    const legacy = rules.length > 0 && rules.every((rule) => rule && legacyCoverageRule(rule));
    const witnessGate = rules.some((rule) => rule && ruleNumber(rule) >= 247 && ruleNumber(rule) <= 292);
    const reportOnly = REPORT_ONLY_CODES.includes(finding.code) && !witnessGate;
    const level = legacy || reportOnly ? 'warning' : 'error';
    return { ...finding, level, ...(legacy ? { legacy: true } : {}) };
  });
}
