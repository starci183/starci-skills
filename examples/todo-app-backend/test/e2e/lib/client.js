'use strict';

/**
 * The public transport contract, and nothing else. Every call below is an HTTP POST to the api's single
 * /graphql door with a {query, variables} body - the same shape scripts/live-proof.sh drives with curl.
 * No spec imports a service class, a repository, a handler or an entity, no test doubles of any kind are
 * installed, and no state is seeded by touching the database: preconditions are created by the public
 * operations that create them.
 *
 * Each call records its request and its observed response into the current scenario's step list, which
 * is what the run journal's readback asset is built from.
 */

const journal = require('./journal');

let currentSteps = null;

function beginSteps() {
  currentSteps = [];
  return currentSteps;
}
function endSteps() {
  const steps = currentSteps ?? [];
  currentSteps = null;
  return steps;
}

/**
 * The entire public transport contract: the 7 queries and 19 mutations the resolvers under
 * src/features/todo/graphql actually register, with the input and response field names those
 * graphql-types files declare. Nothing outside this list is reachable from a client, and two things the
 * work records talk about are simply not here: there is no single-task query (a task is read back out of
 * `tasks`), and there is no public door at all for completing or skipping a recurrence occurrence -
 * CompleteOccurrenceCommand and SkipOccurrenceCommand have no resolver, which is reported as a finding.
 */
const DOCUMENTS = {
  signIn: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }',
  signOut: 'mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }',
  createTask: 'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }',
  listTasks: 'query { tasks { taskId title complete } }',
  completeTask: 'mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }',
  reopenTask: 'mutation ReopenTask($id: ID!) { reopenTask(id: $id) { taskId complete } }',
  deleteTask: 'mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }',
  invite: 'mutation Invite($input: InviteInput!) { invite(input: $input) { invitationId taskId email role status } }',
  acceptInvitation: 'mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { invitationId role status } }',
  revokeCollaborator: 'mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(input: $input) { invitationId status } }',
  collaborators: 'query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email role status } }',
  auditLog: 'query { auditLog { at action target } }',
  exportMyData: 'query { exportMyData { at action target } }',
  requestErasure: 'mutation { requestErasure { requestId state } }',
  completeErasure: 'mutation CompleteErasure($requestId: ID!) { completeErasure(requestId: $requestId) { requestId state } }',
  makeRecurring: 'mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }',
  editRecurrence: 'mutation EditRecurrence($input: EditRecurrenceInput!) { editRecurrence(input: $input) { ruleId frequency timeZone time } }',
  endRecurrence: 'mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }',
  upcomingOccurrences: 'query Upcoming($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }',
  notificationPreferences: 'query Prefs($channel: String) { notificationPreferences(channel: $channel) { channel unsubscribed digestWindowMinutes } }',
  usage: 'query { planUsage { plan cap activeCount } }',
};

function baseUrl() {
  const url = process.env.E2E_API_URL;
  if (!url) {
    throw new Error(
      'E2E_API_URL is not set. This suite only ever proves against the run-owned stack `npm run test:e2e` brings up; '
      + 'it never points at a shared service, so running jest directly (or with a hand-exported URL) is refused.',
    );
  }
  return url;
}

/** One GraphQL operation over HTTP. Returns the parsed envelope plus the transport facts. */
async function call(documentName, { variables = {}, token, note, headers = {} } = {}) {
  const query = DOCUMENTS[documentName];
  if (!query) throw new Error(`no documented operation named ${documentName}`);
  const payload = JSON.stringify({ query, variables });
  const requestHeaders = { 'content-type': 'application/json', ...headers };
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl()}/graphql`, {
    method: 'POST',
    headers: requestHeaders,
    body: payload,
  });
  const text = await response.text();
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    envelope = { unparsableBody: text.slice(0, 2000) };
  }
  const observed = {
    httpStatus: response.status,
    data: envelope.data ?? null,
    errors: Array.isArray(envelope.errors) ? envelope.errors : null,
    errorCode: envelope.errors?.[0]?.extensions?.code ?? null,
    errorMessage: envelope.errors?.[0]?.message ?? null,
    raw: envelope,
    durationMs: Date.now() - startedAt,
  };
  if (currentSteps) {
    currentSteps.push({
      note: note ?? documentName,
      operation: documentName,
      request: { query: DOCUMENTS[documentName], variables, authenticated: Boolean(token) },
      observed: { ...observed, raw: undefined },
    });
  }
  return observed;
}

/** Signs in and keeps the session token; the only way this suite obtains an identity. */
async function signIn(email, password, note = `sign in as ${email}`) {
  const observed = await call('signIn', { variables: { input: { email, password } }, note });
  const token = observed.data?.signIn?.sessionToken;
  if (!token) {
    throw new Error(`sign-in for ${email} did not yield a sessionToken: ${observed.errorCode ?? observed.errorMessage ?? 'no error'} ${JSON.stringify(observed.raw).slice(0, 400)}`);
  }
  return { token, personId: observed.data.signIn.personId, observed };
}

const PERSONAS = {
  owner: { email: 'demo@todo.dev', password: 'todo-demo-pass' },
  other: { email: 'demo2@todo.dev', password: 'todo-demo-pass-2' },
};

const sessionCache = new Map();

async function persona(name, note) {
  const known = sessionCache.get(name);
  if (known) return known;
  const { email, password } = PERSONAS[name];
  if (!email) throw new Error(`unknown persona ${name}`);
  const session = await signIn(email, password, note ?? `sign in as ${email} (persona ${name})`);
  sessionCache.set(name, { ...session, email });
  return sessionCache.get(name);
}

/** Drops a cached session so a later scenario can observe what an unauthenticated caller sees. */
function forgetPersona(name) {
  sessionCache.delete(name);
}

function dataOf(observed, operation) {
  const data = observed.data?.[operation];
  if (data === undefined || data === null) {
    throw new Error(`no data.${operation} in observed response (${observed.errorCode ?? 'no code'}): ${JSON.stringify(observed.raw).slice(0, 500)}`);
  }
  return data;
}

/** A unique marker per scenario run so a title can never collide with a leftover or seeded row. */
function marker() {
  return process.env.E2E_RUN_TOKEN ?? 'e2e';
}

module.exports = { call, signIn, persona, forgetPersona, dataOf, beginSteps, endSteps, DOCUMENTS, PERSONAS, marker };
