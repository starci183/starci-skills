import { validateJourneys } from '../contracts/journeys.mjs';
import { validateSDS, SDS_SCHEMA } from './sds.mjs';
import { validateSRSDetails, validateArchitectureReview } from './v2.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const contract = JSON.parse(fs.readFileSync(new URL('./contract.json', import.meta.url), 'utf8'));
const text = x => typeof x === 'string' && x.trim().length > 0;
const safePath = x => text(x) && !path.posix.isAbsolute(x) && !path.win32.isAbsolute(x) && !/[\\:\x00-\x1f]/.test(x) && !x.split('/').some(p => !p || p === '.' || p === '..');

export function validateSpecification(spec) {
  try { return spec?.schema === SDS_SCHEMA ? validateSDS(spec) : validate(spec); }
  catch { return { ok: false, errors: ['Malformed specification; no handoff can be certified.'] }; }
}
function validate(spec) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const shape = (value, fields, at) => {
    const ok = value && typeof value === 'object' && !Array.isArray(value);
    check(ok && fields.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => fields.includes(k)), at + ': exact fields required');
    return ok;
  };
  const architecture = spec?.op === 'architecture.decide';
  const v2 = spec?.schema === contract.currentPayloadSchema;
  const rowContract = { ...contract.rows, ...(v2 ? contract.v2.rows : {}), ...(architecture ? contract.architectureRows : {}) };
  if (v2 && !architecture) { delete rowContract.codeImpacts; delete rowContract.serviceImpacts; }
  if (v2 && architecture) rowContract.security = contract.rows.security;
  const arrayFields = { ...contract.arrayFields, ...contract.architectureArrays, ...(v2 ? contract.v2.arrayFields : {}) };
  const required = v2 ? [...contract.v2.required, ...(architecture ? ['codeImpacts','serviceImpacts','architectureReview'] : [])] : contract.required;
  if (!shape(spec, [...required, ...(architecture ? Object.keys(contract.architectureRows) : [])], 'specification')) return { ok: false, errors };
  check([contract.payloadSchema, contract.currentPayloadSchema].includes(spec.schema), 'schema');
  check(['business.decide', 'architecture.decide'].includes(spec.op), 'op');
  check(contract.statuses.includes(spec.status), 'status');
  try { validateJourneys(spec.journeys, { allowEmpty: true }); } catch (e) { check(false, e.message); }
  const ids = {};
  for (const [section, fields] of Object.entries(rowContract)) {
    const rows = spec[section];
    const mayBeEmpty = ['decisions','journeyCoverage', ...(v2 ? ['data','externalInterfaces','patternDecisions'] : [])].includes(section);
    check(Array.isArray(rows) && (mayBeEmpty || rows.length > 0), section + ': rows required');
    ids[section] = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!shape(row, fields, section)) continue;
      check(text(row.id) && !ids[section].has(row.id), section + ': unique id');
      ids[section].add(row.id);
      for (const key of fields) {
        if ((arrayFields[section] ?? []).includes(key)) check(Array.isArray(row[key]) && (['steps','alternatives','exceptions','attributes','transitions'].includes(key) || row[key].every(text)), section + '.' + key + ': array required');
        else if (key === 'sequence') check(Number.isInteger(row[key]) && row[key] > 0, 'call sequence');
        else if (key === 'mechanism') check(row[key] && typeof row[key] === 'object' && !Array.isArray(row[key]), 'pattern mechanism');
        else if (v2 && key === 'branchReview') check(row[key] && typeof row[key] === 'object' && !Array.isArray(row[key]), 'branch review');
        else if (key !== 'blocking') check(text(row[key]), section + '.' + key + ': text required');
      }
      for (const [key, value] of Object.entries(row)) check(value !== null && value !== undefined && (typeof value !== 'string' || text(value)), section + '.' + key + ': value required');
    }
  }
  const rows = name => Array.isArray(spec[name]) ? spec[name].filter(x => x && typeof x === 'object') : [];
  const refs = (list, target, at, nonempty = true) => {
    check(Array.isArray(list) && (!nonempty || list.length > 0) && new Set(list).size === list.length && list.every(x => ids[target].has(x)), at + ': unresolved/empty/duplicate ' + target + ' references');
  };
  const journeys = Array.isArray(spec.journeys) ? spec.journeys : [];
  for (const link of rows('journeyCoverage')) {
    const journey = journeys.find(j => j.id === link.journeyId);
    check(journey?.steps?.some(s => s.id === link.stepId), 'journey coverage must resolve exact journey/step');
    refs([link.flowId], 'flows', link.id); refs(link.acceptanceIds, 'acceptance', link.id);
    check(link.acceptanceIds?.every(id => rows('acceptance').some(a => a.id === id && a.flowIds?.includes(link.flowId))), 'journey AC must belong to mapped business flow');
  }
  for (const journey of journeys) for (const step of journey.steps ?? []) check(rows('journeyCoverage').some(l => l.journeyId === journey.id && l.stepId === step.id), 'unmapped journey step');
  for (const ac of rows('acceptance').filter(a => a.proofOwner === 'uat.verify')) check(rows('journeyCoverage').some(l => l.acceptanceIds?.includes(ac.id)), 'UAT acceptance needs executable journey coverage');
  for (const source of rows('sources')) {
    check(['observed', 'accepted-intent', 'proposal'].includes(source.kind), 'source kind');
    check(safePath(source.path), 'source path');
    if (source.kind === 'observed') check(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(source.revision), 'observed revision must be full SHA');
  }
  for (const row of rows('requirements')) {
    refs(row.sourceRefs, 'sources', row.id); refs(row.acceptanceIds, 'acceptance', row.id);
    check(['accepted', 'observed', 'proposed', 'unknown'].includes(row.authority), 'requirement authority');
    if (spec.status === 'pass') check(row.authority === 'accepted' && row.sourceRefs.some(id => rows('sources').some(s => s.id === id && s.kind === 'accepted-intent')), 'pass requires accepted intent for ' + row.id);
  }
  for (const flow of rows('flows')) {
    check(Array.isArray(flow.steps) && flow.steps.length > 0, 'ordered flow steps required');
    const seen = new Set();
    for (const step of Array.isArray(flow.steps) ? flow.steps : []) {
      const stepFields = v2 ? contract.v2.flowStep : contract.flowStep;
      if (!shape(step, stepFields, flow.id + '.step')) continue;
      check(text(step.id) && !seen.has(step.id), 'flow step id'); seen.add(step.id);
      for (const key of stepFields.filter(k => k !== 'acceptanceIds')) check(text(step[key]), 'step.' + key);
      refs(step.acceptanceIds, 'acceptance', step.id);
    }
    refs(flow.acceptanceIds, 'acceptance', flow.id);
    if (!v2 || architecture) {
      check(rows('codeImpacts').some(x => x.flowIds?.includes(flow.id)), 'flow missing code impact: ' + flow.id);
      check(rows('serviceImpacts').some(x => x.flowIds?.includes(flow.id)), 'flow missing service impact: ' + flow.id);
    }
  }
  for (const row of rows('codeImpacts')) {
    refs(row.sourceRefs, 'sources', row.id); refs(row.flowIds, 'flows', row.id); refs([row.serviceId], 'serviceImpacts', row.id);
    check(safePath(row.path), 'code impact path');
    check(['observed','proposed'].includes(row.existence) && ['change','preserve','review'].includes(row.disposition) && ['direct','transitive'].includes(row.relation), 'code impact classification');
    if (row.existence === 'observed') check(row.sourceRefs.some(id => rows('sources').some(s => s.id === id && s.kind === 'observed' && s.repository === row.repository && s.path === row.path)), 'observed code impact needs matching source');
  }
  for (const row of rows('serviceImpacts')) { refs(row.sourceRefs, 'sources', row.id); refs(row.flowIds, 'flows', row.id); }
  for (const row of rows('security')) {
    refs(row.sourceRefs, 'sources', row.id); refs(row.acceptanceIds, 'acceptance', row.id);
    if (!v2 || architecture) { refs(row.codeImpactIds, 'codeImpacts', row.id); refs(row.serviceIds, 'serviceImpacts', row.id); }
    check(rows('acceptance').some(a => row.acceptanceIds?.includes(a.id) && a.scenario === 'negative'), 'security needs negative acceptance: ' + row.id);
  }
  for (const row of rows('acceptance')) { refs(row.requirementIds, 'requirements', row.id); refs(row.flowIds, 'flows', row.id); check(['positive','negative','boundary','recovery',...(v2 ? ['alternative'] : [])].includes(row.scenario), 'acceptance scenario'); }
  for (const row of rows('decisions')) {
    refs(row.sourceRefs, 'sources', row.id); check(typeof row.blocking === 'boolean', 'decision blocking flag');
    check(['accepted','proposed','unknown','deferred'].includes(row.status), 'decision status');
    if (spec.status === 'pass') check(!row.blocking || row.status === 'accepted', 'unresolved blocking decision: ' + row.id);
  }
  if (architecture) {
    const calls = rows('serviceCalls');
    const sequences = new Set();
    for (const call of calls) {
      refs([call.flowId], 'flows', call.id);
      refs([call.callerServiceId, call.calleeServiceId].filter((v,i,a) => a.indexOf(v) === i), 'serviceImpacts', call.id);
      refs([call.callerSourceRef], 'sources', call.id); refs([call.receiverSourceRef], 'sources', call.id); refs(call.bindingSourceRefs, 'sources', call.id);
      check(['sync','async','in-process'].includes(call.mode), 'call mode');
      check(['observed-source','proposed','unknown'].includes(call.status), 'call status');
      if (spec.status === 'pass') check(call.status !== 'unknown', 'unknown call cannot pass');
      const key = call.flowId + ':' + call.sequence; check(!sequences.has(key), 'duplicate call sequence'); sequences.add(key);
      const caller = rows('serviceImpacts').find(x => x.id === call.callerServiceId);
      const callee = rows('serviceImpacts').find(x => x.id === call.calleeServiceId);
      check(caller?.sourceRefs.includes(call.callerSourceRef), 'caller source must belong to caller service');
      check(callee?.sourceRefs.includes(call.receiverSourceRef), 'receiver source must belong to callee service');
    }
    for (const flow of rows('flows')) {
      const ordered = calls.filter(c => c.flowId === flow.id);
      check(ordered.length > 0 && ordered.every((c,i) => c.sequence === i + 1), 'flow calls require contiguous declared order');
    }
    if (!v2) for (const pattern of contract.architectureRequiredPatterns) check(rows('patternDecisions').some(p => p.pattern === pattern), 'missing pattern decision: ' + pattern);
    for (const pattern of rows('patternDecisions')) {
      check(['adopt','preserve','reject','defer'].includes(pattern.decision), 'pattern decision');
      refs(pattern.sourceRefs, 'sources', pattern.id); refs(pattern.serviceIds, 'serviceImpacts', pattern.id); refs(pattern.acceptanceIds, 'acceptance', pattern.id);
      const required = ['adopt','preserve'].includes(pattern.decision) ? ({
        Saga: ['coordination','participants','localTransactions','durableState','compensation','pivot','retryRecovery'],
        CQRS: ['writeModel','readModel','projection','consistency','readYourWrites','rebuild'],
        'Transactional Outbox': ['transactionBoundary','dispatcher','deduplication','ordering','retryRecovery']
      }[pattern.pattern] ?? ['implementation','failureRecovery']) : ['notApplied'];
      if (shape(pattern.mechanism, required, pattern.id + '.mechanism')) check(required.every(k => text(pattern.mechanism[k])), 'pattern mechanism fields required');
    }
    for (const category of contract.architectureSecurityCategories) check(rows('securityReview').some(r => r.category === category), 'missing security category: ' + category);
    for (const review of rows('securityReview')) {
      check(['assessed','not-applicable','unknown'].includes(review.applicability), 'security applicability');
      refs(review.sourceRefs, 'sources', review.id); refs([review.decisionId], 'decisions', review.id);
      refs(review.threatIds, 'security', review.id, review.applicability === 'assessed');
      if (spec.status === 'pass') check(review.applicability !== 'unknown', 'unknown security review cannot pass');
    }
  }
  const businessV2 = v2 && !architecture;
  if (shape(spec.handoff, businessV2 ? contract.v2.handoff : contract.handoff, 'handoff')) {
    if (businessV2) {
      for (const key of contract.v2.handoff) check(Array.isArray(spec.handoff[key]) && spec.handoff[key].length > 0 && spec.handoff[key].every(text), 'business handoff.' + key);
    } else {
    check(Array.isArray(spec.handoff.implementationChecks) && spec.handoff.implementationChecks.length > 0, 'implementation check plan required');
    for (const row of spec.handoff.implementationChecks ?? []) {
      if (!shape(row, ['owner','repository','check','command','sourceRef','status'], 'implementation check')) continue;
      check(['interface.implement','backend.implement'].includes(row.owner), 'quality must belong to implement');
      refs([row.sourceRef], 'sources', 'check');
      check(row.status === 'planned', 'specification cannot claim checks executed');
      check(text(row.command), 'check command');
    }
    }
  }
  if (v2) {
    const helpers = {check, shape, refs, rows, ids, text, contract:contract.v2};
    validateSRSDetails(spec, helpers);
    if (architecture) validateArchitectureReview(spec, helpers);
  }
  return { ok: errors.length === 0, errors };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = validateSpecification(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))); process.stdout.write(JSON.stringify(result, null, 2) + '\n'); if (!result.ok) process.exitCode = 1; }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
