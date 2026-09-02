// Proves validate.mjs on a synthetic session step: one conforming step under the defaults
// (alternatives = 1, automatic), one with three alternatives under approval-required, and one
// mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateArchitectureStep } from './validate.mjs';

const head = 'b'.repeat(40);
const fp = `sha256:${'a'.repeat(64)}`;
const ev = (p) => `${p}@${head}`;

function currentState() {
  return {
    observedHead: head, fingerprint: fp,
    components: [
      { componentId: 'nestjs', layer: 'framework', name: 'NestJS', version: '10.4.0', evidence: ev('package.json:12') },
      { componentId: 'postgres', layer: 'persistence', name: 'PostgreSQL', version: '16.2', evidence: ev('compose.yaml:30-41') },
    ],
    boundaries: [{ boundaryId: 'entitlement', responsibility: 'answers who may read a course', stores: ['entitlement-store'], evidence: ev('src/entitlement/index.ts:1-40') }],
  };
}
const verdicts = () => ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'].map((axis) => ({ axis, verified: true, evidence: ev('compose.yaml:30') }));
function stackModel({ alternatives = 1 } = {}) {
  const alts = [{ alternativeId: 'shared-boundary', status: 'selected', scores: { cost: 4, complexity: 3, reversibility: 4 }, rejectedBecause: null }];
  if (alternatives > 1) alts.push({ alternativeId: 'per-feature-guards', status: 'rejected', scores: { cost: 2, complexity: 2, reversibility: 3 }, rejectedBecause: 'three boundaries derive one answer' });
  if (alternatives > 2) alts.push({ alternativeId: 'edge-cache', status: 'rejected', scores: { cost: 3, complexity: 1, reversibility: 1 }, rejectedBecause: 'stale claims after revocation' });
  return {
    decisionId: 'entitlement-read-path', selectedAlternativeId: 'shared-boundary', alternatives: alts,
    boundaries: [
      { boundaryId: 'entitlement', responsibility: 'one entitlement answer', owner: 'platform-team', interfaces: ['EntitlementQuery'], ownsData: true },
      { boundaryId: 'course-api', responsibility: 'serves course content', owner: 'learning-team', interfaces: ['CourseQuery'], ownsData: false },
    ],
    stores: [{ storeId: 'entitlement-store', owningBoundaryId: 'entitlement', writers: ['entitlement'], readers: ['course-api'], migrators: ['entitlement'], transactionScope: 'per request', backup: 'nightly snapshot', restore: 'tested weekly', sharedWriteJustification: null }],
    components: [
      { componentId: 'nestjs', status: 'existing', justification: 'observed-evidence', evidence: ev('package.json:12'), compatibility: verdicts() },
      { componentId: 'postgres', status: 'existing', justification: 'measured-constraint', evidence: ev('compose.yaml:30'), compatibility: verdicts() },
      { componentId: 'redis-cache', status: 'removed', justification: null, evidence: null, compatibility: [] },
    ],
  };
}
function response({ alternatives = 1, policy = 'automatic', handoffDetail = 'EntitlementQuery contract returns one answer per viewer', stackStatus = 'existing' } = {}) {
  const altRows = ['| `shared-boundary` | selected | cost 4 · complexity 3 · reversibility 4 | — |'];
  if (alternatives > 1) altRows.push('| `per-feature-guards` | rejected | cost 2 · complexity 2 · reversibility 3 | three boundaries derive one answer |');
  if (alternatives > 2) altRows.push('| `edge-cache` | rejected | cost 3 · complexity 1 · reversibility 1 | stale claims after revocation |');
  return `# architecture-decision — entitlement-read-path

## Decision

| Field | Value |
| --- | --- |
| Objective | one entitlement read path |
| Decision id | \`entitlement-read-path\` |
| Selected alternative | \`shared-boundary\` |
| Selection policy | \`${policy}\` |

## Current state

| Boundary | Responsibility | Stores | Evidence |
| --- | --- | --- | --- |
| \`entitlement\` | answers who may read a course | \`entitlement-store\` | \`src/entitlement/index.ts:1-40@${head}\` |

## Alternatives

| Alternative | Status | Assessment | Rejected because |
| --- | --- | --- | --- |
${altRows.join('\n')}

## Boundaries

| Boundary | Responsibility | Owner | Interfaces | Owns data |
| --- | --- | --- | --- | --- |
| \`entitlement\` | one entitlement answer | platform-team | EntitlementQuery | yes |
| \`course-api\` | serves course content | learning-team | CourseQuery | no |

## Data ownership

| Store | Owning boundary | Writers | Readers | Migrators | Transaction scope | Backup | Restore |
| --- | --- | --- | --- | --- | --- | --- | --- |
| \`entitlement-store\` | \`entitlement\` | \`entitlement\` | \`course-api\` | \`entitlement\` | per request | nightly snapshot | tested weekly |

## Stack delta

| Component | Status | Justification | Evidence | Compatibility |
| --- | --- | --- | --- | --- |
| \`nestjs\` | ${stackStatus} | observed-evidence | \`package.json:12@${head}\` | 5/5 verified |
| \`postgres\` | existing | measured-constraint | \`compose.yaml:30@${head}\` | 5/5 verified |
| \`redis-cache\` | removed | — | — | — |

## Handoff

| Item | Kind | Detail |
| --- | --- | --- |
| one answer per viewer | invariant | every entitlement read returns the same answer within one request |
| entitlement query | contract | ${handoffDetail} |
| cache removal | migration | drop the cache after the shared boundary serves all readers |
| revert | rollback | restore the cache reader behind a flag |
| proof | proof | integration test asserting one answer across three readers |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
function critique({ failing = false, selection = 'keep', inherited = 'none' } = {}) {
  const paths = ['partial-failure', 'retry-idempotency', 'concurrency', 'stale-state', 'deletion', 'recovery', 'dependency-outage', 'rollback'];
  return `# independent-critique — entitlement-read-path

## Execution

| Field | Value |
| --- | --- |
| Reviewer execution | exec://critique-7f3a |
| Inherited turns | ${inherited} |
| Given | data/stack-model.json, response.md claims |

## Attacks

| Adverse path | Attack | Resolution | Verdict |
| --- | --- | --- | --- |
${paths.map((p, i) => `| ${p} | what if ${p} hits the shared boundary | idempotent read, single writer | ${failing && i === 3 ? 'fails' : 'holds'} |`).join('\n')}

## Verdict

| Field | Value |
| --- | --- |
| Selection | ${selection} |
`;
}
function request({ alternatives = 1, policy = 'automatic', approval = '—', extra = '' } = {}) {
  return `# request — architecture.decide step-1-1

## Context

| Alias | Head |
| --- | --- |
| \`@workspaces/be\` | \`${head}\` |
| \`@worktrees/businesses/pro-subscription\` | — |

## Requirements

| Field | Value |
| --- | --- |
| \`objective\` | one entitlement read path |
| \`decisionId\` | entitlement-read-path |
| \`alternatives\` | ${alternatives} |
| \`tradeoffAxes\` | cost, complexity, reversibility |
| \`constraints\` | fi-1 fixed-intent one answer per viewer; m-1 measurable p95 read under 50ms |
| \`selectionPolicy\` | ${policy} |
| \`approval\` | ${approval} |
| \`resume\` | null |
${extra}
## Inputs

| Kind | From |
| --- | --- |
| \`architecture-decision\` | — |
`;
}
const input = { schemaVersion: 9, operatorId: 'architecture.decide', step: '1-1', sessionId: 's-test', contexts: [{ alias: '@workspaces/be', head }, { alias: '@worktrees/businesses/pro-subscription', head: null }], fields: { requirements: 'request.md#requirements' }, resume: null };
function output({ status = 'done', stop, fallbacks = [], withAlternatives = false, next = ['backend.implement'] } = {}) {
  const fields = { 'architecture-decision': 'response.md', 'current-state': 'data/current-state.json', 'stack-model': 'data/stack-model.json', 'independent-critique': 'critique.md' };
  if (withAlternatives) fields.alternatives = 'artifacts/entitlement-read-path-alternatives.html';
  return { schemaVersion: 9, operatorId: 'architecture.decide', step: '1-1', status, ...(stop ? { stop } : {}), fallbacks, fields, commits: [], next };
}

function writeStep(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'arch-step-'));
  const dir = path.join(session, 'step-1-1');
  mkdirSync(path.join(dir, 'data'), { recursive: true });
  mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return { dir, session };
}
const baseline = () => ({ 'input.json': input, 'output.json': output(), 'request.md': request(), 'response.md': response(), 'critique.md': critique(), 'data/current-state.json': currentState(), 'data/stack-model.json': stackModel() });

async function expectValid(files, label) {
  const { dir, session } = writeStep(files);
  const { errors } = await validateArchitectureStep(dir);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { dir, session } = writeStep(files);
  const { errors } = await validateArchitectureStep(dir);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'defaults (one alternative, automatic)');
await expectValid({
  ...baseline(),
  'request.md': request({ alternatives: 3, policy: 'approval-required', approval: 'shared-boundary' }),
  'response.md': response({ alternatives: 3, policy: 'approval-required' }),
  'data/stack-model.json': stackModel({ alternatives: 3 }),
  'output.json': output({ withAlternatives: true }),
  'artifacts/entitlement-read-path-alternatives.html': '<!doctype html><title>alternatives</title>',
}, 'three alternatives under approval-required');
await expectValid({ ...baseline(), 'output.json': output({ status: 'blocked', stop: 'DATA_OWNERSHIP_UNASSIGNED', next: [] }) }, 'blocked with a terminate code');

await expectError({ ...baseline(), 'output.json': { ...output(), stop: 'CHOICE_REQUIRED' } }, 'status done may not carry a stop', 'done with stop');
await expectError({ ...baseline(), 'output.json': output({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'output.json': output({ status: 'blocked', stop: 'CHOICE_REQUIRED', next: [] }) }, 'has disposition fallback under these Requirements', 'terminating on a fallback code under automatic');
await expectValid({ ...baseline(), 'request.md': request({ alternatives: 3, policy: 'approval-required' }), 'response.md': response({ alternatives: 3, policy: 'approval-required' }), 'data/stack-model.json': stackModel({ alternatives: 3 }), 'output.json': output({ status: 'blocked', stop: 'CHOICE_REQUIRED', next: [], withAlternatives: true }), 'artifacts/entitlement-read-path-alternatives.html': '<!doctype html><title>alternatives</title>' }, 'CHOICE_REQUIRED terminates under approval-required');
await expectError({ ...baseline(), 'output.json': output({ fallbacks: ['DATA_OWNERSHIP_UNASSIGNED'] }) }, 'has disposition terminate under these Requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'output.json': output({ fallbacks: ['COMPATIBILITY_UNVERIFIED'] }) }, 'not recorded under ## Fallbacks taken', 'fallback missing from response');
await expectError({ ...baseline(), 'request.md': request({ extra: '| `mystery` | 1 |\n' }) }, 'which architecture.decide does not declare', 'undeclared requirement');
await expectError({ ...baseline(), 'request.md': request().replace('| `objective` | one entitlement read path |', '| `objective` | |') }, 'required field objective has no value', 'missing required objective');
await expectError({ ...baseline(), 'critique.md': critique().replace('| rollback |', '| rollbak |') }, 'lacks a row for rollback', 'critique missing an adverse path');
await expectError({ ...baseline(), 'critique.md': critique({ failing: true }) }, 'attacks stale-state fail', 'done with a failing attack');
await expectError({ ...baseline(), 'critique.md': critique({ inherited: 'author thread' }) }, 'no inherited turns', 'critique inherited turns');
await expectError({ ...baseline(), 'data/stack-model.json': { ...stackModel(), stores: [{ ...stackModel().stores[0], writers: ['course-api'] }] } }, 'is not among its writers', 'owner does not write its store');
await expectError({ ...baseline(), 'data/stack-model.json': { ...stackModel(), stores: [{ ...stackModel().stores[0], writers: ['entitlement', 'course-api'] }] } }, 'no shared-write justification', 'unjustified second writer');
await expectError({ ...baseline(), 'data/stack-model.json': { ...stackModel(), components: stackModel().components.map((c) => (c.componentId === 'nestjs' ? { ...c, compatibility: c.compatibility.slice(0, 4) } : c)) } }, 'compatibility unverified on backup-restore', 'retained component missing an axis');
await expectError({ ...baseline(), 'data/stack-model.json': { ...stackModel(), alternatives: [{ ...stackModel().alternatives[0], status: 'rejected', rejectedBecause: 'x' }] } }, 'exactly one alternative must be selected', 'no selected alternative');
await expectError({ ...baseline(), 'data/stack-model.json': stackModel({ alternatives: 2 }) }, 'but the request asked for 1', 'more alternatives than asked');
await expectError({ ...baseline(), 'response.md': response({ handoffDetail: 'src/entitlement/query.ts returns one answer' }) }, 'names an implementation file', 'handoff names a file');
await expectError({ ...baseline(), 'response.md': response().replace('| Selected alternative | `shared-boundary` |', '| Selected alternative | `edge-cache` |') }, 'Decision names edge-cache', 'response and model disagree on the selection');
await expectError({ ...baseline(), 'response.md': response().replace('## Handoff', '## Hand-off') }, 'missing section ^## Handoff$', 'response section renamed');
await expectError({ ...baseline(), 'data/current-state.json': { ...currentState(), observedHead: 'nope' } }, 'observedHead', 'current-state schema');
await expectError({ ...baseline(), 'request.md': request({ approval: 'shared-boundary' }) }, 'approval is bound under automatic policy', 'approval under automatic');
await expectError({ ...baseline(), 'output.json': (() => { const o = output(); delete o.fields['independent-critique']; return o; })() }, 'required output independent-critique is not in fields', 'missing required output');

process.stdout.write('architecture.decide self-test: 3 valid steps, 22 rejected mutations\n');
