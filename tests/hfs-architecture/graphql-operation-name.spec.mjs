// proves: BE_SOURCE_FORM@lite BE_SOURCE_FORM@full
import assert from 'node:assert/strict';
import test from 'node:test';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';

const RESOLVER = 'src/features/api/operations/transport/graphql/operations.resolver.ts';
const RETRY_RESOLVER = 'src/features/api/operations/transport/graphql/retry-failed-step.resolver.ts';
const SUBSCRIPTION = 'src/features/realtime/order-status/transport/graphql/order-status.subscription.ts';

function fixture(t, edition, files, fields = {}) {
  const declaration = appDeclaration('be', { apps: [{ name: 'core', kind: 'api' }], ...fields });
  declaration.edition = edition;
  if (edition === 'lite') declaration.sides.be.connections = [
    { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' },
  ];
  return archFixture(t, { profile: 'be', files: {
    '../hfs.json': `${JSON.stringify(declaration)}\n`,
    '../node_modules/@nestjs/graphql/package.json': JSON.stringify({ name: '@nestjs/graphql', types: 'index.d.ts' }),
    '../node_modules/@nestjs/graphql/index.d.ts': [
      'export declare function Query(...args: unknown[]): MethodDecorator;',
      'export declare function Mutation(...args: unknown[]): MethodDecorator;',
      'export declare function Subscription(...args: unknown[]): MethodDecorator;',
    ].join('\n'),
    'src/modules/platform/framework/index.ts': 'export { Query as Read, Mutation as Write, Subscription as Watch } from "@nestjs/graphql";\n',
    ...files,
  } });
}

for (const edition of ['lite', 'full']) {
  test(`BE_SOURCE_FORM: ${edition} GraphQL operation names equal their methods through import and const aliases`, t => {
    const report = runArch(fixture(t, edition, {
      [RESOLVER]: `import { Query, Mutation, Subscription } from "@nestjs/graphql";
import { Read, Write, Watch } from "../../../../../modules/platform/framework";
const SelectedRead = Read;
const SelectedWrite = Write;
const SelectedWatch = Watch;
export class OperationsResolver {
  @Query(() => String, { name: "readOrder" }) readOrder() { return "order"; }
  @Mutation({ name: "createOrder" }) createOrder() { return "order"; }
  @Subscription(() => String, { name: "watchOrder" }) watchOrder() { return "order"; }
  @SelectedRead({ name: "readNext" }) readNext() { return "order"; }
  @SelectedWrite({ name: "createNext" }) createNext() { return "order"; }
  @SelectedWatch({ name: "watchNext" }) watchNext() { return "order"; }
  @Query(() => String) readImplicit() { return "order"; }
  @Mutation(() => String) createImplicit() { return "order"; }
  @Subscription(() => String) watchImplicit() { return "order"; }
}\n`,
    }));
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    assert.deepEqual(findings(report, 'BE_SOURCE_FORM'), [], JSON.stringify(report.violations));
    assert.equal(report.coverage.backendSourceShape.naming.status, 'checked');
    assert.ok(report.coverage.checkedRuleIds.includes('BE_SOURCE_FORM'));
  });

  test(`BE_SOURCE_FORM: ${edition} refuses the nivo retry-failed-step mismatch and aliased Query and Subscription names`, t => {
    const report = runArch(fixture(t, edition, {
      [RETRY_RESOLVER]: `import { Mutation } from "@nestjs/graphql";
export class RetryFailedStepResolver {
  @Mutation(() => String, { name: "retryFailedStep" })
  reopenFailedStep() { return "retried"; }
}\n`,
      [RESOLVER]: `import * as Graphql from "@nestjs/graphql";
import { Read, Watch } from "../../../../../modules/platform/framework";
const SelectedRead = Read;
const SelectedWatch = Watch;
export class OperationsResolver {
  @SelectedRead(() => String, { name: "readOrder" }) findOrder() { return "order"; }
  @SelectedWatch(() => String, { name: "watchOrder" }) observeOrder() { return "order"; }
  @Graphql.Subscription({ name: "watchNext" }) observeNext() { return "order"; }
}\n`,
    }));
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    const refused = findings(report, 'BE_SOURCE_FORM');
    assert.equal(refused.length, 4, JSON.stringify(refused));
    for (const [operation, method] of [
      ['retryFailedStep', 'reopenFailedStep'], ['readOrder', 'findOrder'],
      ['watchOrder', 'observeOrder'], ['watchNext', 'observeNext'],
    ]) assert.ok(refused.some(item => item.message.includes(`field name ${operation} must equal its method name ${method}`)), JSON.stringify(refused));
    assert.ok(refused.some(item => item.path === RETRY_RESOLVER && item.line === 3));
    assert.equal(report.coverage.backendSourceShape.naming.status, 'checked');
  });

  test(`BE_SOURCE_FORM: ${edition} keeps dynamic Subscription names unavailable and ignores a local decorator with the same name`, t => {
    const report = runArch(fixture(t, edition, {
      [RESOLVER]: `import { Watch } from "../../../../../modules/platform/framework";
const fieldName = "watchOrder";
const Mutation = (...args: unknown[]): MethodDecorator => () => {};
export class OperationsResolver {
  @Watch(() => String, { name: fieldName }) watchOrder() { return "order"; }
  @Mutation({ name: "customName" }) localMethod() { return "order"; }
}\n`,
    }));
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    assert.deepEqual(findings(report, 'BE_SOURCE_FORM'), [], JSON.stringify(report.violations));
    assert.equal(report.coverage.backendSourceShape.naming.status, 'unavailable');
    assert.ok(report.coverage.backendSourceShape.naming.details.some(item => item.includes('dynamic @Subscription field name')));
    assert.equal(report.coverage.checkedRuleIds.includes('BE_SOURCE_FORM'), false);
  });

  test(`BE_SOURCE_FORM: ${edition} accepts matching names at the canonical realtime Subscription home`, t => {
    const root = fixture(t, edition, {
      [SUBSCRIPTION]: `import { Watch } from "../../../../../modules/platform/framework";
const SelectedWatch = Watch;
const Subscription = (...args: unknown[]): MethodDecorator => () => {};
export class OrderStatusSubscription {
  @SelectedWatch(() => String, { name: "orderStatus" }) orderStatus() { return "ready"; }
  @Subscription({ name: "localName" }) localMethod() { return "ready"; }
}\n`,
    }, { patterns: ['realtime'] });
    const resolver = openHfs({ repoRoot: root });
    assert.equal(resolver.ownerOf(SUBSCRIPTION)?.slot, 'be.feature.realtime');
    assert.equal(resolver.classifyPath(SUBSCRIPTION).slot, 'be.feature.realtime.graphql');
    const report = runArch(root);
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    assert.deepEqual(findings(report, 'BE_SOURCE_FORM'), [], JSON.stringify(report.violations));
    assert.equal(report.coverage.backendSourceShape.naming.status, 'checked');
  });

  test(`BE_SOURCE_FORM: ${edition} refuses an aliased name mismatch at the canonical realtime Subscription home`, t => {
    const report = runArch(fixture(t, edition, {
      [SUBSCRIPTION]: `import { Watch } from "../../../../../modules/platform/framework";
const SelectedWatch = Watch;
export class OrderStatusSubscription {
  @SelectedWatch(() => String, { name: "orderStatus" }) streamOrderStatus() { return "ready"; }
}\n`,
    }, { patterns: ['realtime'] }));
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    const refused = findings(report, 'BE_SOURCE_FORM');
    assert.equal(refused.length, 1, JSON.stringify(refused));
    assert.equal(refused[0].path, SUBSCRIPTION);
    assert.match(refused[0].message, /@Subscription field name orderStatus must equal its method name streamOrderStatus/);
    assert.equal(report.coverage.backendSourceShape.naming.status, 'checked');
  });

  test(`BE_SOURCE_FORM: ${edition} cannot prove a mutable decorator at the canonical realtime Subscription home`, t => {
    const report = runArch(fixture(t, edition, {
      [SUBSCRIPTION]: `import { Watch } from "../../../../../modules/platform/framework";
let SelectedWatch = Watch;
export class OrderStatusSubscription {
  @SelectedWatch(() => String, { name: "orderStatus" }) orderStatus() { return "ready"; }
}\n`,
    }, { patterns: ['realtime'] }));
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors));
    assert.equal(report.coverage.backendSourceShape.naming.status, 'unavailable');
    assert.ok(report.coverage.backendSourceShape.naming.details.some(item => item.includes('mutable or constructed Subscription decorator identity')));
    assert.equal(report.coverage.checkedRuleIds.includes('BE_SOURCE_FORM'), false);
  });
}
