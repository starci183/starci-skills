// Coverage metadata is adopted per rule or slot; the pre-alpha.15 inventory remains visible as backlog.

import { list } from '../../lib/list.mjs';

const META_FIELDS = Object.freeze(['editions', 'docs', 'exemplifiedBy', 'proves', 'witness']);
const SLOT_META_FIELDS = Object.freeze(['templateNa', 'exemplifiedBy', 'editionWhy', 'scaffold']);
// alpha.14 shipped slot manifest 3.1.0; later additions cannot enter the legacy backlog.
const LEGACY_SLOT_VERSION = Object.freeze([3, 1, 0]);
export const REPORT_ONLY_CODES = Object.freeze(['RT_COVERAGE_NO_WITNESS', 'RT_COVERAGE_NO_EXAMPLE']);
const ruleNumber = (rule) => Number(/^R([0-9]+)$/.exec(rule.id)?.[1] ?? Infinity);

export function legacyCoverageRule(rule) {
  return ruleNumber(rule) < 247 && !META_FIELDS.some((field) => Object.hasOwn(rule, field));
}

export function legacyCoverageSlot(slot) {
  if (SLOT_META_FIELDS.some((field) => Object.hasOwn(slot, field))) return false;
  if (slot.since === undefined) return false;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(slot.since);
  if (!match) return false;
  const version = match.slice(1).map(Number);
  for (const [index, component] of version.entries()) {
    if (component !== LEGACY_SLOT_VERSION[index]) return component < LEGACY_SLOT_VERSION[index];
  }
  return true;
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

function findingReferences(finding, index) {
  const explicit = list(finding.rules);
  if (index.has(finding.rule)) return [finding.rule, ...explicit];
  return explicit;
}

function withLevel(finding, level, legacy = false) {
  const { legacy: _previous, ...rest } = finding;
  return { ...rest, level, ...(legacy ? { legacy: true } : {}) };
}

/** Preserve global inventory errors unless the finding identifies an exclusively legacy chain. */
export function applyCoverageRatchet(context, findings) {
  const index = referenceIndex(context.catalog.rules);
  const slots = new Map((context.manifest.slots ?? []).map((slot) => [slot.id, slot]));
  return findings.map((finding) => {
    if (finding.code === 'RT_COVERAGE_NO_ENFORCER') return withLevel(finding, 'error');
    const slot = slots.get(finding.slot ?? finding.rule);
    if (slot) {
      const legacy = legacyCoverageSlot(slot);
      return withLevel(finding, legacy ? 'warning' : 'error', legacy);
    }
    const references = findingReferences(finding, index);
    const rules = references.map((reference) => index.get(reference));
    const legacy = rules.length > 0 && rules.every((rule) => rule && legacyCoverageRule(rule));
    const witnessGate = rules.some((rule) => rule && ruleNumber(rule) >= 247 && ruleNumber(rule) <= 292);
    const reportOnly = REPORT_ONLY_CODES.includes(finding.code) && !witnessGate;
    const level = legacy || reportOnly ? 'warning' : 'error';
    return withLevel(finding, level, legacy);
  });
}
