import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { operatorV7Issues } from '../../operators/contract-v7.mjs';

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(harnessRoot, '..', '..');
const operatorsRoot = path.join(root, 'operators');
const args = new Set(process.argv.slice(2));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function operatorDirectories() {
  return fs.readdirSync(operatorsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((domain) => fs.readdirSync(path.join(operatorsRoot, domain.name), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(operatorsRoot, domain.name, entry.name)))
    .sort();
}

function resolveLocal(schema, rule) {
  if (!rule?.$ref?.startsWith('#/')) return rule;
  return rule.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function inventory(schema) {
  const result = { objects: 0, openObjects: [], arrays: 0, unboundedArrays: [], unconstrainedRefs: [], broadFields: [] };
  const seen = new Set();
  const visit = (raw, at) => {
    const rule = resolveLocal(schema, raw);
    if (!rule || typeof rule !== 'object' || seen.has(rule)) return;
    seen.add(rule);
    if (rule.type === 'object' || rule.properties) {
      result.objects += 1;
      if (rule.additionalProperties !== false) result.openObjects.push(at);
    }
    if (rule.type === 'array') {
      result.arrays += 1;
      if (!Number.isInteger(rule.maxItems)) result.unboundedArrays.push(at);
    }
    const leaf = at.split('.').at(-1).replace('[]', '');
    const constrained = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (candidate.$ref) return constrained(resolveLocal(schema, candidate));
      if (candidate.pattern || candidate.format || candidate.enum || Object.hasOwn(candidate, 'const') || Number.isInteger(candidate.maxLength)) return true;
      return [...(candidate.oneOf ?? []), ...(candidate.anyOf ?? [])].some(constrained);
    };
    if (/refs?$/i.test(leaf)) {
      const target = rule.type === 'array' ? resolveLocal(schema, rule.items) : rule;
      if (!constrained(target)) result.unconstrainedRefs.push(at);
    }
    if (/(rawbody|fullcontext|sourcebody|repositorybody|promptbody|transcriptbody)/i.test(leaf)) result.broadFields.push(at);
    for (const [name, child] of Object.entries(rule.properties ?? {})) visit(child, `${at}.${name}`);
    if (rule.items) visit(rule.items, `${at}[]`);
    for (const key of ['$defs', 'definitions']) for (const [name, child] of Object.entries(rule[key] ?? {})) visit(child, `${at}.${name}`);
    for (const key of ['allOf', 'oneOf', 'anyOf']) (rule[key] ?? []).forEach((child, index) => visit(child, `${at}.${key}[${index}]`));
    for (const key of ['if', 'then', 'else', 'not']) if (rule[key]) visit(rule[key], `${at}.${key}`);
  };
  visit(schema, '$');
  return result;
}

const caseResult = (id, pass, severity, evidence, finding = '') => ({ id, verdict: pass ? 'pass' : severity, evidence, ...(finding ? { finding } : {}) });

function decisionBranches(schema) {
  return [...(schema.oneOf ?? []), ...(schema.allOf ?? []).flatMap((item) => item.oneOf ?? [])];
}

function branchAt(branch, dotted) {
  let current = branch;
  for (const part of dotted.split('.')) current = current?.properties?.[part];
  return current;
}

function correlationAudit(schema, validatorSource) {
  const decisionRule = schema.properties?.payload?.properties?.decision ?? {};
  const decisions = decisionRule.enum ?? (Object.hasOwn(decisionRule, 'const') ? [decisionRule.const] : []);
  if (!decisions.length) return { pass: false, evidence: 'payload.decision has no closed outcome enum' };
  const branches = decisionBranches(schema);
  const uncovered = [];
  for (const decision of decisions) {
    const branch = branches.find((item) => branchAt(item, 'payload.decision')?.const === decision);
    const schemaBound = branch && branchAt(branch, 'stage') && branchAt(branch, 'status') && branchAt(branch, 'payload.state.status') && branchAt(branch, 'payload.state.code') && branchAt(branch, 'payload.state.emits.stage') && branchAt(branch, 'payload.state.emits.status');
    if (schemaBound) continue;
    const escaped = decision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const semanticBound = /state/.test(validatorSource) && /emits/.test(validatorSource) && new RegExp(escaped).test(validatorSource) && /(decision|status)/.test(validatorSource);
    if (!semanticBound) uncovered.push(decision);
  }
  return uncovered.length ? { pass: false, evidence: `outcomes without deterministic decision/state/route binding: ${uncovered.join(', ')}` } : { pass: true, evidence: `${decisions.length} outcome(s) are schema- or semantic-bound` };
}

function docsAudit(directory, schemaVersion) {
  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  if (schemaVersion === 7) {
    const markers = ['## Context', '## Input', '## Action', '## Output', '## Stop'];
    const missing = markers.filter((marker) => !execute.includes(marker));
    const vague = /\b(?:relevant|necessary|appropriate) context\b|\b(?:etc\.|and so on|whatever is needed|as needed)\b/i.test(execute);
    return { pass: missing.length === 0 && !vague, evidence: `v7 one-job sections; missing markers: ${missing.join(', ') || 'none'}; vague catch-all: ${vague}` };
  }
  const steps = execute.match(/^## Step\s+\d+/gmi) ?? [];
  const markers = ['**Read:**', '**Context:**', '**Session write:**', '**Stop:**'];
  const missing = markers.filter((marker) => !execute.includes(marker));
  const vague = /\b(?:relevant|necessary|appropriate) context\b|\b(?:etc\.|and so on|whatever is needed|as needed)\b/i.test(execute);
  return { pass: steps.length >= 2 && missing.length === 0 && !vague, evidence: `${steps.length} steps; missing markers: ${missing.join(', ') || 'none'}; vague catch-all: ${vague}` };
}

async function audit(directory) {
  const id = path.relative(operatorsRoot, directory).replaceAll('\\', '/');
  const manifest = readJson(path.join(directory, 'operator.json'));
  const input = readJson(path.join(directory, 'input.schema.json'));
  const output = readJson(path.join(directory, 'output.schema.json'));
  const inputInventory = inventory(input);
  const outputInventory = inventory(output);
  const inputValidator = await import(`${pathToFileURL(path.join(directory, 'validate-input.mjs')).href}?operator-harness=${Date.now()}-${id}`);
  const outputValidator = await import(`${pathToFileURL(path.join(directory, 'validate-output.mjs')).href}?operator-harness=${Date.now()}-${id}`);
  const validatorSource = fs.readFileSync(path.join(directory, 'validate-output.mjs'), 'utf8');
  const inputPayload = input.properties?.payload;
  const outputPayload = output.properties?.payload;
  const inputSession = inputPayload?.properties?.session;
  const cleanup = outputPayload?.properties?.cleanup;
  const v7Issues = manifest.schemaVersion === 7 ? operatorV7Issues({ manifest, inputSchema: input, outputSchema: output }) : [];
  const correlation = manifest.schemaVersion === 7
    ? { pass: v7Issues.length === 0 && !['stage', 'status', 'facts', 'decision', 'state', 'emits', 'cleanup'].some((field) => field in (output.properties?.output?.properties ?? {})), evidence: v7Issues.length ? v7Issues.join('; ') : 'typed output contains no skill/runtime routing fields' }
    : correlationAudit(output, validatorSource);
  const docs = docsAudit(directory, manifest.schemaVersion);
  const knowledgeContract = JSON.stringify(input);
  const inputIsolation = manifest.schemaVersion === 7
    ? inputValidator.validateInput({ unexpected: true }).valid === false && v7Issues.length === 0 && inputInventory.broadFields.length === 0
    : inputValidator.validateInput({ unexpected: true }).valid === false && input.additionalProperties === false && inputPayload?.additionalProperties === false && ['provided', 'loads', 'session'].every((key) => inputPayload.required?.includes(key)) && inputSession?.properties?.retention?.const === 'until-skill-terminal' && inputInventory.broadFields.length === 0;
  const outputIsolation = manifest.schemaVersion === 7
    ? outputValidator.validateOutput({ unexpected: true }).valid === false && v7Issues.length === 0
    : outputValidator.validateOutput({ unexpected: true }).valid === false && output.additionalProperties === false && outputPayload?.additionalProperties === false && ['decision', 'state', 'produced', 'context', 'cleanup', 'evidenceRefs', 'findings'].every((key) => outputPayload.required?.includes(key)) && cleanup?.properties?.retention?.const === 'until-skill-terminal' && cleanup?.properties?.purgeAt?.const === 'skill-terminal';
  const cases = [
    caseResult('input-isolation', inputIsolation, 'fail', manifest.schemaVersion === 7 ? `closed context + direct input + validator rejection; broad fields=${inputInventory.broadFields.length}` : `closed envelope + provided/loads/session + terminal retention; broad fields=${inputInventory.broadFields.length}`),
    caseResult('output-isolation', outputIsolation, 'fail', manifest.schemaVersion === 7 ? 'closed typed output + validator rejection + no runtime envelope' : 'closed typed output + validator rejection + terminal cleanup'),
    caseResult('decision-state-route-correlation', correlation.pass, 'fail', correlation.evidence),
    caseResult('execute-context-discipline', docs.pass && (manifest.contextRefs ?? []).every((ref) => knowledgeContract.includes(JSON.stringify(ref))), 'warning', `${docs.evidence}; unconstrained refs=${inputInventory.unconstrainedRefs.length + outputInventory.unconstrainedRefs.length}; unbounded arrays=${inputInventory.unboundedArrays.length + outputInventory.unboundedArrays.length}`)
  ];
  return { id, cases, summary: { pass: cases.filter((item) => item.verdict === 'pass').length, warning: cases.filter((item) => item.verdict === 'warning').length, fail: cases.filter((item) => item.verdict === 'fail').length }, metrics: { input: inputInventory, output: outputInventory } };
}

const operators = [];
for (const directory of operatorDirectories()) operators.push(await audit(directory));
const summary = {
  operatorCount: operators.length,
  caseCount: operators.reduce((sum, item) => sum + item.cases.length, 0),
  pass: operators.reduce((sum, item) => sum + item.summary.pass, 0),
  warning: operators.reduce((sum, item) => sum + item.summary.warning, 0),
  fail: operators.reduce((sum, item) => sum + item.summary.fail, 0),
  operatorsWithFailures: operators.filter((item) => item.summary.fail).length
};
const report = { schemaVersion: 1, summary, operators };
if (args.has('--write')) fs.writeFileSync(path.join(harnessRoot, 'operator-results.json'), `${JSON.stringify(report, null, 2)}\n`);
if (args.has('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else {
  console.log(`Operators: ${summary.operatorCount}; cases: ${summary.caseCount}; pass: ${summary.pass}; warning: ${summary.warning}; fail: ${summary.fail}`);
  for (const item of operators.filter((entry) => entry.summary.fail || entry.summary.warning)) console.log(`${item.id}: ${item.summary.pass} pass / ${item.summary.warning} warning / ${item.summary.fail} fail`);
}
if (args.has('--enforce') && summary.fail) process.exitCode = 1;
