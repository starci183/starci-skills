// event-contract.mjs - the async contract between the services of one product (R166 HFS_EVENT_CONTRACT).
// The one source of the contract is the typed event classes of a service, `be/src/modules/events/<service>/<event>.event.ts`:
//   export interface OrderPlacedPayload { readonly orderId: string; readonly totalMinorUnits: number }
//   export class OrderPlacedEvent extends BaseEvent {
//     static readonly eventName = "order.placed"; static readonly version = 1
//     static readonly compensates = "order.placed"            // only an event that reports the failure of a step
//     static create(payload: OrderPlacedPayload): OrderPlacedEvent { ... }
//   }
// `starci app emit` writes `be/contracts/<service>/events.json` from them (name, version, compensates, and the payload fields of the
// interface `create` takes); `starci app check` compares the committed file with the same reader. Nothing is executed: both walk the TypeScript
// syntax tree. The functions take the `ts` module the caller loaded (the repository's own, else the runtime's); this file imports nothing.

const EVENT_CONTRACT_SCHEMA = 'starci/event-contract@1';
const FIELD_TYPE = /^(?:string|number|boolean|string\[\]|number\[\])\??$/;

const hasStatic = (ts, member) => member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword) === true;

/** The literal of a `static readonly <name> = <literal>` member: `{ text }` for a string, `{ number }` for an integer, or null. */
function staticLiteral(ts, member) {
  if (!ts.isPropertyDeclaration(member) || !hasStatic(ts, member) || !ts.isIdentifier(member.name) || member.initializer === undefined) return null;
  let value = member.initializer;
  while (ts.isAsExpression(value) || ts.isParenthesizedExpression(value)) value = value.expression;
  if (ts.isStringLiteralLike(value)) return { name: member.name.text, text: value.text };
  if (ts.isNumericLiteral(value) && Number.isInteger(Number(value.text))) return { name: member.name.text, number: Number(value.text) };
  return null;
}

/** The text of a type node when it is one of the wire field types (`string`, `number`, `boolean`, `string[]`, `number[]`), else null. */
function fieldType(ts, node) {
  if (node.kind === ts.SyntaxKind.StringKeyword) return 'string';
  if (node.kind === ts.SyntaxKind.NumberKeyword) return 'number';
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return 'boolean';
  if (ts.isArrayTypeNode(node)) {
    const element = fieldType(ts, node.elementType);
    return element === 'string' || element === 'number' ? `${element}[]` : null;
  }
  return null;
}

/** The payload fields of the interface or type literal named `typeName` in the file: `{ <field>: <type> }`, optional fields with a `?`. */
function payloadOf(ts, sourceFile, typeName, problems, where) {
  let members = null;
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === typeName) members = statement.members;
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName && ts.isTypeLiteralNode(statement.type)) members = statement.type.members;
  }
  if (members === null) {
    problems.push(`${where}: the payload type ${typeName} is not an interface or type literal of the file`);
    return {};
  }
  const payload = {};
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name) || member.type === undefined) {
      problems.push(`${where}: the payload ${typeName} holds a member that is not \`name: type\``);
      continue;
    }
    const type = fieldType(ts, member.type);
    const written = type === null ? null : `${type}${member.questionToken ? '?' : ''}`;
    if (written === null || !FIELD_TYPE.test(written)) problems.push(`${where}: payload field ${member.name.text} must be string, number, boolean, string[] or number[]`);
    else payload[member.name.text] = written;
  }
  return payload;
}

/**
 * The event classes of one source text: `{ events: [{ className, name, version, compensates, payload }], problems: [text] }`. A class is an event
 * when it declares `static readonly eventName`; `version` is required, `create(payload: <Interface>)` names the payload.
 */
export function readEventClasses(ts, text, file = 'event.ts') {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const events = [];
  const problems = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
    const literals = statement.members.map((member) => staticLiteral(ts, member)).filter((literal) => literal !== null);
    const name = literals.find((literal) => literal.name === 'eventName')?.text;
    if (name === undefined) continue;
    const className = statement.name.text;
    const version = literals.find((literal) => literal.name === 'version')?.number;
    const compensates = literals.find((literal) => literal.name === 'compensates')?.text;
    if (version === undefined || version < 1) problems.push(`${className} needs \`static readonly version\` as a positive integer`);
    const create = statement.members.find((member) => ts.isMethodDeclaration(member) && hasStatic(ts, member) && ts.isIdentifier(member.name) && member.name.text === 'create');
    const parameter = create?.parameters[0]?.type;
    if (parameter === undefined || !ts.isTypeReferenceNode(parameter) || !ts.isIdentifier(parameter.typeName)) {
      problems.push(`${className} needs \`static create(payload: <Interface>)\` naming its payload interface`);
      continue;
    }
    events.push({ className, name, version: version ?? 0, ...(compensates === undefined ? {} : { compensates }), payload: payloadOf(ts, sourceFile, parameter.typeName.text, problems, className) });
  }
  return { events, problems };
}

/** The sorted object: keys in code-point order, recursively (what the snapshot prints). */
const sorted = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value);

/** The text of the snapshot of a service from its event classes: 2-space JSON, sorted keys, one final newline. */
export function snapshotText(service, events) {
  const table = Object.fromEntries(events.map(({ name, version, compensates, payload }) => [name, { version, payload, ...(compensates === undefined ? {} : { compensates }) }]));
  return `${JSON.stringify(sorted({ schema: EVENT_CONTRACT_SCHEMA, service, events: table }), null, 2)}\n`;
}

/** The snapshot's text with line endings folded, for comparing a committed file to a fresh one. */
export const folded = (text) => text.replace(/\r\n/g, '\n');
