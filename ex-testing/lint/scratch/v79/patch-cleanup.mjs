// v7-9 one-shot patch: make the share and recur capture harnesses delete every row they create.
// Both harnesses left rows behind on a replay (revokeCollaborator leaves a `revoked` row and
// deleteTask does not cascade; makeRecurring leaves the ended rule), which is exactly the
// "unresolved owned resources" condition the Work layout forbids for a run that claims a pass.
import fs from 'node:fs';

const SHARE = 'examples/todo-app-backend/.starciwork/features/share/impl/todo-app-frontend/invite-screen/assets/capture.mjs';
const RECUR = 'examples/todo-app-backend/.starciwork/features/recur/impl/todo-app-frontend/schedule/assets/capture.mjs';

const apply = (file, pairs) => {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!source.includes(from)) throw new Error(`anchor not found in ${file}: ${from.slice(0, 70)}`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
  console.log(`patched ${file}`);
};

apply(SHARE, [
  [
    "import { createRequire } from 'node:module';\nimport { writeFileSync, mkdirSync } from 'node:fs';",
    "import { createRequire } from 'node:module';\nimport { execFileSync } from 'node:child_process';\nimport { writeFileSync, mkdirSync } from 'node:fs';",
  ],
  [
    "const OUT_DIR = process.env.CAPTURE_DIR ?? here;",
    "const OUT_DIR = process.env.CAPTURE_DIR ?? here;\nconst PG_CONTAINER = process.env.CAPTURE_PG_CONTAINER ?? 'compose-postgres-1';\nconst PG_DB = process.env.CAPTURE_PG_DB ?? 'todo';\nconst PG_USER = process.env.CAPTURE_PG_USER ?? 'postgres';\n\n/**\n * revokeCollaborator leaves a `revoked` row and deleteTask does not cascade, so an API-only cleanup\n * cannot fully retract an invitation. The rows this run owns are deleted by their recorded task ids\n * and nothing else, which is what lets the run claim no unresolved owned resources.\n */\nconst dropRowsFor = taskIds => {\n  if (!taskIds.length) return;\n  const list = taskIds.map(id => `'${id.replaceAll(\"'\", \"''\")}'`).join(', ');\n  execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-c',\n    `delete from invitations where task_id in (${list})`], { stdio: 'pipe' });\n};",
  ],
  [
    "// Leave no fixture behind.\nfor (const taskId of createdTasks) {\n  await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename } }', { id: taskId }, ownerToken);\n}",
    "// Leave no fixture behind: the tasks and every invitation row they carry.\nfor (const taskId of createdTasks) {\n  await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename } }', { id: taskId }, ownerToken);\n}\ndropRowsFor(createdTasks);",
  ],
]);

apply(RECUR, [
  [
    "import { createRequire } from 'node:module';\nimport { writeFileSync, mkdirSync } from 'node:fs';",
    "import { createRequire } from 'node:module';\nimport { execFileSync } from 'node:child_process';\nimport { writeFileSync, mkdirSync } from 'node:fs';",
  ],
  [
    "const OUT_DIR = process.env.CAPTURE_DIR ?? here;",
    "const OUT_DIR = process.env.CAPTURE_DIR ?? here;\nconst PG_CONTAINER = process.env.CAPTURE_PG_CONTAINER ?? 'compose-postgres-1';\nconst PG_DB = process.env.CAPTURE_PG_DB ?? 'todo';\nconst PG_USER = process.env.CAPTURE_PG_USER ?? 'postgres';\n\n/**\n * The `active` capture ends its rule through the page, but endRecurrence keeps the rule row as\n * history, so an API-only run leaves one row per replay. This deletes only the ended rules this\n * run's own person accumulated for the fixture title, which is what lets the run claim a clean\n * ledger; the schedule screen's `ended` state is exactly that history, so it cannot be avoided.\n */\nconst dropEndedRules = personId => {\n  if (!personId) return;\n  execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-c',\n    `delete from recurrence_rules where owner = '${personId}' and title = '${TASK.replaceAll(\"'\", \"''\")}'`], { stdio: 'pipe' });\n};\n\nconst psqlValue = (sql, token) => execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-t', '-A', '-c',\n  sql.replaceAll('@TOKEN@', token)], { encoding: 'utf8' }).trim();",
  ],
  [
    "for (const viewport of VIEWPORTS) {\n  try {\n    const token = await signIn();",
    "for (const viewport of VIEWPORTS) {\n  try {\n    const token = await signIn();\n    const personId = psqlValue('select person_id from sessions where token = \\'@TOKEN@\\'', token);",
  ],
  [
    "    await context.close();\n    // Leave no fixture behind: the rule is already ended, so the task is this run's only row.\n    if (created) await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename } }', { id: taskId }, token);",
    "    await context.close();\n    // Leave no fixture behind: the ended rule rows, and the task if this run created it.\n    dropEndedRules(personId);\n    if (created) await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename } }', { id: taskId }, token);",
  ],
]);
console.log('done');
