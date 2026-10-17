// Per-rule and per-slot evidence in the two edition views of the existing catalogs.
import { braceVariants } from '../../lib/glob.mjs';
import { compileVariant } from '../../hfs/slot-match.mjs';
import { EDITIONS } from '../../hfs/manifest-shape.mjs';
import { enforcerJudgedInEdition, judgedInEdition } from '../../hfs/edition-slots.mjs';
import { codesInEdition, evidenceFiles, evidenceInEdition, evidencePath, exampleEvidence, managedTemplates, slotViews, templateEvidence } from './coverage-inventory.mjs';
import { coverageGateFindings } from './coverage-gates.mjs';
import { hasRulingReference } from './coverage-cites.mjs';
import { REPORT_ONLY_CODES } from './coverage-ratchet.mjs';
import { claimedSpecProof, coverageProofFindings } from './coverage-proofs.mjs';
import { coverageRoutingFindings } from './coverage-routing.mjs';

export { REPORT_ONLY_CODES };
const finding = (code, rule, edition, message, path = 'knowledge/hfs/rules.yaml') =>
  ({ code, level: REPORT_ONLY_CODES.includes(code) ? 'warning' : 'error', rule, edition, path, message });
const refsIn = (refs, edition) => (Array.isArray(refs) ? refs : []).filter((ref) => evidenceInEdition(ref, edition));
const relatedSlots = (rule, views) => views.filter(({ slot }) => (slot.rules ?? []).some((code) => code === rule.id || rule.failureCodes.includes(code)));

function enforcerExists(context, enforcer, rule) {
  if (['eslint-be', 'eslint-fe', 'stylelint'].includes(enforcer.kind)) {
    return context.plugins?.[enforcer.kind]?.ids?.has(enforcer.id) ?? false;
  }
  if (enforcer.at) return context.files.has(enforcer.at) && rule.failureCodes.some((code) => context.files.get(enforcer.at).includes(code));
  return false;
}

const TEST_TITLE = /(?:^|\W)(?:test|it|describe|t\.test)\s*\(\s*(['"`])([^'"`\n]+)\1/g;
const NEGATIVE_TITLE = /\b(?:invalid|violat\w*|refus\w*|reject\w*|deni\w*|fail\w*|negative|forbid\w*|missing)\b/i;
const POSITIVE_TITLE = /\b(?:valid|pass\w*|accept\w*|conform\w*|positive)\b/i;
const escapeRegExp = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const wordIn = (title, word) => new RegExp(String.raw`\b${escapeRegExp(word)}\b`, 'i').test(title);
const inEdition = (title, edition) => wordIn(title, edition) || /\$\{[^}]*edition[^}]*\}/i.test(title);

/** A header claim of code@edition needs one violating and one passing test titled for that edition (named fixtures count as the violating side). */
function specProves(text, code, edition, fixtures) {
  const claimed = text.split(/\r?\n/).some((line) => /^\s*\/\/\s*proves:\s*/.test(line)
    && line.replace(/^\s*\/\/\s*proves:\s*/, '').split(/[\s,]+/).includes(`${code}@${edition}`));
  if (!claimed) return false;
  const titles = [...text.matchAll(TEST_TITLE)].map((match) => match[2]).filter((title) => inEdition(title, edition));
  const passing = titles.some((title) => POSITIVE_TITLE.test(title));
  if (Array.isArray(fixtures) && fixtures.length) return passing && fixtures.every((fixture) => titles.some((title) => wordIn(title, fixture)));
  return passing && titles.some((title) => NEGATIVE_TITLE.test(title));
}

/** Whether the rule's `specNa` (or `exampleNa`) waives that leg: a reason that cites an owner ruling (owner:no-runtime-specs: the runtime has no specs of its own). */
const legWaived = (context, rule, key) => typeof rule[key] === 'string' && rule[key].trim().length > 0 && hasRulingReference(rule[key], context);

function proofExists(context, rule, code, edition) {
  return refsIn(rule.proves, edition).some((ref) => (!ref.codes || ref.codes.includes(code))
    && (claimedSpecProof(context, ref, code, edition) || evidenceFiles(context.files, ref).some((file) => file.endsWith('.spec.mjs')
      && specProves(String(context.files.get(file)), code, edition, typeof ref === 'string' ? undefined : ref.fixtures))));
}

function docExists(context, ref, code) {
  const name = evidencePath(ref) ?? '';
  const [file, anchor] = name.split('#');
  const text = context.files.get(file);
  if (text === undefined || !new RegExp(String.raw`\b${code}\b`).test(text)) return false;
  if (!anchor) return true;
  return text.includes(`id="${anchor}"`) || text.includes(`{#${anchor}}`)
    || text.split(/\r?\n/).filter((line) => /^\s*#{1,6}\s/.test(line)).some((line) => line.replace(/^\s*#{1,6}\s+/, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') === anchor);
}

function validWitness(context, rule, edition) {
  if (rule.witness?.status === 'unreachable') return typeof rule.witness.reason === 'string' && rule.witness.reason.trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(rule.witness.date ?? '');
  return (Array.isArray(rule.witness) ? rule.witness : []).some((witness) => {
    if (witness.path) return fixtureEvidence(context, witness, edition, codesInEdition(rule, edition));
    return witness.edition === edition
      && (context.examples ?? []).some((example) => example.path === witness.base && example.edition === edition)
      && witness.mutate?.length > 0 && witness.expect?.some((code) => codesInEdition(rule, edition).includes(code));
  });
}

/** Spec evidence of an example or witness: a spec in the edition that proves a relevant finding code (the runtime keeps no fixture records: owner ruling no-runtime-specs). */
export function fixtureEvidence(context, ref, edition, codes) {
  if (!evidenceInEdition(ref, edition)) return false;
  const relevant = codes.filter((code) => !ref.codes || ref.codes.includes(code));
  if (!relevant.length) return false;
  return evidenceFiles(context.files, ref).some((file) => {
    const text = String(context.files.get(file) ?? '');
    if (!text.trim()) return false;
    if (!file.endsWith('.spec.mjs')) return false;
    return relevant.some((code) => claimedSpecProof(context, ref, code, edition));
  });
}

function ruleEvidence(context, rule, edition, templates) {
  const out = [];
  const add = (code, message) => out.push(finding(code, rule.id, edition, `${rule.id} ${edition}: ${message}`));
  const enforcers = (rule.enforcers ?? []).filter((enforcer) => enforcer.status !== 'planned' && !enforcer.planned
    && enforcerJudgedInEdition(context.catalog.rules, enforcer.kind, enforcer.id, edition) && enforcerExists(context, enforcer, rule));
  if (!enforcers.length) add('RT_COVERAGE_NO_ENFORCER', 'no existing enforcer runs in this edition');
  const codes = codesInEdition(rule, edition);
  for (const code of codes) {
    if (!proofExists(context, rule, code, edition) && !legWaived(context, rule, 'specNa')) add('RT_COVERAGE_NO_SPEC', `${code} has no named spec with a // proves: ${code}@${edition} header`);
    if (!refsIn(rule.docs, edition).some((ref) => docExists(context, ref, code))) add('RT_COVERAGE_NO_DOC', `${code} has no existing documentation reference that explains it`);
    out.push(...coverageProofFindings(context, rule, code, edition).map((item) => ({...item, code: 'RT_COVERAGE_PROOF_VACUOUS'})),
      ...coverageRoutingFindings(context, rule, code, edition).map((item) => ({...item, code: 'RT_COVERAGE_CODE_UNROUTED'})));
  }
  if (!validWitness(context, rule, edition)) add('RT_COVERAGE_NO_WITNESS', 'no mutation witness or dated unreachable reason is declared');
  const owned = relatedSlots(rule, slotViews(context.manifest, edition));
  const hasTemplate = refsIn(rule.exemplifiedBy, edition).some((ref) => templateEvidence(context.files, ref).length)
    || owned.some(({ slot }) => templates.templates.get(slot.id)?.length);
  const templateNa = typeof rule.templateNa === 'string' && rule.templateNa.trim().length > 0;
  if (!hasTemplate && !templateNa) add('RT_COVERAGE_NO_TEMPLATE', 'no existing template, managed slot template or templateNa reason covers this edition');
  if (!legWaived(context, rule, 'exampleNa') && !refsIn(rule.exemplifiedBy, edition).some((ref) => exampleEvidence(context, ref, edition).length
    || fixtureEvidence(context, ref, edition, codes))) add('RT_COVERAGE_NO_EXAMPLE', 'no existing example or dedicated fixture is named for this edition');
  out.push(...coverageGateFindings(context, rule, edition));
  return out;
}

function asymmetryFindings(context, rule) {
  const out = [];
  const justified = (why) => typeof why === 'string' && why.trim() && hasRulingReference(why, context);
  if ((rule.editions ?? EDITIONS).length !== EDITIONS.length && !justified(rule.editionWhy)) out.push(finding('RT_COVERAGE_EDITION_ASYMMETRY', rule.id, undefined, `${rule.id} restricts editions without an editionWhy citing an existing ruling case`));
  for (const enforcer of rule.enforcers ?? []) {
    const editions = EDITIONS.filter((edition) => judgedInEdition(rule, edition));
    if (editions.some((edition) => !enforcerJudgedInEdition(context.catalog.rules, enforcer.kind, enforcer.id, edition))
      && !justified(enforcer.editionWhy ?? rule.editionWhy)) out.push(finding('RT_COVERAGE_EDITION_ASYMMETRY', rule.id, undefined, `${rule.id} ${enforcer.kind}:${enforcer.id} differs by edition without an editionWhy citing an existing ruling case`));
  }
  return out;
}

function slotMatches(slot, profile, example, file) {
  const scope = profile === 'app' ? '' : `${profile}/`;
  const base = `${example.path}/${scope}`;
  if (!file.startsWith(base)) return false;
  return braceVariants(slot.path).some((variant) => compileVariant(slot, variant).regex.test(file.slice(base.length)));
}

function slotHasTemplate(context, slot, edition, templates) {
  const explicit = [slot.template, slot.scaffold, ...refsIn(slot.exemplifiedBy, edition)];
  const associated = context.catalog.rules.filter((rule) => (slot.rules ?? []).some((code) => code === rule.id || rule.failureCodes.includes(code)));
  return templates.templates.get(slot.id)?.length || explicit.some((ref) => templateEvidence(context.files, ref).length)
    || associated.some((rule) => refsIn(rule.exemplifiedBy, edition).some((ref) => templateEvidence(context.files, ref).length));
}

function slotNeedsTemplate(original, slot) {
  return slot.presence === 'required' || original.managedBy || original.liteManagedBy || slot.scaffold && slot.scaffold !== 'none';
}

function slotTemplateWaived(slot) {
  return typeof slot.templateNa === 'string' && slot.templateNa.trim()
    || slot.scaffold === 'none' && typeof slot.reason === 'string' && slot.reason.trim();
}

function slotHasExample(context, slot, profile, edition) {
  return (context.examples ?? []).some((example) => example.edition === edition
    && example.files.some((file) => slotMatches(slot, profile, example, file)));
}

function slotEvidence(context, edition, templates) {
  const out = [];
  for (const { original, slot, profile } of slotViews(context.manifest, edition)) {
    if (slotNeedsTemplate(original, slot) && !slotHasTemplate(context, slot, edition, templates) && !slotTemplateWaived(slot)) {
      out.push(finding('RT_COVERAGE_NO_TEMPLATE', slot.id, edition, `${slot.id} ${edition}: ${profile} slot has no existing template or scaffold path`, 'knowledge/hfs/slots.yaml'));
    }
    if (!slotHasExample(context, slot, profile, edition) && !legWaived(context, slot, 'exampleNa')) {
      out.push(finding('RT_COVERAGE_NO_EXAMPLE', slot.id, edition, `${slot.id} ${edition}: no example file or dedicated fixture exercises the ${profile} slot`, 'knowledge/hfs/slots.yaml'));
    }
  }
  return out;
}

/** Static findings, independent of the filesystem and suitable for small fixture catalogs. */
export function coverageRuleFindings(context) {
  const out = [];
  for (const rule of context.catalog.rules) out.push(...asymmetryFindings(context, rule));
  for (const slot of context.manifest.slots ?? []) {
    const differs = slot.editions?.length === 1 || slot.lite !== undefined || slot.litePresence !== undefined || slot.liteManagedBy !== undefined;
    if (differs && !hasRulingReference(slot.editionWhy, context)) out.push(finding('RT_COVERAGE_EDITION_ASYMMETRY', slot.id, undefined, `${slot.id} changes by edition without an editionWhy citing an existing ruling case`, 'knowledge/hfs/slots.yaml'));
  }
  for (const edition of context.manifest.editions ?? EDITIONS) {
    const templates = managedTemplates(context, edition);
    for (const rule of context.catalog.rules.filter((item) => judgedInEdition(item, edition))) out.push(...ruleEvidence(context, rule, edition, templates));
    out.push(...slotEvidence(context, edition, templates));
    for (const missing of templates.missing) out.push(finding('RT_COVERAGE_NO_TEMPLATE', missing.slot, edition, `${missing.slot} ${edition}: ${missing.message}`, 'knowledge/hfs/slots.yaml'));
  }
  return out;
}
