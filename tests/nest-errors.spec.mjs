import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestErrors, NEST_ERROR_RULES } from '../checks/code-patterns/nest-errors.mjs';
import { defaultScriptChecker } from '../scripts/check-scoped-lint.mjs';

const require = createRequire(import.meta.url);
const typescriptRoot = path.dirname(require.resolve('typescript/package.json'));
const installedNestRoot = path.dirname(require.resolve('@nestjs/common/package.json'));
const errorSource = `export class AppError extends Error {
  readonly code = 'APP_ERROR';
  readonly httpStatus?: number;
  constructor(readonly metadata: { originalError?: Error } = {}) { super('failed'); }
}`;
const filterSource = `import { ArgumentsHost, Catch as Handles, ExceptionFilter as Filter } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error';
@Handles(AppError)
export class AppErrorFilter implements Filter {
  catch(exception: AppError, host: ArgumentsHost): void {
    if (host.getType<string>() === 'graphql') throw exception;
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.httpStatus ?? 500;
    response.status(status).json({ statusCode: status, code: exception.code, message: exception.message });
  }
}`;
const causeSource = `import { AppError } from './app-error';
export function load(): void {
  try { JSON.parse('x'); } catch (error) {
    throw new AppError({ originalError: error instanceof Error ? error : new Error(String(error)) });
  }
}`;
const graphqlSource = `import { GraphQLModule as Gql } from '@nestjs/graphql';
import { AppError } from './app-error';
const httpStatusPlugin = {
  async requestDidStart() { return { async willSendResponse(ctx: any) {
    const statuses = ctx.response.body.singleResult.errors.map((error: any) => error.extensions?.http?.status);
    ctx.response.http.status = Math.max(...statuses);
  } }; },
};
export class ApiModule {
  static register() {
    return Gql.forRoot({
      plugins: [httpStatusPlugin],
      formatError: (formatted: any, error: unknown) => {
        const original = (error as { originalError?: unknown }).originalError ?? error;
        if (original instanceof AppError) return { ...formatted, extensions: { ...formatted.extensions, code: original.code, http: { status: original.httpStatus ?? 500 } } };
        return { ...formatted, extensions: { ...formatted.extensions, http: { status: 500 } } };
      },
    });
  }
}`;

function contract(overrides = {}) {
  return {
    schema: 'starci/nest-transport-error-contract@1',
    errorTypes: [{ id: 'app', path: 'src/app-error.ts', export: 'AppError', codeProperty: 'code', messageProperty: 'message', causeProperties: ['originalError', 'cause'] }],
    transports: ['http'],
    mappers: [{ id: 'http', kind: 'nest-http-filter', path: 'src/app-error.filter.ts', export: 'AppErrorFilter', method: 'catch', errorType: 'app', status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, passthroughHostTypes: ['graphql'] }],
    ...overrides,
  };
}

function fixture(t, { contractValue = contract(), error = errorSource, filter = filterSource, cause = causeSource, extra = {}, realNest = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-errors-'));
  const write = (relative, value) => {
    const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('package.json', { private: true, starci: { codePatterns: { nest: { transportErrors: contractValue } } } });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', experimentalDecorators: true }, include: ['src/**/*.ts'] });
  write('src/app-error.ts', error); write('src/app-error.filter.ts', filter); write('src/load.ts', cause);
  if (!realNest) {
    write('node_modules/@nestjs/common/package.json', { name: '@nestjs/common', types: 'index.d.ts' });
    write('node_modules/@nestjs/common/index.d.ts', `export declare function Catch(...types: Function[]): ClassDecorator;
export interface ExceptionFilter { catch(exception: unknown, host: ArgumentsHost): void }
export interface ArgumentsHost { getType<T extends string>(): T; switchToHttp(): { getResponse<T>(): T } }`);
  } else {
    fs.mkdirSync(path.join(root, 'node_modules/@nestjs'), { recursive: true });
    fs.symlinkSync(installedNestRoot, path.join(root, 'node_modules/@nestjs/common'), 'junction');
    for (const dependency of ['rxjs']) fs.symlinkSync(path.dirname(require.resolve(`${dependency}/package.json`)), path.join(root, `node_modules/${dependency}`), 'junction');
  }
  write('node_modules/express/package.json', { name: 'express', types: 'index.d.ts' });
  write('node_modules/express/index.d.ts', 'export interface Response { status(value: number): Response; json(value: unknown): void }');
  for (const [relative, value] of Object.entries(extra)) write(relative, value);
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(typescriptRoot, path.join(root, 'node_modules/typescript'), 'junction');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.ts')).map(name => `src/${name}`).sort();
  return { root, write, files, input: { root, files, contextFiles: files, ruleIds: NEST_ERROR_RULES, architectureConfig: 'architecture.json' } };
}

test('renamed Nest imports, foreign cause normalization and HTTP field flow are checked', t => {
  const f = fixture(t), result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, [...NEST_ERROR_RULES].sort());
});

test('real installed Nest declarations preserve the framework identity checks', t => {
  const f = fixture(t, { realNest: true }), result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('public aggregate script routing invokes the isolated Nest error adapter', async t => {
  const f = fixture(t), result = await defaultScriptChecker('nest', f.input);
  assert.equal(result.schema, 'starci/code-pattern-script@1');
  assert.deepEqual(result.errors, []); assert.deepEqual(result.checkedRuleIds, [...NEST_ERROR_RULES].sort());
  await assert.rejects(() => defaultScriptChecker('nest', { ...f.input, ruleIds: ['NEST_FOREIGN_ERROR_CAUSE', 'NEST_ENV_ACCESS'] }), /cannot be mixed/);
});

test('replacement throws preserve the caught input through the declared cause property', t => {
  const f = fixture(t, { cause: causeSource.replace('error instanceof Error ? error : new Error(String(error))', 'undefined') });
  let result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.ruleId === 'NEST_FOREIGN_ERROR_CAUSE' && item.message.includes('cause property')));
  f.write('src/load.ts', causeSource.replace('error instanceof Error ? error : new Error(String(error))', 'normalize(error)').replace("export function load", "const normalize = (value: unknown): Error => new Error(String(value));\nexport function load"));
  result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.ruleId === 'NEST_FOREIGN_ERROR_CAUSE' && item.message.includes('dynamic')));
  f.write('src/load.ts', causeSource.replace('throw new AppError({ originalError: error instanceof Error ? error : new Error(String(error)) });',
    'const metadata = { originalError: error instanceof Error ? error : new Error(String(error)) }; throw new AppError(metadata);'));
  result = checkNestErrors(f.input);
  assert.ok(!result.errors.some(item => item.ruleId === 'NEST_FOREIGN_ERROR_CAUSE'));
  assert.ok(!result.violations.some(item => item.ruleId === 'NEST_FOREIGN_ERROR_CAUSE'));
});

test('same-error rethrows and recovery catches do not manufacture wrapper obligations', t => {
  const f = fixture(t, { cause: `export function load(): void { try { JSON.parse('x'); } catch (error) { if (error instanceof SyntaxError) throw error; } try { JSON.parse('x'); } catch { return; } }` });
  const result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('undeclared replacement families and computed replacement calls fail closed', t => {
  const f = fixture(t, { cause: `export function load(): void { try { JSON.parse('x'); } catch (error) { throw new Error(String(error)); } }` });
  let result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('declared error family')));
  f.write('src/load.ts', `declare function translate(value: unknown): Error; export function load(): void { try { JSON.parse('x'); } catch (error) { throw translate(error); } }`);
  result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('Dynamic replacement')));
});

test('transport-owned code map is accepted without adding HTTP status to the domain error', t => {
  const noStatus = errorSource.replace('  readonly httpStatus?: number;\n', '');
  const map = `export const STATUS_BY_CODE: Readonly<Record<string, number>> = { APP_ERROR: 409 };`;
  const filter = filterSource.replace("import { AppError } from './app-error';", "import { AppError } from './app-error';\nimport { STATUS_BY_CODE } from './status-map';")
    .replace('exception.httpStatus ?? 500', 'STATUS_BY_CODE[exception.code] ?? 500');
  const status = { kind: 'code-map', path: 'src/status-map.ts', export: 'STATUS_BY_CODE', fallback: 500 };
  const f = fixture(t, { error: noStatus, filter, extra: { 'src/status-map.ts': map }, contractValue: contract({ mappers: [{ ...contract().mappers[0], status }] }) });
  f.input.files = [...f.files]; f.input.contextFiles = [...f.input.files];
  const result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('wrong status/body flow is a finding rather than a presence-only pass', t => {
  const f = fixture(t, { filter: filterSource.replace('statusCode: status, code: exception.code', 'statusCode: 200, code: "LEAKED"') });
  const result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('derived status')));
  f.write('src/app-error.filter.ts', filterSource.replace(
    'response.status(status).json({ statusCode: status, code: exception.code, message: exception.message });',
    'response.status(status).json({ statusCode: status, code: exception.code, message: exception.message });\n    response.status(200).json({ statusCode: 200, code: "DECOY", message: exception.message });'));
  const mixed = checkNestErrors(f.input);
  assert.ok(mixed.violations.some(item => item.message.includes('derived status')));
});

test('uncalled nested writers and mutable status aliases cannot supply HTTP proof', t => {
  const nested = fixture(t, { filter: filterSource.replace(
    'response.status(status).json({ statusCode: status, code: exception.code, message: exception.message });',
    'const never = () => { response.status(status).json({ statusCode: status, code: exception.code, message: exception.message }); }; void never;') });
  assert.ok(checkNestErrors(nested.input).violations.some(item => item.message.includes('derived status')));
  const mutable = fixture(t, { filter: filterSource.replace('const status = exception.httpStatus ?? 500;', 'let status = exception.httpStatus ?? 500; status = 200;') });
  assert.ok(checkNestErrors(mutable.input).violations.some(item => item.message.includes('derived status')));
});

test('later object writes cannot overwrite a mapped HTTP field or preserved cause', t => {
  const responseSpread = fixture(t, { filter: filterSource.replace('message: exception.message });', 'message: exception.message, ...{ code: "WRONG" } });') });
  const responseResult = checkNestErrors(responseSpread.input);
  assert.ok(responseResult.errors.length || responseResult.violations.some(item => item.message.includes('derived status')));
  const causeSpread = fixture(t, { cause: causeSource.replace('new Error(String(error)) });', 'new Error(String(error)), ...{ originalError: undefined } });') });
  const result = checkNestErrors(causeSpread.input);
  assert.ok(result.errors.some(item => item.message.includes('dynamic')) || result.violations.some(item => item.message.includes('cause')));
});

test('every nested catch is checked for cause preservation', t => {
  const source = causeSource.replace("try { JSON.parse('x'); } catch (error) {", "try { JSON.parse('x'); } catch (error) { try { JSON.parse('x'); } catch (inner) { throw new AppError({}); }");
  const f = fixture(t, { cause: source }), result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.ruleId === 'NEST_FOREIGN_ERROR_CAUSE'));
});

test('a helper method cannot replace the real ExceptionFilter catch entry', t => {
  const filter = filterSource.replace('catch(exception:', 'map(exception:')
    .replace('export class AppErrorFilter implements Filter {', 'export class AppErrorFilter implements Filter { catch(exception: AppError, host: ArgumentsHost): void { void exception; void host; }');
  const f = fixture(t, { filter, contractValue: contract({ mappers: [{ ...contract().mappers[0], method: 'map' }] }) });
  assert.ok(checkNestErrors(f.input).errors.some(item => item.message.includes('framework catch entry')));
});

test('a typed fake HTTP response cannot satisfy the mapper data flow', t => {
  const fake = `const response = ({ status: () => ({ json: () => undefined }) } as unknown as Response);`;
  const f = fixture(t, { filter: filterSource.replace('const response = host.switchToHttp().getResponse<Response>();', fake) });
  const result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('derived status')));
});

test('a passthrough label unrelated to ArgumentsHost cannot satisfy the declared host branch', t => {
  const decoy = filterSource.replace("host.getType<string>() === 'graphql'", "host.getType<string>() === 'http' || 'graphql' === 'graphql'");
  const f = fixture(t, { filter: decoy }), result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('passthrough host graphql')));
});

test('discovered filters cannot be omitted from the declared mapper inventory', t => {
  const f = fixture(t, { contractValue: contract({ transports: [], mappers: [] }) });
  const result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('omitted') || item.message.includes('absent')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('a worker with no discovered HTTP or GraphQL surface needs no transport mapper', t => {
  const f = fixture(t, { contractValue: contract({ transports: [], mappers: [] }), filter: 'export const workerErrorBoundary = true;' });
  const result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('dynamic or incomplete Nest filter surfaces remain unavailable', t => {
  const f = fixture(t, { filter: filterSource.replace('@Handles(AppError)', 'const DynamicCatch = Handles;\n@DynamicCatch(AppError)') });
  const result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('dynamic') || item.message.includes('does not match')));
});

test('explicit Apollo formatter and status transport form a checked optional GraphQL pair', t => {
  const graphqlMapper = { id: 'graphql', kind: 'apollo-graphql', path: 'src/api.module.ts', export: 'ApiModule', method: 'register', errorType: 'app',
    status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, formatProperty: 'formatError', statusPlugin: 'httpStatusPlugin', originalErrorProperty: 'originalError' };
  const f = fixture(t, { contractValue: contract({ transports: ['http', 'graphql'], mappers: [...contract().mappers, graphqlMapper] }), extra: {
    'src/api.module.ts': graphqlSource,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('GraphQL status reads and writes must be one data-flow chain', t => {
  const graphqlMapper = { id: 'graphql', kind: 'apollo-graphql', path: 'src/api.module.ts', export: 'ApiModule', method: 'register', errorType: 'app',
    status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, formatProperty: 'formatError', statusPlugin: 'httpStatusPlugin', originalErrorProperty: 'originalError' };
  const broken = graphqlSource.replace('ctx.response.http.status = Math.max(...statuses);', 'ctx.response.http.status = 200;');
  const f = fixture(t, { contractValue: contract({ transports: ['http', 'graphql'], mappers: [...contract().mappers, graphqlMapper] }), extra: {
    'src/api.module.ts': broken,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('selected response error extensions')));
});

test('GraphQL decoy error data and fake response writes cannot satisfy the transport chain', t => {
  const graphqlMapper = { id: 'graphql', kind: 'apollo-graphql', path: 'src/api.module.ts', export: 'ApiModule', method: 'register', errorType: 'app',
    status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, formatProperty: 'formatError', statusPlugin: 'httpStatusPlugin', originalErrorProperty: 'originalError' };
  const broken = graphqlSource.replace(
    'const statuses = ctx.response.body.singleResult.errors.map((error: any) => error.extensions?.http?.status);\n    ctx.response.http.status = Math.max(...statuses);',
    'const statuses = [{ extensions: { http: { status: 418 } } }].map((error: any) => error.extensions?.http?.status);\n    const fake = { http: { status: 0 } };\n    fake.http.status = Math.max(...statuses);');
  const f = fixture(t, { contractValue: contract({ transports: ['http', 'graphql'], mappers: [...contract().mappers, graphqlMapper] }), extra: {
    'src/api.module.ts': broken,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('selected response error extensions')));
});

test('one valid GraphQL transport write cannot conceal a second hard-coded write', t => {
  const graphqlMapper = { id: 'graphql', kind: 'apollo-graphql', path: 'src/api.module.ts', export: 'ApiModule', method: 'register', errorType: 'app',
    status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, formatProperty: 'formatError', statusPlugin: 'httpStatusPlugin', originalErrorProperty: 'originalError' };
  const broken = graphqlSource.replace('ctx.response.http.status = Math.max(...statuses);', 'ctx.response.http.status = Math.max(...statuses);\n    ctx.response.http.status = 200;');
  const f = fixture(t, { contractValue: contract({ transports: ['http', 'graphql'], mappers: [...contract().mappers, graphqlMapper] }), extra: {
    'src/api.module.ts': broken,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.ok(result.violations.some(item => item.message.includes('every transport response status write')));
});

test('a declared GraphQL status plugin must be installed on the selected boundary', t => {
  const graphqlMapper = { id: 'graphql', kind: 'apollo-graphql', path: 'src/api.module.ts', export: 'ApiModule', method: 'register', errorType: 'app',
    status: { kind: 'error-property', property: 'httpStatus', fallback: 500 }, formatProperty: 'formatError', statusPlugin: 'httpStatusPlugin', originalErrorProperty: 'originalError' };
  const withoutPlugin = graphqlSource.replace('plugins: [httpStatusPlugin],', 'plugins: [],');
  const f = fixture(t, { contractValue: contract({ transports: ['http', 'graphql'], mappers: [...contract().mappers, graphqlMapper] }), extra: {
    'src/api.module.ts': withoutPlugin,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('explicitly installed')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('discovered GraphQL boundary cannot be hidden by an HTTP-only declaration', t => {
  const f = fixture(t, { extra: {
    'src/api.module.ts': graphqlSource,
    'node_modules/@nestjs/graphql/package.json': { name: '@nestjs/graphql', types: 'index.d.ts' },
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare class GraphQLModule { static forRoot<T>(options: T): unknown }',
  } });
  const result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('omitted') || item.message.includes('absent')));
});

test('nested replacement functions are unavailable rather than silently credited', t => {
  const f = fixture(t, { cause: `import { AppError } from './app-error'; export function load(): void { try { JSON.parse('x'); } catch (error) { const later = () => { throw new AppError({ originalError: error as Error }); }; later(); } }` });
  const result = checkNestErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('Nested-function')));
});

test('malformed contracts, unbound identities and unsupported rule IDs fail closed', t => {
  const f = fixture(t);
  assert.ok(checkNestErrors({ ...f.input, files: f.files.filter(file => file !== 'src/app-error.ts'), contextFiles: f.files.filter(file => file !== 'src/app-error.ts') }).errors.length);
  assert.ok(checkNestErrors({ ...f.input, ruleIds: ['UNKNOWN'] }).errors.length);
  f.write('package.json', { private: true, starci: { codePatterns: { nest: { transportErrors: { ...contract(), schema: 'wrong' } } } } });
  assert.ok(checkNestErrors(f.input).errors.length);
});
