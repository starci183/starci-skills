// Live proof for impl.recur.todo-app-backend.engine, complementing scripts/live-proof-recur.sh.
// The checked-in script creates an EveryWeekday rule with startDate=today, so its tick-observation
// step can only pass on a weekday - on a weekend the rule honestly produces no occurrence for the
// current local date and the wait can never succeed. This probe exercises the same production path
// (real signIn -> real makeRecurring -> the api's own scheduler tick -> a real materialised
// occurrence row backed by a real task -> real endRecurrence orphaning) with an EveryNDays n=1 rule,
// which fires on every calendar date including today. Run against the recur lane's own api instance
// started with a short tick, exactly as the script's own header prescribes:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_recur PORT=3105 \
//     RECUR_TICK_CRON='*/5 * * * * *' node dist/main.js
// then: node .starciwork/features/recur/impl/todo-app-backend/engine/assets/live-proof.mjs
// Exits non-zero on the first mismatch, naming the step that failed.

const API_URL = process.env.API_URL ?? 'http://localhost:3105';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@todo.dev';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'todo-demo-pass';
const TICK_TIMEOUT_MS = Number(process.env.TICK_TIMEOUT_SECONDS ?? 120) * 1000;

const todayBerlin = () =>
  new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Berlin'});

let step = '';
const ok = name => { console.log(`   ok ${name}`); };
const fail = message => { console.error(`FAIL [${step}]: ${message}`); process.exit(1); };

async function graphql(query, variables, token) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
    body: JSON.stringify({query, variables}),
  });
  const body = await res.json();
  if (Array.isArray(body.errors) && body.errors.length) {
    fail(`${step} -> graphql errors: ${JSON.stringify(body.errors[0].message)}`);
  }
  return body.data;
}

const main = async () => {
  step = 'signIn demo';
  const sign = await graphql(
    'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }',
    {input: {email: EMAIL, password: PASSWORD}});
  const token = sign.signIn.sessionToken;
  if (!token) fail('no sessionToken');
  ok(`-> sessionToken`);

  step = 'makeRecurring every-n-days n=1 startDate=today';
  const today = todayBerlin();
  const made = await graphql(
    'mutation M($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }',
    {input: {title: 'live-proof window probe', frequency: 'EveryNDays', n: 1, timeZone: 'Europe/Berlin', time: '09:00', startDate: today}},
    token);
  const ruleId = made.makeRecurring.ruleId;
  if (!ruleId) fail(`no ruleId: ${JSON.stringify(made)}`);
  ok(`-> ruleId ${ruleId}`);

  step = 'waiting for a real scheduler tick to materialise today\'s occurrence';
  const deadline = Date.now() + TICK_TIMEOUT_MS;
  let materialised = null;
  while (Date.now() < deadline) {
    const up = await graphql(
      'query Q($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate status } previewDates } }',
      {ruleId}, token);
    materialised = up.upcomingOccurrences.materialised.find(o => o.localDate === today) ?? null;
    if (materialised) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  if (!materialised) fail(`no occurrence materialised for ${today} within ${TICK_TIMEOUT_MS / 1000}s`);
  if (materialised.status !== 'materialised') fail(`unexpected status: ${JSON.stringify(materialised)}`);
  ok(`-> occurrence ${materialised.occurrenceId} materialised by the api's own tick`);

  step = 'the materialised occurrence is a real task the owner can list';
  const tasks = await graphql(
    'query Q { tasks { taskId title } }', {}, token);
  if (!tasks.tasks.some(t => t.taskId === materialised.occurrenceId)) {
    fail(`occurrence ${materialised.occurrenceId} is not a live task row: ${JSON.stringify(tasks)}`);
  }
  ok(`-> task ${materialised.occurrenceId} present in tasks`);

  step = 'endRecurrence endedAt=today orphans the materialised occurrence';
  const ended = await graphql(
    'mutation M($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }',
    {input: {ruleId, endedAt: today}}, token);
  if (ended.endRecurrence.orphanedCount < 1) fail(`expected >=1 orphaned, got ${JSON.stringify(ended)}`);
  ok(`-> orphanedCount ${ended.endRecurrence.orphanedCount}`);

  step = 'upcomingOccurrences after ending -> no preview, history kept as orphaned';
  const after = await graphql(
    'query Q($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { materialised { occurrenceId localDate status } previewDates } }',
    {ruleId}, token);
  if (after.upcomingOccurrences.previewDates.length !== 0) fail('ended rule still previews');
  if (!after.upcomingOccurrences.materialised.some(o => o.status === 'orphaned')) fail('no orphaned history kept');
  ok('-> preview empty, occurrence history orphaned');

  step = 'cleanup: deleteTask the materialised task';
  await graphql('mutation M($id: ID!) { deleteTask(id: $id) { __typename } }',
    {id: materialised.occurrenceId}, token);
  ok('-> materialised task deleted');

  console.log('live-proof (weekday-window-safe): all steps passed');
};

main().catch(error => fail(String(error?.stack ?? error)));
