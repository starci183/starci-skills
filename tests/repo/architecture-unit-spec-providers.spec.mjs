import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R48 unit-spec-providers (BE_SPEC_QUALITY): the providers of Test.createTestingModule in a <name>.service.spec.ts equal the
// constructor dependencies of the service. R85 injection-token-exported (BE_RAW_INJECT): every Inject<Thing>() token a service
// uses is exported, so a spec can provide it.
const hits = report => findings(report, 'BE_SPEC_QUALITY');
const injectHits = report => findings(report, 'BE_RAW_INJECT');

const DECORATORS = [
  "declare function injector(token: unknown): unknown;",
  "export const CLOCK: unique symbol = Symbol('platform.clock');",
  "export const InjectClock = () => injector(CLOCK);",
  "export const CACHE: unique symbol = Symbol('integrations.cache');",
  "export const InjectCache = () => injector(CACHE);",
  '',
].join('\n');
const SERVICE = [
  "import { InjectCache, InjectClock } from './cart.decorators';",
  "import { PriceService } from './price.service';",
  'export class CartService {',
  '  constructor(@InjectClock() private readonly clock: object, @InjectCache() private readonly cache: object, private readonly prices: PriceService) {}',
  '}',
  '',
].join('\n');
const PRICE_SERVICE = 'export class PriceService {}\n';
const specOf = providers => [
  "import { Test } from '@nestjs/testing';",
  "import { CartService } from './cart.service';",
  "import { PriceService } from './price.service';",
  "import { CACHE as CACHE_TOKEN, CLOCK } from './cart.decorators';",
  "it('builds', async () => {",
  `  await Test.createTestingModule({ providers: [${providers}] }).compile();`,
  '});',
  '',
].join('\n');
const GOOD = 'CartService, { provide: CLOCK, useValue: {} }, { provide: CACHE_TOKEN, useValue: {} }, PriceService';
const run = (t, spec, files = {}) => runArch(archFixture(t, { files: {
  'src/modules/domain/cart/index.ts': "export { CartService } from './cart.service';\nexport { CLOCK, CACHE } from './cart.decorators';\n",
  'src/modules/domain/cart/cart.decorators.ts': DECORATORS,
  'src/modules/domain/cart/cart.service.ts': SERVICE,
  'src/modules/domain/cart/price.service.ts': PRICE_SERVICE,
  'src/modules/domain/cart/cart.service.spec.ts': spec,
  ...files,
} }));
const messages = report => hits(report).map(item => item.message);

test('BE_SPEC_QUALITY: providers equal to the constructor dependencies (token by exported name, alias included) raise nothing', t => {
  const report = run(t, specOf(GOOD));
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.unitSpecProviders.status, 'checked');
  assert.equal(report.coverage.hfsMachine.unitSpecProviders.specs, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_SPEC_QUALITY'));
});

test('BE_SPEC_QUALITY: an extra provider that is not a constructor dependency is a finding', t => {
  const found = messages(run(t, specOf(`${GOOD}, { provide: OTHER, useValue: {} }`)));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0], /OTHER is provided but is not a constructor dependency of CartService/);
});

test('BE_SPEC_QUALITY: a missing provider is a finding', t => {
  const found = messages(run(t, specOf('CartService, { provide: CLOCK, useValue: {} }, PriceService')));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0], /CACHE is a constructor dependency of CartService but is not provided/);
});

test('BE_SPEC_QUALITY: a spec without a createTestingModule providers array, or a provider that is not a class or { provide, useValue }, is a finding', t => {
  const none = messages(run(t, "import { CartService } from './cart.service';\nit('builds', () => { expect(new CartService()).toBeDefined(); });\n"));
  assert.equal(none.length, 1, JSON.stringify(none));
  assert.match(none[0], /never calls Test\.createTestingModule/);
  const shape = messages(run(t, specOf('CartService, { provide: CLOCK, useFactory: () => ({}) }, { provide: CACHE_TOKEN, useValue: {} }, PriceService')));
  assert.equal(shape.length, 1, JSON.stringify(shape));
  assert.match(shape[0], /a class or `\{ provide: TOKEN, useValue: double \}` and nothing else/);
  const noArray = messages(run(t, "import { Test } from '@nestjs/testing';\nit('builds', async () => { await Test.createTestingModule({}).compile(); });\n"));
  assert.match(noArray[0], /no literal `providers` array/);
});

test('BE_SPEC_QUALITY: a constructor dependency whose token cannot be resolved is a finding', t => {
  const found = messages(run(t, specOf(GOOD), { 'src/modules/domain/cart/cart.service.ts': SERVICE.replace('private readonly prices: PriceService', 'private readonly limit: number') }));
  assert.ok(found.some(message => /cannot be resolved to a token/.test(message)), JSON.stringify(found));
});

test('BE_RAW_INJECT: an Inject<Thing>() over an exported token raises nothing; the coverage counts the decorators', t => {
  const report = run(t, specOf(GOOD));
  assert.deepEqual(injectHits(report), [], JSON.stringify(injectHits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.injectionTokenExported.status, 'checked');
  assert.equal(report.coverage.hfsMachine.injectionTokenExported.decorators, 2);
});

test('BE_RAW_INJECT: a service injecting a private (non-exported) token is a finding on its decorator', t => {
  const report = run(t, specOf(GOOD), { 'src/modules/domain/cart/cart.decorators.ts': DECORATORS.replace('export const CLOCK', 'const CLOCK'), 'src/modules/domain/cart/index.ts': "export { CartService } from './cart.service';\n" });
  const found = injectHits(report).filter(item => item.decorator === 'InjectClock');
  assert.equal(found.length, 1, JSON.stringify(injectHits(report), null, 1));
  assert.equal(found[0].path, 'src/modules/domain/cart/cart.decorators.ts');
  assert.match(found[0].message, /CLOCK, which is not exported/);
});

// A1: a function-only subject is judged by its callable subset; constants, enums, re-exports and overload signatures beside it do not matter.
const MIXED = [
  "export const LIMIT = 5;",
  "export enum Kind { Short = 'short' }",
  "export { total } from './price.service';",
  'export function pad(value: string): string;',
  'export function pad(value: number): string;',
  'export function pad(value: string | number): string { return String(value).padStart(LIMIT, "0"); }',
  'export const shout = (value: string): string => value.toUpperCase();',
  '',
].join('\n');
const functionSpec = value => [
  "import { Test } from '@nestjs/testing';",
  "import { pad, shout } from './cart.service';",
  'const CART = Symbol("cart");',
  "it('pads', async () => {",
  `  const moduleRef = await Test.createTestingModule({ providers: [{ provide: CART, useValue: ${value} }] }).compile();`,
  '  const subject = moduleRef.get(CART);',
  "  expect(subject.pad(1)).toBe('00001');",
  '});',
  '',
].join('\n');

test('BE_SPEC_QUALITY: a function subject beside a constant, an enum, a re-export and an overload is satisfied by its callable functions only', t => {
  const found = messages(run(t, functionSpec('{ pad, shout }'), { 'src/modules/domain/cart/cart.service.ts': MIXED }));
  assert.deepEqual(found, [], JSON.stringify(found));
});

test('BE_SPEC_QUALITY: a function subject provider that leaves out a callable export, or invents one, is still a finding', t => {
  const missing = messages(run(t, functionSpec('{ pad }'), { 'src/modules/domain/cart/cart.service.ts': MIXED }));
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0], /function-only subject needs exactly one/);
  const handBuilt = messages(run(t, functionSpec('{ pad, shout: () => "" }'), { 'src/modules/domain/cart/cart.service.ts': MIXED }));
  assert.equal(handBuilt.length, 1, JSON.stringify(handBuilt));
});

// A2: an undecorated class without a constructor injection token is a value object; Nest never builds it, a spec may use `new`.
test('BE_SPEC_QUALITY: a value-object subject may be built with new, a decorated or token-injected subject may not', t => {
  const spec = "import { CartService } from './cart.service';\nit('builds', () => { expect(new CartService(1, 2)).toBeDefined(); });\n";
  const valueObject = 'export class CartService {\n  constructor(readonly from: number, readonly to: number) {}\n}\n';
  assert.deepEqual(messages(run(t, spec, { 'src/modules/domain/cart/cart.service.ts': valueObject })), []);
  const decorated = `declare function Injectable(): ClassDecorator;\n@Injectable()\n${valueObject}`;
  assert.equal(messages(run(t, spec, { 'src/modules/domain/cart/cart.service.ts': decorated })).length, 1);
  const tokened = "declare function Inject(token: string): ParameterDecorator;\nexport class CartService {\n  constructor(@Inject('FROM') readonly from: number) {}\n}\n";
  assert.equal(messages(run(t, spec, { 'src/modules/domain/cart/cart.service.ts': tokened })).length, 1);
});
