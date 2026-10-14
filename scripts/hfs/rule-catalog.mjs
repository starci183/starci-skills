// rule-catalog.mjs - the parsed and validated HFS rule catalog.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYamlCached } from '../lib/yaml-cached.mjs';
import { jsonClone } from '../lib/json-clone.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { SEMVER } from './manifest-shape.mjs';
import { enforcerJudgedInEdition, judgedInEdition, ruleEditionProblems } from './edition-slots.mjs';
import { fail } from './slot-errors.mjs';

const HFS_RULES_FILE = 'knowledge/hfs/rules.yaml';
const RULE_GATES = Object.freeze(['pre-commit', 'pre-push', 'settle', 'land', 'ci', 'sonar', 'runtime']);
const ENFORCER_FAMILIES = Object.freeze(['eslint-be', 'eslint-fe', 'stylelint', 'machine', 'hfs', 'work-validate', 'sonar', 'runtime']);
const RULE_KINDS = Object.freeze(['codemod', 'lint', 'check', 'design']);
const FINDING_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const ENFORCER_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FILE_ENFORCERS = new Set(['machine', 'hfs', 'work-validate', 'sonar', 'runtime']);
const RULE_KEYS = new Set(['id', 'code', 'law', 'scope', 'kinds', 'gates', 'failureCodes', 'editions', 'codeEditions', 'enforcers', 'cases', 'docs', 'exemplifiedBy', 'proves', 'witness', 'editionWhy', 'amendedBy']);
const CASE_KEYS = new Set(['id', 'date', 'source', 'ruling', 'quote', 'supersedes', 'status', 'staleWhen', 'amendedBy']);
const CASE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENFORCER_KEYS = new Set(['kind', 'id', 'status', 'at', 'editions', 'editionWhy']);
const CASE_REFERENCE = /^(?:case-[1-9][0-9]*|(?:ruling:)?R[0-9]{2,3}(?:\/case-[1-9][0-9]*)?|owner:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;
const EVIDENCE_KEYS = new Set(['path', 'edition', 'editions']);
const PROOF_KEYS = new Set([...EVIDENCE_KEYS, 'codes', 'fixtures']);
const WITNESS_KEYS = new Set(['edition', 'base', 'mutate', 'expect']);
const MUTATION_KEYS = new Set(['op', 'path', 'content']);

function textProblem(value, label, bad) {
  if (typeof value !== 'string' || !value.trim()) bad.push(`${label} must be non-empty text`);
}

function dateProblem(value, label, bad) {
  const date = typeof value === 'string' && CASE_DATE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString() !== `${value}T00:00:00.000Z`) bad.push(`${label} must be a valid YYYY-MM-DD date`);
}

function relativePathProblem(value, label, bad, anchor = false) {
  const parts = typeof value === 'string' ? value.split('#') : [];
  const file = parts[0];
  const valid = typeof value === 'string' && value.trim() === value && value.length > 0
    && !/[\r\n\u0000\\]/.test(value) && !/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(value) && !file.includes(':')
    && !file.split('/').some((part) => ['', '.', '..'].includes(part))
    && (parts.length === 1 || (anchor && parts.length === 2 && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(parts[1])));
  if (!valid) bad.push(`${label} must be a repository-relative path${anchor ? ' with an optional #anchor' : ''}`);
}

function unknownKeys(item, allowed, label, bad) {
  for (const key of Object.keys(item)) if (!allowed.has(key)) bad.push(`${label} has unknown key ${key}`);
}

function nonEmptyList(value, label, bad) {
  if (!Array.isArray(value) || !value.length) { bad.push(`${label} must be a non-empty list`); return false; }
  const normalized = value.map((value) => JSON.stringify(value, (_key, item) => isPlainObject(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));
  if (new Set(normalized).size !== value.length) bad.push(`${label} repeats a value`);
  return true;
}

function optionalText(item, key, label, bad) {
  if (item[key] !== undefined) textProblem(item[key], `${label}.${key}`, bad);
}

function evidenceEditionProblems(item, label, bad) {
  if (item.edition !== undefined && !['full', 'lite'].includes(item.edition)) bad.push(`${label}.edition must be full or lite`);
  bad.push(...ruleEditionProblems(item, label));
  if (item.edition !== undefined && item.editions !== undefined) bad.push(`${label} names edition or editions, not both`);
}

function codeListProblems(codes, label, bad) {
  if (!nonEmptyList(codes, label, bad)) return;
  for (const code of codes) if (typeof code !== 'string' || !FINDING_CODE.test(code)) bad.push(`${label} must contain UPPER_SNAKE finding codes`);
}

function evidenceMapProblems(item, key, label, bad) {
  unknownKeys(item, key === 'docs' ? EVIDENCE_KEYS : PROOF_KEYS, label, bad);
  relativePathProblem(item.path, `${label}.path`, bad, key === 'docs');
  evidenceEditionProblems(item, label, bad);
  if (item.codes !== undefined) codeListProblems(item.codes, `${label}.codes`, bad);
  if (item.fixtures !== undefined && nonEmptyList(item.fixtures, `${label}.fixtures`, bad)) item.fixtures.forEach((value) => textProblem(value, `${label}.fixtures`, bad));
}

function evidenceProblems(rule, key, label, bad) {
  if (rule[key] === undefined || !nonEmptyList(rule[key], `${label}.${key}`, bad)) return;
  rule[key].forEach((item, index) => {
    const at = `${label}.${key}[${index}]`;
    if (typeof item === 'string') { relativePathProblem(item, at, bad, key === 'docs'); return; }
    if (!isPlainObject(item)) { bad.push(`${at} must be a path or a map`); return; }
    evidenceMapProblems(item, key, at, bad);
  });
}

function mutationProblems(item, label, bad) {
  if (!isPlainObject(item)) { bad.push(`${label} must be a map`); return; }
  unknownKeys(item, MUTATION_KEYS, label, bad);
  if (!['add', 'edit', 'delete'].includes(item.op)) bad.push(`${label}.op must be add, edit or delete`);
  relativePathProblem(item.path, `${label}.path`, bad);
  if (['add', 'edit'].includes(item.op) && typeof item.content !== 'string') bad.push(`${label}.content must be text for add or edit`);
  if (item.op === 'delete' && item.content !== undefined) bad.push(`${label}.content is absent for delete`);
}

function witnessEntryProblems(item, label, bad) {
  if (!isPlainObject(item)) { bad.push(`${label} must be a map`); return; }
  if (Object.hasOwn(item, 'path')) { evidenceMapProblems(item, 'proves', label, bad); return; }
  unknownKeys(item, WITNESS_KEYS, label, bad);
  if (!['full', 'lite'].includes(item.edition)) bad.push(`${label}.edition must be full or lite`);
  relativePathProblem(item.base, `${label}.base`, bad);
  codeListProblems(item.expect, `${label}.expect`, bad);
  if (nonEmptyList(item.mutate, `${label}.mutate`, bad)) item.mutate.forEach((mutation, index) => mutationProblems(mutation, `${label}.mutate[${index}]`, bad));
}

function witnessProblems(rule, label, bad) {
  const value = rule.witness;
  if (value === undefined) return;
  const at = `${label}.witness`;
  if (isPlainObject(value)) {
    unknownKeys(value, new Set(['status', 'reason', 'date']), at, bad);
    if (value.status !== 'unreachable') bad.push(`${at}.status must be unreachable`);
    textProblem(value.reason, `${at}.reason`, bad);
    dateProblem(value.date, `${at}.date`, bad);
    return;
  }
  if (!nonEmptyList(value, at, bad)) return;
  value.forEach((item, index) => witnessEntryProblems(item, `${at}[${index}]`, bad));
}

function caseReferenceProblems(value, label, bad) {
  const values = Array.isArray(value) ? value : [value];
  if (!nonEmptyList(values, label, bad)) return;
  for (const ref of values) if (typeof ref !== 'string' || !CASE_REFERENCE.test(ref)) bad.push(`${label} must name case-N, R<id>[/case-N], ruling:R<id>[/case-N] or owner:<id>`);
}

function caseTransitionProblems(item, label, bad) {
  if (item.status !== undefined && !['live', 'superseded', 'amended'].includes(item.status)) bad.push(`${label}.status must be live, superseded or amended`);
  for (const key of ['supersedes', 'amendedBy']) if (item[key] !== undefined) caseReferenceProblems(item[key], `${label}.${key}`, bad);
  if (item.staleWhen !== undefined && nonEmptyList(item.staleWhen, `${label}.staleWhen`, bad)) {
    for (const pattern of item.staleWhen) {
      if (typeof pattern !== 'string' || !pattern.trim()) { bad.push(`${label}.staleWhen must contain non-empty regex strings`); continue; }
      try { new RegExp(pattern, 'i'); } catch { bad.push(`${label}.staleWhen has an invalid regex ${JSON.stringify(pattern)}`); }
    }
  }
}

function vocabularyProblems(catalog, key, names, bad) {
  if (!isPlainObject(catalog[key])) { bad.push(`${key} must be a map`); return; }
  if (JSON.stringify(Object.keys(catalog[key])) !== JSON.stringify(names)) bad.push(`${key} must list exactly ${names.join(', ')} in that order`);
  for (const [name, text] of Object.entries(catalog[key])) {
    if (typeof text !== 'string' || !text.trim()) bad.push(`${key}.${name} needs a description`);
  }
}

function checkCatalogHeader(catalog, bad) {
  for (const key of Object.keys(catalog)) {
    if (!['schema', 'version', 'gates', 'enforcerKinds', 'rules'].includes(key)) bad.push(`unknown top-level key ${key}`);
  }
  const schemaOk = /^starci\/hfs-rules@\d+$/.test(String(catalog.schema));
  if (!schemaOk) bad.push('schema must be starci/hfs-rules@<major>');
  if (!SEMVER.test(String(catalog.version))) bad.push('version must be MAJOR.MINOR.PATCH');
  else if (schemaOk && catalog.schema.split('@')[1] !== catalog.version.split('.')[0]) bad.push('the major of version must equal the number after @ in schema');
  vocabularyProblems(catalog, 'gates', RULE_GATES, bad);
  vocabularyProblems(catalog, 'enforcerKinds', ENFORCER_FAMILIES, bad);
}

function enumListProblems(rule, label, key, allowed, bad) {
  if (!Array.isArray(rule[key]) || !rule[key].length) { bad.push(`${label}.${key} must be a non-empty list`); return []; }
  for (const value of rule[key]) {
    if (!allowed.includes(value)) bad.push(`${label}.${key} has ${JSON.stringify(value)}, not one of ${allowed.join(', ')}`);
  }
  if (new Set(rule[key]).size !== rule[key].length) bad.push(`${label}.${key} repeats a value`);
  return rule[key];
}

function checkRuleIdentity(rule, index, catalog, at, label, bad) {
  if (!/^R\d{2,3}$/.test(String(rule.id))) bad.push(`${at}.id must be R<two or three digits>`);
  else if (index > 0 && typeof catalog.rules[index - 1]?.id === 'string' && Number(rule.id.slice(1)) <= Number(catalog.rules[index - 1].id.slice(1))) bad.push(`${label} is out of order: ids must increase, and ${catalog.rules[index - 1].id} comes before it`);
  if (!FINDING_CODE.test(String(rule.code))) bad.push(`${label}.code must be an UPPER_SNAKE finding code`);
}

function checkRuleText(rule, label, bad) {
  if (typeof rule.law !== 'string' || !rule.law.trim()) bad.push(`${label}.law is missing`);
  if (typeof rule.law === 'string' && rule.law.includes('\n')) bad.push(`${label}.law must be one line`);
  if (rule.scope !== undefined && rule.scope !== 'runtime') bad.push(`${label}.scope is absent or runtime`);
}

/** The dated owner cases of a rule: each {id case-N, date, source owner, ruling, quote?}, ids unique (an owner ruling recorded where the law lives). */
function checkRuleCases(rule, label, bad) {
  if (rule.cases === undefined) return;
  if (!Array.isArray(rule.cases) || !rule.cases.length) { bad.push(`${label}.cases must be a non-empty list`); return; }
  const ids = new Set();
  rule.cases.forEach((item, index) => {
    const at = `${label}.cases[${index}]`;
    if (!isPlainObject(item)) { bad.push(`${at} is not a map`); return; }
    for (const key of Object.keys(item)) if (!CASE_KEYS.has(key)) bad.push(`${at} has unknown key ${key}`);
    if (typeof item.id !== 'string' || !/^case-[1-9][0-9]*$/.test(item.id) || ids.has(item.id)) bad.push(`${at}.id must be a unique case-N`);
    ids.add(item.id);
    if (typeof item.date !== 'string' || !CASE_DATE.test(item.date)) bad.push(`${at}.date must be YYYY-MM-DD`);
    if (item.source !== 'owner') bad.push(`${at}.source must be owner`);
    for (const key of ['ruling', ...(item.quote === undefined ? [] : ['quote'])]) if (typeof item[key] !== 'string' || !item[key].trim()) bad.push(`${at}.${key} must be text`);
    caseTransitionProblems(item, at, bad);
  });
}

function checkRuleGates(rule, label, gates, bad) {
  if (!gates.length) return;
  const runtimeGate = rule.scope === 'runtime' && gates.includes('runtime');
  if (!gates.includes('land') && !runtimeGate) bad.push(`${label} must run at land or, for runtime scope, the runtime gate`);
}

function checkRuleFailureCodes(rule, label, codeOwner, bad) {
  if (!Array.isArray(rule.failureCodes) || !rule.failureCodes.length || !rule.failureCodes.every((code) => FINDING_CODE.test(String(code)))) {
    bad.push(`${label}.failureCodes must be a non-empty list of UPPER_SNAKE codes`);
    return;
  }
  if (rule.failureCodes[0] !== rule.code) bad.push(`${label}.failureCodes must start with the rule's own code ${rule.code}`);
  if (new Set(rule.failureCodes).size !== rule.failureCodes.length) bad.push(`${label}.failureCodes repeats a code`);
  for (const code of rule.failureCodes) {
    if (codeOwner.has(code) && codeOwner.get(code) !== label) bad.push(`${label} names ${code}, which ${codeOwner.get(code)} already owns`);
    codeOwner.set(code, label);
  }
}

function checkCodeEditions(rule, label, bad) {
  const value = rule.codeEditions;
  if (value === undefined) return;
  if (!isPlainObject(value) || !Object.keys(value).length) { bad.push(`${label}.codeEditions must be a non-empty map`); return; }
  const editions = Array.isArray(rule.editions) ? rule.editions : ['full', 'lite'];
  for (const [code, selected] of Object.entries(value)) {
    const at = `${label}.codeEditions.${code}`;
    if (!Array.isArray(rule.failureCodes) || !rule.failureCodes.includes(code)) bad.push(`${at} must name a code owned by this rule`);
    enumListProblems({ editions: selected }, at, 'editions', ['full', 'lite'], bad);
    if (Array.isArray(selected) && selected.some((edition) => !editions.includes(edition))) bad.push(`${at} must be a subset of the rule's editions`);
  }
}

function checkEnforcerIdentity(enforcer, label, seen, bad) {
  if (!ENFORCER_FAMILIES.includes(enforcer.kind)) bad.push(`${label}.kind must be one of ${ENFORCER_FAMILIES.join(', ')}`);
  if (!ENFORCER_ID.test(String(enforcer.id))) bad.push(`${label}.id must be kebab-case`);
  if (seen.has(`${enforcer.kind}:${enforcer.id}`)) bad.push(`${label} repeats ${enforcer.kind}:${enforcer.id}`);
  seen.add(`${enforcer.kind}:${enforcer.id}`);
}

function checkEnforcerLocation(enforcer, label, bad) {
  if (enforcer.at !== undefined) {
    if (typeof enforcer.at !== 'string' || !enforcer.at.trim() || enforcer.at.startsWith('/') || enforcer.at.includes('..')) bad.push(`${label}.at must be a repository-relative path`);
    if (enforcer.status === 'planned') bad.push(`${label} is planned, so it has no file yet (at)`);
    if (!FILE_ENFORCERS.has(enforcer.kind)) bad.push(`${label}.at belongs to a machine, hfs, work-validate, sonar or runtime enforcer only`);
  } else if (FILE_ENFORCERS.has(enforcer.kind) && enforcer.status !== 'planned') bad.push(`${label} exists, so it names the file (at) that emits its code`);
}

function checkEnforcer(enforcer, index, ruleLabel, seen, bad) {
  const label = `${ruleLabel}.enforcers[${index}]`;
  if (!isPlainObject(enforcer)) { bad.push(`${label} is not a map`); return; }
  for (const key of Object.keys(enforcer)) {
    if (!ENFORCER_KEYS.has(key)) bad.push(`${label} has unknown key ${key}`);
  }
  bad.push(...ruleEditionProblems(enforcer, label));
  optionalText(enforcer, 'editionWhy', label, bad);
  checkEnforcerIdentity(enforcer, label, seen, bad);
  if (enforcer.status !== undefined && enforcer.status !== 'planned') bad.push(`${label}.status is either absent or planned`);
  checkEnforcerLocation(enforcer, label, bad);
}

function checkRuleEnforcers(rule, label, bad) {
  if (!Array.isArray(rule.enforcers) || !rule.enforcers.length) { bad.push(`${label}.enforcers must name at least one enforcer`); return; }
  const seen = new Set();
  rule.enforcers.forEach((enforcer, index) => checkEnforcer(enforcer, index, label, seen, bad));
}

function checkRule(rule, index, catalog, codeOwner, bad) {
  const at = `rules[${index}]`;
  if (!isPlainObject(rule)) { bad.push(`${at} is not a map`); return; }
  const label = typeof rule.id === 'string' ? rule.id : at;
  for (const key of Object.keys(rule)) {
    if (!RULE_KEYS.has(key)) bad.push(`${label} has unknown key ${key}`);
  }
  checkRuleIdentity(rule, index, catalog, at, label, bad);
  checkRuleText(rule, label, bad);
  checkRuleCases(rule, label, bad);
  if (rule.amendedBy !== undefined) caseReferenceProblems(rule.amendedBy, `${label}.amendedBy`, bad);
  optionalText(rule, 'editionWhy', label, bad);
  for (const key of ['docs', 'exemplifiedBy', 'proves']) evidenceProblems(rule, key, label, bad);
  witnessProblems(rule, label, bad);
  enumListProblems(rule, label, 'kinds', RULE_KINDS, bad);
  bad.push(...ruleEditionProblems(rule, label));
  const gates = enumListProblems(rule, label, 'gates', RULE_GATES, bad);
  checkRuleGates(rule, label, gates, bad);
  checkRuleFailureCodes(rule, label, codeOwner, bad);
  checkCodeEditions(rule, label, bad);
  checkRuleEnforcers(rule, label, bad);
  if (Array.isArray(rule.gates)) {
    const hasSonar = rule.enforcers.some((enforcer) => isPlainObject(enforcer) && enforcer.kind === 'sonar');
    if (rule.gates.includes('sonar') !== hasSonar) bad.push(`${label}: the sonar gate and a sonar enforcer go together`);
  }
}

/** Shape and semantic problems of a parsed knowledge/hfs/rules.yaml, in the words of modules/schemas/hfs-rules.schema.yaml. */
function ruleCatalogProblems(catalog) {
  const bad = [];
  if (!isPlainObject(catalog)) return ['the rule catalog is not a map'];
  checkCatalogHeader(catalog, bad);
  if (!Array.isArray(catalog.rules) || !catalog.rules.length) { bad.push('rules must be a non-empty list'); return bad; }
  const codeOwner = new Map();
  catalog.rules.forEach((rule, index) => checkRule(rule, index, catalog, codeOwner, bad));
  return bad;
}

const deepFreeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); } return Object.freeze(value); };

/**
 * The parsed and validated HFS rule catalog. `text` (or `file`, or `root`) selects the source; the default is the runtime's
 * own knowledge/hfs/rules.yaml. A catalog that breaks its shape or a semantic rule is refused whole (HFS_RULES_INVALID), and
 * so is one whose major differs from the slot manifest passed as `manifest` (HFS_MANIFEST_MAJOR_MISMATCH).
 * Answers: rule(id), byCode(code), forGate(gate), forEnforcer(kind, id), planned() and unbuilt().
 */
export function loadRuleCatalog({ root = skillRoot, file = path.join(root, HFS_RULES_FILE), text, manifest } = {}) {
  let doc;
  try { doc = parseYamlCached(text ?? fs.readFileSync(file, 'utf8')); } catch (error) { fail('HFS_RULES_INVALID', `the rule catalog cannot be read (${String(error?.message ?? error).split('\n')[0]})`, { file }); }
  const problems = ruleCatalogProblems(doc);
  if (problems.length) { fail('HFS_RULES_INVALID', `the rule catalog breaks its schema: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '; and ' + (problems.length - 5) + ' more' : ''}`, { file, problems }); }
  const [major, minor, patch] = doc.version.split('.').map(Number);
  if (manifest && manifest.major !== major) fail('HFS_MANIFEST_MAJOR_MISMATCH', `the rule catalog is major ${major} but the slot manifest is major ${manifest.major}`, { catalog: major, manifest: manifest.major });
  const list = deepFreeze(doc.rules.map((rule) => ({ ...rule, enforcers: rule.enforcers.map((enforcer) => ({ ...enforcer, planned: enforcer.status === 'planned' })) })));
  const byId = new Map(list.map((rule) => [rule.id, rule]));
  const byCode = new Map(list.flatMap((rule) => rule.failureCodes.map((code) => [code, rule])));
  return Object.freeze({
    version: doc.version, major, minor, patch,
    gates: deepFreeze(jsonClone(doc.gates)),
    enforcerKinds: deepFreeze(jsonClone(doc.enforcerKinds)),
    rules: list,
    /** The rule with this id (R01..), or null. */
    rule: (id) => byId.get(id) ?? null,
    /** The rule that owns this failure code (its own or a sub-check code), or null. */
    byCode: (code) => byCode.get(code) ?? null,
    /** Whether a finding code is judged under `edition`: codeEditions narrows its owner's editions; uncatalogued codes remain judged. */
    judgedIn: (code, edition = 'full') => {
      const owner = byCode.get(code);
      return judgedInEdition(owner, edition) && (!owner?.codeEditions?.[code] || owner.codeEditions[code].includes(edition));
    },
    enforcerJudgedIn: (kind, id, edition = 'full') => enforcerJudgedInEdition(list, kind, id, edition),
    /** The rules that run at a gate. */
    forGate: (gate) => list.filter((rule) => rule.gates.includes(gate)),
    /** The catalogued why code of a lint finding's rule id (`starci-be/<id>`, `starci-fe/<id>`), or undefined. */
    lintCode: (ruleId) => {
      const [plugin, id] = String(ruleId ?? '').split('/');
      const kind = (plugin === 'starci-be' && 'eslint-be') || (plugin === 'starci-fe' && 'eslint-fe') || null;
      return kind ? list.find((rule) => rule.enforcers.some((enforcer) => enforcer.kind === kind && enforcer.id === id))?.code : undefined;
    },
    /** The rules one enforcer judges, e.g. forEnforcer('eslint-be', 'error-home'). */
    forEnforcer: (kind, id) => list.filter((rule) => rule.enforcers.some((enforcer) => enforcer.kind === kind && enforcer.id === id)),
    /** Every enforcer still owed, as {rule, kind, id}. */
    planned: () => list.flatMap((rule) => rule.enforcers.filter((enforcer) => enforcer.planned).map((enforcer) => ({ rule: rule.id, kind: enforcer.kind, id: enforcer.id }))),
    /** The rules with no existing enforcer at all. */
    unbuilt: () => list.filter((rule) => rule.enforcers.every((enforcer) => enforcer.planned)),
  });
}

/** The rules of this runtime's catalog, frozen, in id order. */
export const rules = (options) => loadRuleCatalog(options).rules;
