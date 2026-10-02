// event-contract.mjs - the async contract between the services of one product (R139 HFS_EVENT_CONTRACT).
// A provider service declares the events it publishes in `be/apps/<service>/src/events.ts`, a literal table
//   export const EVENTS = { "order.placed": { version: 1, payload: { orderId: "string" } } } as const
// (the queue an event travels on is its name)
// An event may declare `compensates: "<event name>"`: it announces the failure of the step that event started, so the services
// that consume it undo that step (a compensating flow; R140 asks its e2e spec to drive the whole flow).
// and commits the snapshot of it, `be/contracts/<service>/events.json` (`hfs emit-contracts` writes it, never a hand). A consumer
// service declares what it reads in `be/apps/<service>/src/consumes.ts`, a literal table
//   export const CONSUMES = { order: { "order.placed": 1 } } as const
// (provider service -> event name -> version). Both readers walk the TypeScript syntax tree of a literal; nothing is executed.
// The functions take the `ts` module the caller loaded (the repository's own, else the runtime's); this file imports nothing.

export const EVENT_CONTRACT_SCHEMA = 'starci/event-contract@1';
export const EVENTS_EXPORT = 'EVENTS';
export const CONSUMES_EXPORT = 'CONSUMES';
const FIELD_TYPE = /^(?:string|number|boolean|string\[\]|number\[\])\??$/;

/** The expression of `export const <name> = <expression>` (an `as const` or `satisfies` wrapper removed), or null. */
function exportedLiteral(ts, sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name || declaration.initializer === undefined) continue;
      let expression = declaration.initializer;
      while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) expression = expression.expression;
      return expression;
    }
  }
  return null;
}

/** The text of a string-literal property name or key, or null. */
const keyText = (ts, name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text : null);

/** The entries of an object literal as `[key, initializer]`; a spread, a computed key or a method is a problem. */
function entriesOf(ts, literal, where, problems) {
  if (!ts.isObjectLiteralExpression(literal)) {
    problems.push(`${where} is not an object literal`);
    return [];
  }
  const entries = [];
  for (const property of literal.properties) {
    const key = ts.isPropertyAssignment(property) ? keyText(ts, property.name) : null;
    if (key === null) problems.push(`${where} holds an entry that is not \`key: value\` with a plain key`);
    else entries.push([key, property.initializer]);
  }
  return entries;
}

const stringOf = (ts, node) => (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null);
const integerOf = (ts, node) => (ts.isNumericLiteral(node) && Number.isInteger(Number(node.text)) && Number(node.text) >= 1 ? Number(node.text) : null);

/** Parses `text` as a TypeScript file. */
const parse = (ts, text) => ts.createSourceFile('events.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/**
 * The events a provider declares: `{ events: { <name>: { version, payload: { <field>: <type> }, compensates? } }, problems: [text] }`.
 * `events` is null when the file exports no `EVENTS`; a malformed entry is a problem and is left out.
 */
export function readEvents(ts, text) {
  const problems = [];
  const literal = exportedLiteral(ts, parse(ts, text), EVENTS_EXPORT);
  if (literal === null) return { events: null, problems: [`it exports no ${EVENTS_EXPORT} table`] };
  const events = {};
  for (const [name, value] of entriesOf(ts, literal, EVENTS_EXPORT, problems)) {
    const fields = Object.fromEntries(entriesOf(ts, value, `${EVENTS_EXPORT}.${name}`, problems));
    const version = fields.version === undefined ? null : integerOf(ts, fields.version);
    if (version === null) problems.push(`${EVENTS_EXPORT}.${name} needs a positive integer \`version\``);
    const payload = {};
    if (fields.payload === undefined) problems.push(`${EVENTS_EXPORT}.${name} needs a \`payload\` table`);
    else {
      for (const [field, type] of entriesOf(ts, fields.payload, `${EVENTS_EXPORT}.${name}.payload`, problems)) {
        const declared = stringOf(ts, type);
        if (declared === null || !FIELD_TYPE.test(declared)) problems.push(`${EVENTS_EXPORT}.${name}.payload.${field} must be one of string, number, boolean, string[], number[] (a trailing ? marks it optional)`);
        else payload[field] = declared;
      }
    }
    let compensates = null;
    if (fields.compensates !== undefined) {
      compensates = stringOf(ts, fields.compensates);
      if (compensates === null || compensates === '') problems.push(`${EVENTS_EXPORT}.${name}.compensates must be the name of the event it compensates`);
    }
    if (version !== null) events[name] = { version, payload, ...(compensates ? { compensates } : {}) };
  }
  return { events, problems };
}

/** What a consumer declares: `{ consumes: { <service>: { <event>: <version> } }, problems }`; `consumes` is null without the export. */
export function readConsumes(ts, text) {
  const problems = [];
  const literal = exportedLiteral(ts, parse(ts, text), CONSUMES_EXPORT);
  if (literal === null) return { consumes: null, problems: [`it exports no ${CONSUMES_EXPORT} table`] };
  const consumes = {};
  for (const [service, events] of entriesOf(ts, literal, CONSUMES_EXPORT, problems)) {
    consumes[service] = {};
    for (const [event, version] of entriesOf(ts, events, `${CONSUMES_EXPORT}.${service}`, problems)) {
      const declared = integerOf(ts, version);
      if (declared === null) problems.push(`${CONSUMES_EXPORT}.${service}["${event}"] must be a positive integer version`);
      else consumes[service][event] = declared;
    }
  }
  return { consumes, problems };
}

/** The sorted object: keys in code-point order, recursively (what the snapshot prints). */
const sorted = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value);

/** The text of the snapshot of a provider: 2-space JSON, sorted keys, one final newline. */
export const snapshotText = (service, events) => `${JSON.stringify(sorted({ schema: EVENT_CONTRACT_SCHEMA, service, events }), null, 2)}\n`;

/** The snapshot's text with line endings folded, for comparing a committed file to a fresh one. */
export const folded = (text) => text.replace(/\r\n/g, '\n');
