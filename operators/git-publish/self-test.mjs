// Proves validate.mjs on a synthetic session branch: one fast-forward publication, one merge-commit
// publication, one that carries the continuation tag it was asked for, one blocked on a rejected
// push, and one mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateGitPublishStep } from './validate.mjs';

const HEAD = '1'.repeat(40);
const REMOTE = '2'.repeat(40);
const OTHER = '3'.repeat(40);
const BOUNDARY = 'api.core';
const APPROVAL = '@worktrees/businesses/features/api-core/model.json#approval';
const SESSION = 'session/s-test';
const TAG = { name: 'v1.4.0', message: 'continuation' };

function responseMd({
  boundary = BOUNDARY, approval = APPROVAL, mode = 'fast-forward-only', forced = 'no', merge = 'fast-forward',
  verified = HEAD, heads = [['`@workspaces/be`', '`mtp`', HEAD, REMOTE, '4']], hooks = [['`pre-push`', '`.husky/pre-push`', 'passed']],
  tag = null, cleanup = 'worktree and session branch removed',
  findings = [['HOOK_ENFORCED', '`pre-push`', 'the hook ran and was not bypassed'], ['REMOTE_FAST_FORWARDED', '`@workspaces/be`', 'the ref advanced from the remote head it carried']],
} = {}) {
  return `# git-publication — ${boundary}

The boundary was published from the commit quality verified onto the routed ref, under enforced
hooks, without force.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`git.publish\` |
| Step | \`step-1/parallel-1\` |
| Project | \`starci-academy\` |
| Boundary | ${boundary} |
| Approval | ${approval} |
| Route receipt | \`step-1/parallel-1/response/response.md\` |
| Worktree branches | forbidden |
| Mutation branch | \`mtp\` |
| Frozen head | \`${HEAD}\` |

## Publication

| Field | Value |
| --- | --- |
| Remote | origin |
| Ref | \`refs/heads/mtp\` |
| Mode | ${mode} |
| Forced | ${forced} |
| Session branch | \`${SESSION}\` |
| Target branch | \`mtp\` |
| Merge | ${merge} |
| Verified commit | \`${verified}\` |
| Cleanup | ${cleanup} |

## Published heads

| Checkout | Branch | Head | Previous remote head | Commits |
| --- | --- | --- | --- | --- |
${heads.map((h) => `| ${h[0]} | ${h[1]} | \`${h[2]}\` | \`${h[3]}\` | ${h[4]} |`).join('\n')}

## Hooks

| Hook | Reference | Outcome |
| --- | --- | --- |
${hooks.map((h) => `| ${h[0]} | ${h[1]} | ${h[2]} |`).join('\n')}

## Continuation tag

| Field | Value |
| --- | --- |
| Tag | ${tag ? `\`${tag.name}\`` : '—'} |
| Ref | ${tag ? `\`refs/tags/${tag.name}\`` : '—'} |
| Head | ${tag ? `\`${tag.head}\`` : '—'} |

## Findings

| Code | Subject | Statement |
| --- | --- | --- |
${findings.map(([code, subject, statement]) => `| \`${code}\` | ${subject} | ${statement} |`).join('\n')}
`;
}

const requestJson = ({ boundary = BOUNDARY, approval = APPROVAL, tag = null, inputs = {
  'workspace-route-binding': 'step-1/parallel-1/response/response.md',
  changes: 'step-1/parallel-1/response/changes.md',
  'quality-verification': 'step-1/parallel-1/response/quality.md',
}, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'git.publish', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/local/routes/starci-academy/be', head: HEAD }],
  requirements: { boundary, approval, tag, resume: null, ...extra },
  inputs, resume: null,
});

const responseJson = ({ status = 'done', stop, commits = [HEAD], next = ['release.deploy'] } = {}) => ({
  schemaVersion: 9, operatorId: 'git.publish', step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [], fields: status === 'blocked' ? {} : { 'git-publication': 'response/response.md' }, commits, next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'publish-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'git.publish' }, current: '1/1', status: 'running' }));
  for (const name of ['response.md', 'changes.md', 'quality.md']) writeFileSync(path.join(branch, 'response', name), '# placeholder\n');
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  ...over,
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateGitPublishStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateGitPublishStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a fast-forward publication of the verified commit');
await expectValid(baseline({ 'response/response.md': responseMd({ merge: 'merge-commit' }) }), 'a merge commit onto a target that moved');
await expectValid(baseline({
  'request/request.json': requestJson({ tag: TAG }),
  'response/response.md': responseMd({
    tag: { ...TAG, head: HEAD },
    findings: [['HOOK_ENFORCED', '`pre-push`', 'the hook ran'], ['CONTINUATION_TAG_PUBLISHED', '`v1.4.0`', 'the tag points at the head this run pushed']],
  }),
}), 'a continuation tag the person asked for');
await expectValid({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'NON_FAST_FORWARD', commits: [], next: [] }),
  'response/response.md': null,
}, 'blocked because the remote had moved');

await expectError(baseline({ 'response/response.json': { ...responseJson(), stop: 'HOOK_BLOCKED' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(baseline({ 'response/response.json': responseJson({ status: 'blocked', stop: 'PUSH_REJECTED', commits: [], next: [] }) }), 'not a registered code', 'unknown stop code');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { force: true } }) }), 'requirements.force is not a field', 'force asked for in the request');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { writeRoots: ['src'] } }) }), 'requirements.writeRoots is not a field', 'a field the operator no longer declares');
await expectError(baseline({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'a publish with nobody approving it');
await expectError(baseline({ 'response/response.md': responseMd({ boundary: 'other.boundary' }) }), 'but the request bound', 'a receipt for another boundary');
await expectError(baseline({ 'response/response.md': responseMd({ approval: '`someone-elses-approval`' }) }), 'names an approval the request did not bind', 'an approval borrowed from another boundary');
await expectError(baseline({ 'response/response.md': responseMd({ mode: 'force' }) }), 'the publication mode is always fast-forward only', 'a forced publication mode');
await expectError(baseline({ 'response/response.md': responseMd({ forced: 'yes' }) }), 'a forced push rewrites', 'a push that was forced');
await expectError(baseline({ 'response/response.md': responseMd({ merge: 'rebase' }) }), 'merged, never rebased', 'a session branch rebased onto the target');
await expectError(baseline({ 'response/response.md': responseMd({ verified: OTHER }) }), 'but quality verified', 'a head past the commit the gates measured');
await expectError(baseline({ 'response/response.md': responseMd({ verified: 'not-a-sha' }) }), 'Verified commit is not a commit sha', 'a receipt that never says what was verified');
await expectError(baseline({ 'response/response.md': responseMd({ heads: [['`@workspaces/be`', '`mtp`', HEAD, HEAD, '4']] }) }), 'equals the remote head it claims to advance', 'a publication that advanced nothing');
await expectError(baseline({ 'response/response.md': responseMd({ hooks: [['`pre-commit`', '`.husky/pre-commit`', 'passed']] }) }), 'lacks the pre-push result', 'a publish with no pre-push result');
await expectError(baseline({ 'response/response.md': responseMd({ hooks: [['`pre-push`', '`.husky/pre-push`', 'failed']] }) }), 'is HOOK_BLOCKED, not a receipt', 'a receipt over a failed hook');
await expectError(baseline({ 'response/response.md': responseMd({ findings: [['BOUNDARY_CLEAN', '`api.core`', 'nothing dirty lay outside the boundary']] }) }), 'records no HOOK_ENFORCED finding', 'hooks run but never recorded');
await expectError(baseline({ 'request/request.json': requestJson({ tag: TAG }) }), 'asked for a continuation tag and the receipt records none', 'a tag asked for and never pushed');
await expectError(baseline({ 'response/response.md': responseMd({ tag: { ...TAG, head: HEAD }, findings: [['HOOK_ENFORCED', '`pre-push`', 'ran'], ['CONTINUATION_TAG_PUBLISHED', '`v1.4.0`', 'pushed']] }) }), 'without the request asking for one', 'a tag nobody asked for');
await expectError(baseline({
  'request/request.json': requestJson({ tag: TAG }),
  'response/response.md': responseMd({ tag: { ...TAG, head: OTHER }, findings: [['HOOK_ENFORCED', '`pre-push`', 'ran'], ['CONTINUATION_TAG_PUBLISHED', '`v1.4.0`', 'pushed']] }),
}), 'which this publication did not push', 'a tag on somebody else\'s commit');
await expectError(baseline({ 'response/response.md': responseMd({ cleanup: 'worktree kept for inspection' }) }), 'removes the worktree and the session branch', 'a published branch that never cleaned up');
await expectError(baseline({ 'response/response.json': responseJson({ commits: [] }) }), 'commits does not register the published head', 'a receipt whose commit the response hides');
await expectError(baseline({ 'response/response.json': responseJson({ commits: [HEAD, OTHER] }) }), 'which the receipt did not publish', 'a commit the receipt never published');
await expectError(baseline({ 'request/request.json': requestJson({ inputs: { 'workspace-route-binding': 'step-1/parallel-1/response/response.md', changes: 'step-1/parallel-1/response/changes.md' } }) }), 'required input quality-verification is absent', 'a publish with nothing verified');
await expectError(baseline({ 'response/response.md': responseMd().replace('## Hooks', '## Checks') }), 'missing section ^## Hooks$', 'receipt section renamed');

process.stdout.write('git.publish self-test: 4 valid branches, 22 rejected mutations\n');
