import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mutateSession } from './session-lock.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';

export function restatementDecisionId(request, id, text) {
  if (!Number.isInteger(request.expected?.goalVersion)) return `restatement:${id}`;
  const hash = createHash('sha256').update(JSON.stringify({ operator: request.operatorId, goalVersion: request.expected.goalVersion, restatement: text.replace(/\r\n/g, '\n') })).digest('hex');
  return `restatement:${id}:v${request.expected.goalVersion}:${hash}`;
}

export function restatementChoiceSource(branch, request) {
  if (!request.resume) return { request, text: readFileSync(path.join(branch, 'response/restatement.md'), 'utf8') };
  const session = path.dirname(path.dirname(branch));
  const previous = path.join(session, `step-${request.resume.step}`, `parallel-${request.resume.parallel}`);
  const original = JSON.parse(readFileSync(path.join(previous, 'request/request.json'), 'utf8'));
  if (original.operatorId !== request.operatorId || original.expected?.goalVersion !== request.expected?.goalVersion) throw Error('RESTATEMENT_SCOPE_MISMATCH: a selection cannot resume a reading from another operator or mission version');
  return { request: original, text: readFileSync(path.join(previous, 'response/restatement.md'), 'utf8') };
}

export async function recordRestatementChoice(branch, answer, { root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  if (!['as-stated', 'corrected'].includes(answer?.selected) || answer.selectedBy !== 'user' || typeof answer.sourceRef !== 'string' || !answer.sourceRef.trim()) throw Error('RESTATEMENT_AUTHORITY_REQUIRED: record the actual user answer and message reference');
  branch = path.resolve(branch);
  const session = path.dirname(path.dirname(branch));
  return mutateSession(session, async state => {
    const request = JSON.parse(readFileSync(path.join(branch, 'request/request.json'), 'utf8'));
    const response = JSON.parse(readFileSync(path.join(branch, 'response/response.json'), 'utf8'));
    const attempt = state.attempts?.[`${request.step}/${request.parallel}`];
    if (attempt?.status !== 'blocked' || attempt.id !== request.attempt?.id || response.status !== 'blocked' || response.stop !== 'RESTATEMENT_UNCONFIRMED') throw Error('RESTATEMENT_UNSEALED: answer only an accepted blocked reading');
    if (request.expected?.goalVersion !== state.mission?.version) throw Error('RESTATEMENT_SCOPE_MISMATCH: an old mission reading cannot authorize the current scope');
    const text = readFileSync(path.join(branch, 'response/restatement.md'), 'utf8');
    const id = /^# restatement — ([a-z0-9][a-z0-9-]*)\r?$/m.exec(text)?.[1];
    if (!id) throw Error('RESTATEMENT_CONTENT_MISMATCH: the rendered reading has no valid subject');
    const decisionId = restatementDecisionId(request, id, text);
    if (response.interaction?.decisionId !== decisionId) throw Error('RESTATEMENT_CONTENT_MISMATCH: response choice does not bind the exact rendered reading');
    const errors = await evidenceManifestErrors(branch, attempt.evidenceManifest);
    if (errors.length) throw Error(errors.join('\n'));
    const { validateStep } = await import('./validate-step.mjs');
    const checked = await validateStep(root, branch, { operator: true, requestPhase: 'accept' });
    if (checked.errors.length) throw Error(checked.errors.join('\n'));
    state.choices ??= {};
    const choice = { selected: answer.selected, selectedBy: 'user', sourceRef: answer.sourceRef };
    if (state.choices[decisionId] && JSON.stringify(state.choices[decisionId]) !== JSON.stringify(choice)) throw Error('RESTATEMENT_CHOICE_FROZEN: preserve the original answer; a changed reading has its own identity');
    state.choices[decisionId] = choice;
    return { decisionId, ...choice };
  });
}

async function main() {
  try {
    if (['delegate', 'delegated-review', 'scope-review'].includes(process.argv[2])) {
      const { recordRestatementDelegation, recordDelegatedRestatementReview, recordScopeRestatementReview } = await import('./restatement-delegation.mjs');
      const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const input=JSON.parse(readFileSync(path.resolve(process.argv[4]), 'utf8'));
      const operation={delegate:recordRestatementDelegation,'delegated-review':recordDelegatedRestatementReview,'scope-review':recordScopeRestatementReview}[process.argv[2]];
      process.stdout.write(JSON.stringify(await operation(root,path.resolve(process.argv[3]),input))+'\n');return;
    }
    const answering = process.argv[2] === 'answer';
    const branch = path.resolve(process.argv[answering ? 3 : 2]);
    if (answering) {
      const answer = JSON.parse(readFileSync(path.resolve(process.argv[4]), 'utf8'));
      process.stdout.write(`${JSON.stringify(await recordRestatementChoice(branch, answer))}\n`);
    } else {
      const request = JSON.parse(readFileSync(path.join(branch, 'request/request.json'), 'utf8'));
      const source = restatementChoiceSource(branch, request);
      const id = /^# restatement — ([a-z0-9][a-z0-9-]*)\r?$/m.exec(source.text)?.[1];
      if (!id) throw Error('the rendered reading must declare its valid subject');
      process.stdout.write(`${restatementDecisionId(source.request, id, source.text)}\n`);
    }
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Validation imports this module again; let module evaluation finish before awaiting it.
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
