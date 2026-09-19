import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestErrorIdentity, NEST_ERROR_IDENTITY_RULES } from '../scripts/checks/code-patterns/nest-error-identity.mjs';

const require = createRequire(import.meta.url);
const typescriptRoot = path.dirname(require.resolve('typescript/package.json'));
const installedNestRoot = path.dirname(require.resolve('@nestjs/common/package.json'));

const capabilityBase = `export class CapabilityError extends Error {
  readonly code = 'CAPABILITY_ERROR';
  constructor(readonly metadata: { cause?: unknown } = {}) { super('failed'); }
}`;
const capabilityChild = `import { CapabilityError } from './capability-error';
export class WidgetError extends CapabilityError {}`;
const capabilityUse = `import * as Failures from './errors/widget-error';
export function execute(): never { throw new Failures.WidgetError({}); }
export function replay(): never { try { JSON.parse('x'); } catch (error) { const same = error; throw same; } }
export function disposition(): { status: 'refused' } { return { status: 'refused' }; }`;

function capabilityContract(overrides = {}) {
  return {
    schema: 'starci/nest-error-identity@1',
    profile: 'capability',
    throwRoots: ['src'],
    families: [{ id: 'capability', path: 'src/errors/capability-error.ts', export: 'CapabilityError', declarationRoots: ['src/errors'], codeProperty: 'code', causeProperties: ['cause'] }],
    ...overrides,
  };
}

function academyContract(overrides = {}) {
  return {
    schema: 'starci/nest-error-identity@1',
    profile: 'academy-abstract-exception',
    throwRoots: ['src'],
    families: [{ id: 'academy', path: 'src/errors/abstract.ts', export: 'AbstractException', declarationRoots: ['src/errors'], codeProperty: 'code', causeProperties: ['originalError'],
      academy: { classSuffix: 'Exception', codeArgument: 1, metadataArgument: 2 } }],
    ...overrides,
  };
}

const academyBase = `export interface AbstractExceptionMetadata { originalError?: unknown }
export class AbstractException extends Error {
  readonly code: string;
  constructor(message: string, code: string, readonly metadata: AbstractExceptionMetadata) { super(message); this.code = code; }
}`;
const academyChild = `import { AbstractException, AbstractExceptionMetadata } from './abstract';
export interface UserMissingExceptionMetadata extends AbstractExceptionMetadata { id?: string }
export class UserMissingException extends AbstractException {
  constructor({ id, originalError }: UserMissingExceptionMetadata) {
    super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });
  }
}`;
const academyUse = `import * as Failures from './errors/user-missing';
export function execute(): never { throw new Failures.UserMissingException({}); }`;

function walkSources(root, relative = 'src') {
  const output = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) output.push(...walkSources(root, child));
    else if (/\.(?:[cm]?ts|tsx)$/.test(entry.name) && !/\.d\.[cm]?ts$/.test(entry.name)) output.push(child);
  }
  return output.sort();
}

function fixture(t, { profile = 'capability', contractValue, sources = {}, realNest = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-error-identity-'));
  const write = (relative, value) => {
    const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const values = profile === 'academy-abstract-exception'
    ? { 'src/errors/abstract.ts': academyBase, 'src/errors/user-missing.ts': academyChild, 'src/use.ts': academyUse }
    : { 'src/errors/capability-error.ts': capabilityBase, 'src/errors/widget-error.ts': capabilityChild, 'src/use.ts': capabilityUse };
  for (const [relative, value] of Object.entries({ ...values, ...sources })) write(relative, value);
  write('package.json', { private: true, starci: { codePatterns: { nest: { errorIdentity: contractValue ?? (profile === 'academy-abstract-exception' ? academyContract() : capabilityContract()) } } } });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true }, include: ['src/**/*.ts'] });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(typescriptRoot, path.join(root, 'node_modules/typescript'), 'junction');
  if (realNest) {
    fs.mkdirSync(path.join(root, 'node_modules/@nestjs'), { recursive: true });
    fs.symlinkSync(installedNestRoot, path.join(root, 'node_modules/@nestjs/common'), 'junction');
    fs.symlinkSync(path.dirname(require.resolve('rxjs/package.json')), path.join(root, 'node_modules/rxjs'), 'junction');
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = walkSources(root);
  return { root, write, files, input: { root, files, ruleIds: NEST_ERROR_IDENTITY_RULES, architectureConfig: 'architecture.json' } };
}

test('capability profile resolves namespace aliases, const constructions, unchanged rethrows and typed dispositions', t => {
  const f = fixture(t), result = checkNestErrorIdentity(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, [...NEST_ERROR_IDENTITY_RULES].sort());
  f.write('src/use.ts', capabilityUse.replace('throw new Failures.WidgetError({});', 'const failure = new Failures.WidgetError({}); throw failure;'));
  assert.deepEqual(checkNestErrorIdentity(f.input).violations, []);
});

test('selected family must extend the actual standard Error identity', t => {
  const f = fixture(t, { sources: { 'src/errors/capability-error.ts': `class Error {}
export class CapabilityError extends Error { readonly code = 'FAKE'; }` } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('standard Error identity')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('throw roots inventory every selected production source', t => {
  const contract = capabilityContract({ throwRoots: ['src/errors'] });
  const f = fixture(t, { contractValue: contract }), result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('outside the complete throw-root inventory')));
});

test('an explicit health-probe allowance resolves the actual selected Nest HTTP exception export', t => {
  const health = `import * as Nest from '@nestjs/common';
export function readiness(ready: boolean): void { if (!ready) throw new Nest.ServiceUnavailableException(); }`;
  const contract = capabilityContract({ throwAllowances: [{ path: 'src/health.ts', purpose: 'health-probe', identities: [{ module: '@nestjs/common', export: 'ServiceUnavailableException' }] }] });
  const f = fixture(t, { realNest: true, contractValue: contract, sources: { 'src/health.ts': health } });
  let result = checkNestErrorIdentity(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);

  f.write('package.json', { private: true, starci: { codePatterns: { nest: { errorIdentity: capabilityContract() } } } });
  result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.path === 'src/health.ts' && item.message.includes('selected error family')));
});

test('health-probe allowances reject path aliases, lookalikes and noncanonical modules', t => {
  const health = `import { ServiceUnavailableException } from '@nestjs/common';
export function readiness(): never { throw new ServiceUnavailableException(); }`;
  const allowance = [{ path: 'src/health.ts', purpose: 'health-probe', identities: [{ module: '@nestjs/common', export: 'ServiceUnavailableException' }] }];
  const f = fixture(t, { realNest: true, contractValue: capabilityContract({ throwAllowances: allowance }), sources: {
    'src/health.ts': health,
    'src/fake-nest.ts': `export class HttpException extends Error {}\nexport class ServiceUnavailableException extends HttpException {}`,
  } });
  f.write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
    baseUrl: '.', paths: { '@nestjs/common': ['src/fake-nest.ts'] } }, include: ['src/**/*.ts'] });
  let result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.path === 'src/health.ts'));

  const invalid = capabilityContract({ throwAllowances: [{ path: 'src/health.ts', purpose: 'health-probe', identities: [{ module: '@custom/http', export: 'ServiceUnavailableException' }] }] });
  f.write('package.json', { private: true, starci: { codePatterns: { nest: { errorIdentity: invalid } } } });
  result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('@nestjs/common')));
});

test('unused health-probe allowance identities cannot remain stale proof', t => {
  const contract = capabilityContract({ throwAllowances: [{ path: 'src/use.ts', purpose: 'health-probe', identities: [{ module: '@nestjs/common', export: 'ServiceUnavailableException' }] }] });
  const f = fixture(t, { realNest: true, contractValue: contract }), result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('not matched by an escaping')));
});

test('bare and framework-shaped error constructions are findings while dynamic factories are unavailable', t => {
  const f = fixture(t, { sources: { 'src/use.ts': `import { WidgetError } from './errors/widget-error';
declare function factory(): WidgetError;
export function bare(): never { throw new Error('bare'); }
export function dynamic(): never { throw factory(); }` } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('selected error family')));
  assert.ok(result.errors.some(item => item.message.includes('Dynamic thrown value')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('a type assertion cannot turn the actual Error constructor into a selected family', t => {
  const f = fixture(t, { sources: { 'src/use.ts': `import { WidgetError } from './errors/widget-error';
export function execute(): never { throw new (Error as unknown as typeof WidgetError)({}); }` } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('selected error family')), JSON.stringify(result));
});

test('reassigned caught identities and aliases do not receive rethrow credit', t => {
  const f = fixture(t, { sources: { 'src/use.ts': `import { WidgetError } from './errors/widget-error';
export function direct(): never { try { JSON.parse('x'); } catch (error) { error = new WidgetError({}); throw error; } }
export function alias(): never { try { JSON.parse('x'); } catch (error) { error = new WidgetError({}); const same = error; throw same; } }` } });
  const result = checkNestErrorIdentity(f.input);
  assert.equal(result.errors.filter(item => item.message.includes('Dynamic thrown value')).length, 2, JSON.stringify(result));
});

test('mutating a property does not replace the caught object identity', t => {
  const f = fixture(t, { sources: { 'src/use.ts': `export function execute(): never {
  try { JSON.parse('x'); } catch (error) { if (error instanceof Error) error.name = 'renamed'; throw error; }
}` } });
  const result = checkNestErrorIdentity(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('an illegally reassigned const construction cannot supply selected throw identity', t => {
  const f = fixture(t, { sources: { 'src/use.ts': `import { WidgetError } from './errors/widget-error';
export function execute(): never { const failure = new WidgetError({}); failure = new Error('changed') as never; throw failure; }` } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('Dynamic thrown value')));
});

test('Academy profile proves named metadata, inheritance, literal code, direct super flow and object construction', t => {
  const f = fixture(t, { profile: 'academy-abstract-exception' }), result = checkNestErrorIdentity(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('Academy metadata must be the earlier exported class-named interface', t => {
  const bad = academyChild.replace('export interface UserMissingExceptionMetadata extends AbstractExceptionMetadata', 'interface OtherMetadata extends AbstractExceptionMetadata')
    .replace('UserMissingExceptionMetadata)', 'OtherMetadata)');
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('earlier exported UserMissingExceptionMetadata')));
});

test('Academy direct constructor flow cannot be supplied by an uncalled helper', t => {
  const bad = academyChild.replace("super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });",
    "const metadata = () => ({ id, originalError }); super('User missing', 'USER_MISSING_EXCEPTION', metadata());");
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('directly supplies')));
});

test('a nested class super call cannot supply the Academy constructor proof', t => {
  const bad = academyChild.replace("super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });",
    "class Hidden extends AbstractException { constructor() { super('hidden', 'HIDDEN_EXCEPTION', {}); } } void Hidden;");
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('directly supplies')));
});

test('a conditional super call cannot supply mandatory Academy constructor flow', t => {
  const bad = academyChild.replace("super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });",
    "if (false) super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });");
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('directly supplies')));
});

test('Academy super reachability handles constant, terminating and unknown preceding branches', t => {
  const unknown = academyChild.replace('constructor({ id, originalError }: UserMissingExceptionMetadata) {',
    'constructor({ id, originalError }: UserMissingExceptionMetadata) { const flag = Date.now() > 0; if (flag) return;');
  let f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': unknown } });
  let result = checkNestErrorIdentity(f.input);
  assert.ok(result.errors.some(item => item.message.includes('control flow before direct super')));

  const terminated = academyChild.replace('constructor({ id, originalError }: UserMissingExceptionMetadata) {',
    "constructor({ id, originalError }: UserMissingExceptionMetadata) { const flag = Date.now() > 0; if (flag) throw new Error('x'); else return;");
  f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': terminated } });
  result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('directly supplies')));

  const constant = academyChild.replace('constructor({ id, originalError }: UserMissingExceptionMetadata) {',
    "constructor({ id, originalError }: UserMissingExceptionMetadata) { if (false) throw new Error('x');");
  f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': constant } });
  result = checkNestErrorIdentity(f.input);
  assert.ok(!result.errors.some(item => item.ruleId === 'NEST_ERROR_DECLARATION_IDENTITY'));
  assert.ok(!result.violations.some(item => item.ruleId === 'NEST_ERROR_DECLARATION_IDENTITY'));
});

test('Academy constructor sites require one object literal and codes stay unique', t => {
  const duplicate = academyChild;
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: {
    'src/errors/another.ts': duplicate,
    'src/use.ts': academyUse.replace('new Failures.UserMissingException({})', 'new Failures.UserMissingException(undefined as never)'),
  } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('duplicated')));
  assert.ok(result.violations.some(item => item.message.includes('exactly one object-literal')));
});

test('Academy code is derived exactly from the owning class', t => {
  const bad = academyChild.replace('USER_MISSING_EXCEPTION', 'UNRELATED_CODE');
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('must be USER_MISSING_EXCEPTION')));
});

test('Academy subclasses cannot override the selected base code property', t => {
  const bad = academyChild.replace('export class UserMissingException extends AbstractException {',
    "export class UserMissingException extends AbstractException { readonly code = 'OVERRIDE';");
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: { 'src/errors/user-missing.ts': bad } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('instead of overriding')));
});

test('Academy-named declarations cannot extend a different base or escape declared roots', t => {
  const f = fixture(t, { profile: 'academy-abstract-exception', sources: {
    'src/rogue.ts': `export class RogueException extends Error {}`,
  } });
  const result = checkNestErrorIdentity(f.input);
  assert.ok(result.violations.some(item => item.message.includes('selected hierarchy base')));
});

test('missing contracts, malformed roots and unsupported rules fail closed', t => {
  const f = fixture(t);
  f.write('package.json', { private: true });
  assert.ok(checkNestErrorIdentity(f.input).errors.length);
  f.write('package.json', { private: true, starci: { codePatterns: { nest: { errorIdentity: capabilityContract({ throwRoots: [] }) } } } });
  assert.ok(checkNestErrorIdentity(f.input).errors.length);
  const academy = fixture(t, { profile: 'academy-abstract-exception' });
  academy.write('package.json', { private: true, starci: { codePatterns: { nest: { errorIdentity: academyContract({ families: [{ ...academyContract().families[0], academy: { classSuffix: 'Failure', codeArgument: 0, metadataArgument: 1 } }] }) } } } });
  assert.ok(checkNestErrorIdentity(academy.input).errors.some(item => item.message.includes('Academy profile fixes')));
  assert.ok(checkNestErrorIdentity({ ...f.input, ruleIds: ['UNKNOWN'] }).errors.length);
});
