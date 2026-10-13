import { sourceLocation } from '../../lib/ts-ast.mjs';

/**
 * The front end serves no API (owner ruling 2026-10-13, both editions, every app): it calls the back end through Apollo GraphQL and
 * axios in modules/api and never runs server code of its own.
 *
 *   - FE_SERVER_ACTION_FORBIDDEN: a `"use server"` directive anywhere in a front-end source file, in the file's directive prologue
 *     (a Server Action module) or in the prologue of any function body (an inline Server Action), apps and packages alike;
 *   - FE_ROUTE_HANDLER_FORBIDDEN: a route handler (`route.ts`, `route.js` and their module variants) under `apps/<app>/src/app/` other than the
 *     liveness probe `health/live/route.ts` and the file the slot `fe.route.callback` owns (the Supabase auth code exchange).
 *
 * The check is provider-independent: it runs for every front-end repository.
 */
export const SERVER_ACTION_RULE_IDS = Object.freeze(['FE_SERVER_ACTION_FORBIDDEN', 'FE_ROUTE_HANDLER_FORBIDDEN']);

const SERVER_ACTION = 'FE_SERVER_ACTION_FORBIDDEN';
const ROUTE_HANDLER = 'FE_ROUTE_HANDLER_FORBIDDEN';
const CALLBACK_SLOT = 'fe.route.callback';
const ROUTE_FILE = /^apps\/([^/]+)\/src\/app\/(?:.+\/)?route\.[cm]?[jt]s$/u;

/** The statement nodes of a directive prologue: the leading string-literal expression statements. */
function prologue(ts, statements) {
  const directives = [];
  for (const statement of statements ?? []) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    directives.push(statement);
  }
  return directives;
}

const useServerIn = (ts, statements) => prologue(ts, statements).find(statement => statement.expression.text === 'use server') ?? null;

/** Every `"use server"` directive of one source file: the file-level one and each function-level one. */
function serverDirectives(ts, sourceFile) {
  const found = [];
  const fileLevel = useServerIn(ts, sourceFile.statements);
  if (fileLevel) found.push({ node: fileLevel, level: 'file' });
  const visit = node => {
    // a function with a block body: declaration, expression, arrow, method, constructor or accessor
    if (ts.isFunctionLike(node) && node.body && ts.isBlock(node.body)) {
      const inline = useServerIn(ts, node.body.statements);
      if (inline) found.push({ node: inline, level: 'function' });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

function serverActionViolations(ts, file) {
  return serverDirectives(ts, file.sourceFile).map(({ node, level }) => ({
    ruleId: SERVER_ACTION, path: file.rel, ...sourceLocation(file.sourceFile, node), level,
    message: `${file.rel} declares a ${level}-level "use server" directive: the front end runs no Server Action. Call the back end through a modules/api GraphQL operation (or a rest call) from an SWR hook, and move the server work into a be feature.`,
  }));
}

function routeHandlerViolation(file) {
  const match = ROUTE_FILE.exec(file.rel);
  if (!match) return null;
  if (file.rel === `apps/${match[1]}/src/app/health/live/route.ts` || file.slot === CALLBACK_SLOT) return null;
  return {
    ruleId: ROUTE_HANDLER, path: file.rel, line: 1, column: 1,
    message: `${file.rel} is a front-end route handler outside health/live/route.ts and the ${CALLBACK_SLOT} slot: the front end serves no API. Webhooks, cron, public APIs and third-party callbacks belong to be features; the browser reaches the back end through modules/api.`,
  };
}

/** The FE machine check of both bans over every source file of the front-end program. */
export function checkServerActions({ graph, context }) {
  const ts = context.ts;
  const violations = [];
  let routes = 0;
  for (const file of graph.files.values()) {
    violations.push(...serverActionViolations(ts, file));
    const route = routeHandlerViolation(file);
    if (ROUTE_FILE.test(file.rel)) routes += 1;
    if (route) violations.push(route);
  }
  return { violations, coverage: { status: 'checked', files: graph.files.size, routes } };
}
