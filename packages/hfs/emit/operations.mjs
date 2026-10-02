/**
 * The versioned operations of an api app, read from its typed operation table and printed as OpenAPI 3.1.
 *
 * The table is the canon's one declaration of an app's operation surface (knowledge/patterns/be/api.yaml, BE-OPERATIONS-1):
 * `apps/<app>/src/operations.ts` exports `OPERATIONS`, made by `defineOperations({ "<id>@<version>": operation<Input, Output,
 * RefusalCode>("query" | "mutation") })`. The types come from the TypeScript checker; nothing is executed. An input, an output or a
 * refusal set the checker cannot express (`any`, `unknown`, `Record<string, unknown>`, an unbound generic, `string` as a refusal code)
 * is an error naming the operation.
 *
 * The wire is one route, `POST /operations`: the body is `{ operation, requestId, input }` and the answer is `{ operation, requestId,
 * outcome }`, `outcome` being `{ kind: "ok", value }` or `{ kind: "refused", code, params? }`. Each operation contributes one request
 * and one reply component carrying `x-operation: "<id>@<version>"`; the route's body and answer are the oneOf over them.
 */
import { createSchemaBuilder, stable } from './type-schema.mjs';

/** The export of `apps/<app>/src/operations.ts` that holds the table. */
const OPERATIONS_EXPORT = 'OPERATIONS';

/** The repository-relative path of an app's operation table. */
export const operationsPath = (app) => `apps/${app}/src/operations.ts`;

/** The repository-relative path of an app's OpenAPI contract. */
export const openapiPath = (app) => `contracts/${app}/openapi.json`;

const ID = /^[a-z][A-Za-z0-9.]*@[1-9][0-9]*$/;

/** The component name stem of an operation id: `sales.policy@1` gives `sales.policy.v1`. */
const stemOf = (id) => id.replace('@', '.v');

/**
 * Reads the operation table of a source file of a program. Answers null when the file is not in the program; throws when it
 * exports no `OPERATIONS` or an operation is not decidable.
 */
export function readOperations({ ts, program, file }) {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(file);
  if (!sourceFile) return null;
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const exported = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.getName() === OPERATIONS_EXPORT) : null;
  if (!exported) throw new Error(`${file} does not export ${OPERATIONS_EXPORT}, the app's operation table`);
  const builder = createSchemaBuilder({ ts, checker });
  const table = checker.getTypeOfSymbol(exported);
  const operations = [];
  for (const prop of [...checker.getPropertiesOfType(table)].sort((a, b) => (a.getName() < b.getName() ? -1 : 1))) {
    const id = prop.getName();
    const fail = (why) => {
      throw new Error(`operation ${id}: ${why}`);
    };
    if (!ID.test(id)) fail('the key must be "<name>@<positive version>", for example "sales.policy@1"');
    const contract = checker.getTypeOfSymbol(prop);
    const kindType = contract.getProperty('kind') ? checker.getTypeOfSymbol(contract.getProperty('kind')) : null;
    const kind = kindType?.isStringLiteral() ? kindType.value : null;
    if (kind !== 'query' && kind !== 'mutation') fail('kind must be the literal "query" or "mutation"');
    const typesProp = contract.getProperty('types');
    if (!typesProp) fail('the value is not an OperationContract (it has no types member)');
    const typesType = checker.getNonNullableType(checker.getTypeOfSymbol(typesProp));
    const member = (name) => {
      const symbol = typesType.getProperty(name);
      if (!symbol) fail(`the contract has no ${name} type`);
      return checker.getTypeOfSymbol(symbol);
    };
    const guard = (label, type) => {
      try {
        return builder.schemaOf(type, label);
      } catch (error) {
        return fail(error.message);
      }
    };
    const input = guard('input', member('input'));
    const output = guard('output', member('output'));
    const refusalType = member('refusal');
    let refusal = [];
    if (!(refusalType.flags & ts.TypeFlags.Never)) {
      const members = refusalType.isUnion() ? refusalType.types : [refusalType];
      if (!members.every((each) => each.isStringLiteral())) fail(`refusal must be a closed union of string literals, found ${checker.typeToString(refusalType)}`);
      refusal = members.map((each) => each.value).sort();
    }
    operations.push({ id, kind, input, output, refusal });
  }
  if (operations.length === 0) throw new Error(`${file}: ${OPERATIONS_EXPORT} declares no operation`);
  return { operations, components: builder.components() };
}

/** The OpenAPI 3.1 document of an app's operations, as sorted-key JSON text with one final newline. */
export function openApiText({ app, operations, components }) {
  const schemas = { ...components };
  const requests = [];
  const replies = [];
  for (const operation of operations) {
    const stem = stemOf(operation.id);
    const okOutcome = { type: 'object', required: ['kind', 'value'], properties: { kind: { const: 'ok' }, value: operation.output } };
    const refusedOutcome = { type: 'object', required: ['code', 'kind'], properties: { code: { enum: operation.refusal, type: 'string' }, kind: { const: 'refused' }, params: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } } } };
    schemas[`Operation.${stem}.Request`] = {
      type: 'object',
      required: ['input', 'operation', 'requestId'],
      properties: { input: operation.input, operation: { const: operation.id }, requestId: { type: 'string', minLength: 1 } },
      'x-kind': operation.kind,
      'x-operation': operation.id,
    };
    schemas[`Operation.${stem}.Reply`] = {
      type: 'object',
      required: ['operation', 'outcome', 'requestId'],
      properties: { operation: { const: operation.id }, outcome: operation.refusal.length ? { oneOf: [okOutcome, refusedOutcome] } : okOutcome, requestId: { type: 'string' } },
      'x-kind': operation.kind,
      'x-operation': operation.id,
    };
    requests.push({ $ref: `#/components/schemas/Operation.${stem}.Request` });
    replies.push({ $ref: `#/components/schemas/Operation.${stem}.Reply` });
  }
  const document = {
    openapi: '3.1.0',
    info: { title: `${app} operations`, version: '1' },
    'x-operations': operations.map((operation) => ({ id: operation.id, kind: operation.kind })),
    paths: {
      '/operations': {
        post: {
          operationId: 'invokeOperation',
          requestBody: { required: true, content: { 'application/json': { schema: { oneOf: requests } } } },
          responses: { 200: { description: 'The reply of the invoked operation: its outcome is ok or a declared refusal.', content: { 'application/json': { schema: { oneOf: replies } } } } },
        },
      },
    },
    components: { schemas },
  };
  return `${JSON.stringify(stable(document), null, 2)}\n`;
}
