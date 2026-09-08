import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { knowledgeCoverageErrors } from './knowledge-manifest.mjs';
import { validateAgainst } from './json-schema.mjs';

const requiredBriefKeys = ['schemaVersion', 'grammarId', 'packageBinding', 'authoritySplit', 'visualPrinciples', 'businessShape', 'reuse', 'ownerSearch', 'decision', 'deltas', 'consumers', 'compatibility', 'proof', 'knowledgeChallenges', 'rollback'];

function briefErrors(brief, label, family) {
  const errors = [];
  if (family && brief.grammarId !== family) errors.push(`${label}: grammarId ${brief.grammarId} differs from routed family ${family}`);
  for (const key of requiredBriefKeys) if (!(key in brief)) errors.push(`${label}: missing ${key}`);
  if (brief.schemaVersion !== 10) errors.push(`${label}: schemaVersion must be 10`);
  if (brief.packageBinding?.version === 'latest' || !/^\d+\.\d+\.\d+$/.test(String(brief.packageBinding?.version ?? ''))) errors.push(`${label}: packageBinding carries an exact semver, never latest or an unverified label`);
  if (!String(brief.packageBinding?.sourceRef ?? '').trim()) errors.push(`${label}: packageBinding requires a verified commit or integrity sourceRef`);
  if (!['reuse', 'compose', 'extend-owner', 'new-evidenced-gap'].includes(brief.decision)) errors.push(`${label}: decision follows reuse -> compose -> extend-owner -> new-evidenced-gap`);
  const split = brief.authoritySplit ?? {};
  for (const owner of ['common', 'family', 'product']) if (!String(split[owner] ?? '').trim()) errors.push(`${label}: authoritySplit.${owner} is required`);
  for (const key of ['common', 'family', 'product', 'gaps']) if (!Array.isArray(brief.ownerSearch?.[key])) errors.push(`${label}: ownerSearch.${key} must record the search result`);
  if (brief.decision === 'new-evidenced-gap' && !(brief.ownerSearch?.gaps?.length > 0)) errors.push(`${label}: a new concept requires a canonical family gap`);
  if (!Array.isArray(brief.visualPrinciples) || brief.visualPrinciples.length === 0) errors.push(`${label}: visualPrinciples requires source-backed rows`);
  if (!Array.isArray(brief.reuse) || brief.reuse.length === 0) errors.push(`${label}: reuse requires at least one searched concept`);
  return errors;
}

function briefSourceErrors(root, branchDir, brief, label) {
  const errors = [];
  let manifest;
  try { manifest = JSON.parse(readFileSync(path.join(branchDir, 'request', 'knowledge-manifest.json'), 'utf8')); } catch { return [`${label}: cannot validate sources without request/knowledge-manifest.json`]; }
  const sources = [brief.businessShape?.source, ...(brief.visualPrinciples ?? []).map((item) => item?.source), ...(brief.reuse ?? []).map((item) => item?.source)];
  const known = new Set((manifest.files ?? []).map((file) => file.path));
  for (const source of sources) {
    const ref = String(source ?? '').split('#')[0];
    if (ref.startsWith('knowledge/')) {
      if (!known.has(ref) || !existsSync(path.join(root, ...ref.split('/')))) errors.push(`${label}: source ${source} is absent from the frozen manifest or live knowledge tree`);
    } else if (ref.startsWith('request/')) {
      if (!existsSync(path.join(branchDir, ...ref.split('/')))) errors.push(`${label}: source ${source} is not a resolvable request ref`);
    } else errors.push(`${label}: source ${source || '(missing)'} must resolve through frozen knowledge or request evidence`);
  }
  if (!/^(?:[0-9a-f]{7,40}|sha(?:256|512):[0-9a-f]{64,128})$/i.test(String(brief.packageBinding?.sourceRef ?? ''))) errors.push(`${label}: packageBinding.sourceRef must be a verified commit or integrity digest`);
  return errors;
}

function schemaErrors(root, brief, label) {
  try {
    const schema = JSON.parse(readFileSync(path.join(root, 'templates', 'kinds', 'family-understanding.schema.json'), 'utf8'));
    return validateAgainst(schema, brief, label);
  } catch (error) { return [`${label}: family-understanding schema cannot be loaded (${error.message})`]; }
}

export function familyUnderstandingErrors(branchDir, { root, status = 'done', required = true, family } = {}) {
  if (status !== 'done' || !required) return [];
  const requestFile = path.join(branchDir, 'request', 'family-understanding.json');
  const file = path.join(branchDir, 'response', 'data', 'family-understanding.json');
  if (!existsSync(requestFile)) return ['request/family-understanding.json: missing the frozen pre-mutation family understanding brief'];
  if (!existsSync(file)) return ['response/data/family-understanding.json: missing the family understanding used by the operation'];
  let frozen, brief;
  try { frozen = JSON.parse(readFileSync(requestFile, 'utf8')); } catch { return ['request/family-understanding.json: invalid JSON']; }
  try { brief = JSON.parse(readFileSync(file, 'utf8')); } catch { return ['response/data/family-understanding.json: invalid JSON']; }
  const errors = [];
  if (JSON.stringify(frozen) !== JSON.stringify(brief)) errors.push('response/data/family-understanding.json: differs from the brief frozen before mutation');
  errors.push(...briefErrors(brief, 'response/data/family-understanding.json', family));
  if (root) errors.push(...schemaErrors(root, brief, 'response/data/family-understanding.json'), ...briefSourceErrors(root, branchDir, brief, 'response/data/family-understanding.json'));
  return errors;
}

export function frozenFamilyUnderstandingErrors(branchDir, { root, family } = {}) {
  const requestFile = path.join(branchDir, 'request', 'family-understanding.json');
  if (!existsSync(requestFile)) return ['request/family-understanding.json: missing the frozen pre-mutation family understanding brief'];
  let brief;
  try { brief = JSON.parse(readFileSync(requestFile, 'utf8')); } catch { return ['request/family-understanding.json: invalid JSON']; }
  const errors = briefErrors(brief, 'request/family-understanding.json', family);
  if (root) errors.push(...schemaErrors(root, brief, 'request/family-understanding.json'), ...briefSourceErrors(root, branchDir, brief, 'request/family-understanding.json'));
  else errors.push('request/family-understanding.json: root is required for schema and source validation');
  return errors;
}

export function routedFamily(request) {
  const aliases = (request?.contexts ?? []).map((context) => context?.alias).filter((alias) => typeof alias === 'string');
  const families = aliases.filter((alias) => alias.startsWith('@knowledge/grammars/')).map((alias) => alias.slice('@knowledge/grammars/'.length));
  if (families.length !== 1 || !/^[a-z][a-z0-9-]*$/.test(families[0])) return null;
  return families[0];
}

export function uiKnowledgeGateErrors({ root, branchDir, bindings, request, status = 'done', requireFamilyBrief = true }) {
  if (status !== 'done') return [];
  const family = routedFamily(request);
  if (!family) return ['request/request.json: exactly one concrete @knowledge/grammars/<family> context is required'];
  return [
    ...knowledgeCoverageErrors({ root, branchDir, bindings, family, status }),
    ...familyUnderstandingErrors(branchDir, { root, status, required: requireFamilyBrief, family }),
  ];
}

export function knowledgeQuestionStopErrors({ branchDir, response }) {
  if (response?.status !== 'blocked' || response?.stop !== 'KNOWLEDGE_QUESTION') return [];
  const ref = response.fields?.['knowledge-question'];
  if (typeof ref !== 'string' || !/^response\/data\/[A-Za-z0-9_.-]+\.json$/.test(ref)) return ['response/response.json: KNOWLEDGE_QUESTION requires the typed knowledge-question field'];
  const file = path.join(branchDir, ref);
  if (!existsSync(file)) return [`${ref}: knowledge-question file is missing`];
  let value;
  try { value = JSON.parse(readFileSync(file, 'utf8')); } catch { return [`${ref}: invalid JSON`]; }
  const errors = [];
  if (value.schemaVersion !== 10 || value.applicabilityValidated !== true) errors.push(`${ref}: applicability must be validated before challenging teacher knowledge`);
  for (const key of ['family', 'sourceOperator', 'surfaceRef', 'rule', 'impact']) if (!String(value[key] ?? '').trim()) errors.push(`${ref}: missing ${key}`);
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) errors.push(`${ref}: concrete evidence is required`);
  for (const evidence of Array.isArray(value.evidence) ? value.evidence : []) {
    const relative = String(evidence).split('#')[0];
    if (!/^(?:request|response)\//.test(relative) || !existsSync(path.join(branchDir, relative))) errors.push(`${ref}: evidence ${evidence} is not a resolvable request or response ref`);
  }
  return errors;
}
