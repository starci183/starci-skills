import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkWorkSurfaces} from '../scripts/checks/check-work-surfaces.mjs';

/** Fixtures live on the repo's own drive, matching the other example-*.spec.mjs files' own reasoning. */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');
const CLAUDE_ROOT = path.resolve(import.meta.dirname, '..');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `surfaces-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** A two-repository tree: be owns .starciwork plus a controller, two graphql op dirs and two event
 * classes; fe owns three page routes. The records deliberately disagree with the code in every
 * direction - a done contract route nobody serves, a done ui-screen no route reaches, a done event
 * nothing emits - so each refused code has to prove it fires, and the honest neighbours (served and
 * declared, claimed ops, emitted events) have to prove they stay silent. */
function makeFixture() {
  const root = freshDir();
  const be = path.join(root, 'be');
  const fe = path.join(root, 'fe');
  const workRoot = path.join(be, '.starciwork');

  write(workRoot, 'workspace.yaml', 'repositories:\n  - {role: be, name: be}\n  - {role: fe, name: fe}\n');
  write(workRoot, 'features/f/contract/orders/index.yaml', [
    'schema: work/contract',
    'id: contract.f.orders',
    'state: done',
    'surface:',
    '  - name: ordersApi',
    '    shape: "GET /api/orders/:id -> {id, status}. The orderDetail GraphQL query composes the same read."',
    '',
  ].join('\n'));
  write(workRoot, 'features/f/contract/ghost/index.yaml', [
    'schema: work/contract',
    'id: contract.f.ghost',
    'state: done',
    'surface:',
    '  - name: ghostApi',
    '    shape: "POST /api/ghost -> {ok}. The vanishOp GraphQL mutation is expected."',
    '',
  ].join('\n'));
  write(workRoot, 'features/f/fr/orders/index.yaml',
    'schema: work/functional-requirement\nid: fr.f.orders\nstate: done\nmodule: src/features/f\n');
  write(workRoot, 'features/f/impl/be/orders/index.yaml', [
    'schema: work/implementation',
    'id: impl.f.be.orders',
    'state: done',
    'repository: be',
    'proves: [contract.f.orders, fr.f.orders]',
    '',
  ].join('\n'));
  write(workRoot, 'features/f/event/done-thing/index.yaml',
    'schema: work/event\nid: event.f.done-thing\nstate: done\n');
  write(workRoot, 'features/f/event/never/index.yaml',
    'schema: work/event\nid: event.f.never\nstate: done\n');
  write(workRoot, 'features/f/ui/orders/index.yaml', [
    'schema: work/ui-screen',
    'id: ui.f.orders',
    'state: done',
    'ui:',
    '  surfaces:',
    '    - {name: list, route: /orders}',
    '',
  ].join('\n'));
  write(workRoot, 'features/f/ui/ghost/index.yaml', [
    'schema: work/ui-screen',
    'id: ui.f.ghost',
    'state: done',
    'ui:',
    '  surfaces:',
    '    - {name: nowhere, route: /ghost}',
    '',
  ].join('\n'));

  write(be, 'src/features/f/http/api.controller.ts', [
    "import {Controller, Get} from '@nestjs/common';",
    '',
    "@Controller('api')",
    'export class ApiController {',
    '  @Get(\'orders/:id\') order() { return {}; }',
    '  @Get(\'secret\') secret() { return {}; }',
    '}',
    '',
  ].join('\n'));
  write(be, 'src/features/f/http/health.controller.ts', [
    "import {Controller, Get} from '@nestjs/common';",
    '',
    '@Controller()',
    'export class HealthController {',
    "  @Get('health') health() { return 'ok'; }",
    '}',
    '',
  ].join('\n'));
  write(be, 'src/features/f/graphql/queries/f/order-detail/order-detail.resolver.ts', [
    "import {Query, Resolver} from '@nestjs/graphql';",
    '',
    '@Resolver()',
    'export class OrderDetailResolver {',
    "  @Query(() => String, {name: 'orderDetail'})",
    "  orderDetail() { return 'x'; }",
    '}',
    '',
  ].join('\n'));
  write(be, 'src/features/g/graphql/mutations/g/do-thing/do-thing.resolver.ts', [
    "import {Mutation, Resolver} from '@nestjs/graphql';",
    '',
    '@Resolver()',
    'export class DoThingResolver {',
    '  @Mutation(() => String)',
    "  doThing() { return 'x'; }",
    '}',
    '',
  ].join('\n'));
  write(be, 'src/features/f/events.types.ts',
    "export class DoneThingEvent { readonly kind = 'event.f.done-thing'; constructor(readonly id: number) {} }\n");
  write(be, 'src/features/g/unnamed.events.ts',
    "export class UnnamedEvent { readonly kind = 'event.g.unnamed'; constructor(readonly id: number) {} }\n");
  write(be, 'src/features/f/thing.service.ts', [
    "import {DoneThingEvent} from './events.types';",
    "import {UnnamedEvent} from '../g/unnamed.events';",
    '',
    'export class ThingService {',
    '  fire() { return [new DoneThingEvent(1), new UnnamedEvent(2)]; }',
    '}',
    '',
  ].join('\n'));

  write(fe, 'src/app/[lang]/orders/page.tsx', 'export default function Page() { return null; }\n');
  write(fe, 'src/app/[lang]/extra/page.tsx', 'export default function Page() { return null; }\n');

  return {root, workRoot};
}

test('checkWorkSurfaces: refused codes fire for declared surfaces nothing serves, ' +
  'suspects for served surfaces nothing declares', () => {
  const {workRoot} = makeFixture();
  const out = {refuse: [], suspect: [], info: [], map: []};
  checkWorkSurfaces(workRoot, out);
  const all = [...out.refuse, ...out.suspect, ...out.info];
  const has = (list, code, needle) => list.some(l => l.includes(`[${code}]`) && (!needle || l.includes(needle)));

  assert.ok(has(out.refuse, 'CONTRACT_GHOST_ROUTE', 'POST /api/ghost'), out.refuse.join('\n'));
  assert.ok(has(out.refuse, 'CONTRACT_GHOST_OP', 'vanishOp'), out.refuse.join('\n'));
  assert.ok(has(out.refuse, 'UI_ROUTE_GHOST', '/ghost'), out.refuse.join('\n'));
  assert.ok(has(out.refuse, 'EVENT_UNEMITTED', 'event.f.never'), out.refuse.join('\n'));

  assert.ok(has(out.suspect, 'UNDECLARED_ROUTE', 'GET /api/secret'), out.suspect.join('\n'));
  assert.ok(has(out.suspect, 'UNDECLARED_OPERATION', 'doThing'), out.suspect.join('\n'));
  assert.ok(has(out.suspect, 'UI_ROUTE_UNDECLARED', '/extra'), out.suspect.join('\n'));
  assert.ok(has(out.suspect, 'EVENT_UNDECLARED', 'UnnamedEvent'), out.suspect.join('\n'));
  assert.ok(has(out.info, 'OPS_ROUTE', '/health'), out.info.join('\n'));
  assert.ok(out.map.length, 'SURFACE MAP lines are emitted');

  // the honest neighbours stay silent: served-and-declared-and-proved, emitted, and claimed surfaces
  assert.ok(!all.some(l => l.includes('/api/orders') && !l.includes('MAP')), all.join('\n'));
  assert.ok(!all.some(l => l.includes('orderDetail')), all.join('\n'));
  assert.ok(!all.some(l => l.includes('DoneThingEvent')), all.join('\n'));
  assert.ok(!all.some(l => l.includes('contract.f.orders')), all.join('\n'));
});

test('check-work-surfaces.mjs --tree: exits 1 with grouped findings on a violating tree', () => {
  const {workRoot} = makeFixture();
  const run = spawnSync(process.execPath, ['scripts/checks/check-work-surfaces.mjs', '--tree', workRoot],
    {cwd: CLAUDE_ROOT, encoding: 'utf8', windowsHide: true});
  assert.equal(run.status, 1, run.stderr);
  assert.ok(run.stdout.includes('SURFACE MAP'));
  assert.ok(run.stdout.includes('CONTRACT_GHOST_ROUTE'));
  assert.ok(/4 refused/.test(run.stdout), run.stdout);
});
