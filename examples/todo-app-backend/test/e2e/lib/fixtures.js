'use strict';

/**
 * Scenario fixtures. Everything a scenario needs exists because a public operation created it: a person
 * is whoever the demo realm can sign in, a task is whatever createTask made, a collaborator is an
 * invitation plus its acceptance. No fixture reaches into a service, a repository or the database, and no
 * product source is imported - the only door is lib/client.js.
 */

const { call, persona, marker } = require('./client');

let counter = 0;

/** A title no other scenario, run or seeded row can collide with. */
function uniqueTitle(label) {
  counter += 1;
  return `e2e:${marker()}:${label}:${counter}`;
}

async function createTask(personaName, title, note) {
  const session = await persona(personaName);
  const observed = await call('createTask', {
    variables: { input: { title } },
    token: session.token,
    note: note ?? `createTask "${title}" as ${personaName}`,
  });
  if (observed.errorCode) throw new Error(`createTask failed: ${observed.errorCode} ${observed.errorMessage}`);
  return observed.data.createTask;
}

async function listTasks(personaName, note = 'read the caller\'s task list') {
  const session = await persona(personaName);
  const observed = await call('listTasks', { token: session.token, note });
  if (observed.errorCode) throw new Error(`tasks failed: ${observed.errorCode} ${observed.errorMessage}`);
  return observed.data.tasks;
}

/** There is no single-task query in this schema: a task is read back out of its owner's list. */
async function findTask(personaName, taskId) {
  const tasks = await listTasks(personaName, `tasks, to read ${taskId} back out of the list`);
  return tasks.find((task) => task.taskId === taskId) ?? null;
}

async function auditLines(personaName, note = 'read the caller\'s own audit log') {
  const session = await persona(personaName);
  const observed = await call('auditLog', { token: session.token, note });
  if (observed.errorCode) throw new Error(`auditLog failed: ${observed.errorCode} ${observed.errorMessage}`);
  return observed.data.auditLog;
}

async function exportLines(personaName) {
  const session = await persona(personaName);
  const observed = await call('exportMyData', { token: session.token, note: `exportMyData as ${personaName}` });
  if (observed.errorCode) throw new Error(`exportMyData failed: ${observed.errorCode} ${observed.errorMessage}`);
  return observed.data.exportMyData;
}

/** invite + accept, so a collaborator exists the way the product creates one. */
async function acceptInvitation(ownerName, taskId, collaboratorEmail, role) {
  const owner = await persona(ownerName);
  const invited = await call('invite', {
    variables: { input: { taskId, email: collaboratorEmail, role } },
    token: owner.token,
    note: `invite ${collaboratorEmail} as ${role} on ${taskId}`,
  });
  if (invited.errorCode) throw new Error(`invite failed: ${invited.errorCode} ${invited.errorMessage}`);
  const invitationId = invited.data.invite.invitationId;
  const collaborator = await personaForEmail(collaboratorEmail);
  const accepted = await call('acceptInvitation', {
    variables: { input: { invitationId, email: collaboratorEmail } },
    token: collaborator.token,
    note: `acceptInvitation ${invitationId} as ${collaboratorEmail}`,
  });
  if (accepted.errorCode) throw new Error(`acceptInvitation failed: ${accepted.errorCode} ${accepted.errorMessage}`);
  return { invitationId, taskId, role: accepted.data.acceptInvitation.role, status: accepted.data.acceptInvitation.status };
}

const EMAIL_TO_PERSONA = new Map([
  ['demo@todo.dev', 'owner'],
  ['demo2@todo.dev', 'other'],
]);

async function personaForEmail(email) {
  const name = EMAIL_TO_PERSONA.get(email);
  if (!name) throw new Error(`the run-owned realm seeds no sign-in identity for ${email}`);
  return persona(name);
}

function emailOf(personaName) {
  const email = { owner: 'demo@todo.dev', other: 'demo2@todo.dev' }[personaName];
  if (!email) throw new Error(`unknown persona ${personaName}`);
  return email;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls a public read until it shows what the stack is expected to have produced, or gives up. */
async function until(label, probe, { timeoutMs = 150_000, intervalMs = 2000 } = {}) {
  const startedAt = Date.now();
  let last;
  let attempts = 0;
  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    last = await probe();
    if (last.done) return { ...last, attempts, waitedMs: Date.now() - startedAt };
    await sleep(intervalMs);
  }
  throw new Error(`timed out after ${timeoutMs}ms (${attempts} reads) waiting for ${label}; last observation: ${JSON.stringify(last?.value ?? null).slice(0, 700)}`);
}

/**
 * Waits for the api's own in-process recur generator (integration.recur.scheduler) to materialise a
 * rule's occurrences. The wait is real: nothing in this suite calls GeneratorService directly.
 */
async function occurrencesAfterTick(ruleId, personaName, minimumMaterialised = 1) {
  const session = await persona(personaName);
  const settled = await until(`upcomingOccurrences(${ruleId}) to list at least ${minimumMaterialised} materialised occurrence(s)`, async () => {
    const observed = await call('upcomingOccurrences', {
      variables: { ruleId },
      token: session.token,
      note: `upcomingOccurrences(${ruleId}) while waiting for a real generator tick`,
    });
    if (observed.errorCode) throw new Error(`upcomingOccurrences failed: ${observed.errorCode} ${observed.errorMessage}`);
    const result = observed.data.upcomingOccurrences;
    return { done: result.materialised.length >= minimumMaterialised, value: result };
  });
  // One extra read so a rule still mid-backfill cannot be observed half-way through.
  const extra = await call('upcomingOccurrences', {
    variables: { ruleId },
    token: session.token,
    note: `upcomingOccurrences(${ruleId}) after the generator settled`,
  });
  return { ...extra.data.upcomingOccurrences, waitedMs: settled.waitedMs, attempts: settled.attempts };
}

function localDates(occurrences) {
  return occurrences.materialised.map((occurrence) => occurrence.localDate).sort();
}

function occurrenceOn(occurrences, localDate) {
  return occurrences.materialised.filter((occurrence) => occurrence.localDate === localDate);
}

/** Local calendar date `days` from today, in the given IANA zone - the shape a rule's startDate takes. */
function localDateOffset(days, timeZone = 'UTC') {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function completeTask(personaName, taskId, note) {
  const session = await persona(personaName);
  return call('completeTask', { variables: { id: taskId }, token: session.token, note: note ?? `completeTask(${taskId}) as ${personaName}` });
}

async function reopenTask(personaName, taskId, note) {
  const session = await persona(personaName);
  return call('reopenTask', { variables: { id: taskId }, token: session.token, note: note ?? `reopenTask(${taskId}) as ${personaName}` });
}

async function deleteTask(personaName, taskId, note) {
  const session = await persona(personaName);
  return call('deleteTask', { variables: { id: taskId }, token: session.token, note: note ?? `deleteTask(${taskId}) as ${personaName}` });
}

async function makeRule(personaName, input) {
  const session = await persona(personaName);
  const observed = await call('makeRecurring', {
    variables: { input },
    token: session.token,
    note: `makeRecurring ${input.frequency} ${input.time}@${input.timeZone} from ${input.startDate} as ${personaName}`,
  });
  if (observed.errorCode) throw new Error(`makeRecurring failed: ${observed.errorCode} ${observed.errorMessage}`);
  return observed.data.makeRecurring;
}

async function endRule(personaName, ruleId, endedAt) {
  const session = await persona(personaName);
  return call('endRecurrence', {
    variables: { input: { ruleId, endedAt } },
    token: session.token,
    note: `endRecurrence(${ruleId}) effective ${endedAt} as ${personaName}`,
  });
}

async function editRule(personaName, input) {
  const session = await persona(personaName);
  return call('editRecurrence', {
    variables: { input },
    token: session.token,
    note: `editRecurrence(${input.ruleId}) as ${personaName}`,
  });
}

async function upcoming(personaName, ruleId, note) {
  const session = await persona(personaName);
  return call('upcomingOccurrences', {
    variables: { ruleId },
    token: session.token,
    note: note ?? `upcomingOccurrences(${ruleId}) as ${personaName}`,
  });
}

async function requestErasure(personaName) {
  const session = await persona(personaName);
  return call('requestErasure', { token: session.token, note: `requestErasure as ${personaName}` });
}

async function completeErasure(personaName, requestId) {
  const session = await persona(personaName);
  return call('completeErasure', { variables: { requestId }, token: session.token, note: `completeErasure(${requestId}) as ${personaName}` });
}

/** The whole erasure journey through its two public doors: request, then complete. */
async function erase(personaName) {
  const requested = await requestErasure(personaName);
  if (requested.errorCode) throw new Error(`requestErasure failed: ${requested.errorCode} ${requested.errorMessage}`);
  const requestId = requested.data.requestErasure.requestId;
  const completed = await completeErasure(personaName, requestId);
  if (completed.errorCode) throw new Error(`completeErasure failed: ${completed.errorCode} ${completed.errorMessage}`);
  return { requestId, requested, completed };
}

module.exports = {
  uniqueTitle, createTask, listTasks, findTask, auditLines, exportLines, acceptInvitation,
  personaForEmail, emailOf, until, occurrencesAfterTick, localDates, occurrenceOn, localDateOffset, sleep,
  completeTask, reopenTask, deleteTask, makeRule, endRule, editRule, upcoming, requestErasure, completeErasure, erase,
};
