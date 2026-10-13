import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

// The front end serves no API (owner ruling 2026-10-13, both editions, every app, provider-independent):
// FE_SERVER_ACTION_FORBIDDEN refuses every "use server" directive, file-level or function-level, and FE_ROUTE_HANDLER_FORBIDDEN
// refuses every route handler under apps/<app>/src/app except health/live/route.ts and the fe.route.callback slot.
const actions = report => findings(report, 'FE_SERVER_ACTION_FORBIDDEN');
const routes = report => findings(report, 'FE_ROUTE_HANDLER_FORBIDDEN');
const full = (t, files, options = {}) => runArch(archFixture(t, { profile: 'fe', files, ...options }));

test('a full app with no directive and only the health/live route handler raises neither ban, and both are checked', t => {
  const report = full(t, {
    'apps/web/src/app/health/live/route.ts': "export const GET = () => new Response('ok');\n",
    'apps/web/src/modules/orders/format.ts': "'use strict';\nexport const format = (value: number) => String(value);\n",
    'apps/web/src/modules/orders/notes.ts': "export const note = 'a \"use server\" string is not a directive';\nexport const run = () => { const text = 'use server'; return text; };\n",
  });
  assert.deepEqual([...actions(report), ...routes(report)], [], JSON.stringify(report.violations, null, 1));
  assert.ok(report.coverage.checkedRuleIds.includes('FE_SERVER_ACTION_FORBIDDEN'));
  assert.ok(report.coverage.checkedRuleIds.includes('FE_ROUTE_HANDLER_FORBIDDEN'));
  assert.equal(report.coverage.hfsMachine.serverActions.status, 'checked');
});

test('FE_SERVER_ACTION_FORBIDDEN refuses a file-level directive and every function-level one (declaration, arrow, method), after another directive too', t => {
  const report = full(t, {
    'apps/web/src/modules/orders/write-order.ts': "'use server';\nexport const writeOrder = async (id: string) => id;\n",
    'apps/web/src/modules/orders/inline.ts': [
      "export async function save() { 'use server'; return 1; }",
      "export const remove = async () => { 'use strict'; 'use server'; return 2; };",
      "export class Store { async put() { 'use server'; return 3; } }",
      '',
    ].join('\n'),
    'apps/web/src/components/blocks/Form/index.tsx': "export const Form = () => { async function submit() { 'use server'; } return <form action={submit} />; };\n",
  });
  const found = actions(report).map(item => `${item.path}:${item.line}:${item.level}`).sort();
  assert.deepEqual(found, [
    'apps/web/src/components/blocks/Form/index.tsx:1:function',
    'apps/web/src/modules/orders/inline.ts:1:function',
    'apps/web/src/modules/orders/inline.ts:2:function',
    'apps/web/src/modules/orders/inline.ts:3:function',
    'apps/web/src/modules/orders/write-order.ts:1:file',
  ]);
});

test('FE_SERVER_ACTION_FORBIDDEN refuses a directive in a lite app exactly as in a full one', t => {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = 'lite';
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  const report = full(t, {
    '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`,
    'apps/web/src/modules/orders/write-order.ts': "'use server';\nexport const writeOrder = async (id: string) => id;\n",
  });
  assert.deepEqual(actions(report).map(item => item.path), ['apps/web/src/modules/orders/write-order.ts']);
});

test('FE_ROUTE_HANDLER_FORBIDDEN refuses every route handler of a full app with no supabase provider beyond health/live', t => {
  const report = full(t, {
    'apps/web/src/app/health/live/route.ts': "export const GET = () => new Response('ok');\n",
    'apps/web/src/app/health/ready/route.ts': "export const GET = () => new Response('ok');\n",
    'apps/web/src/app/api/orders/route.ts': "export const POST = () => new Response('no');\n",
    'apps/web/src/app/[locale]/feed/route.ts': "export const GET = () => new Response('no');\n",
  });
  assert.deepEqual(routes(report).map(item => item.path).sort(), [
    'apps/web/src/app/[locale]/feed/route.ts',
    'apps/web/src/app/api/orders/route.ts',
    'apps/web/src/app/health/ready/route.ts',
  ]);
});

test('FE_ROUTE_HANDLER_FORBIDDEN accepts the Supabase auth callback slot, a route.ts outside src/app and a route.tsx component', t => {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  const report = full(t, {
    '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`,
    'apps/web/src/app/auth/callback/route.ts': "export const GET = () => new Response('ok');\n",
    'apps/web/src/modules/routes/route.ts': "export const route = (path: string) => path;\n",
    'apps/web/src/app/api/export/route.tsx': 'export const Route = () => null;\n',
  });
  assert.deepEqual(routes(report), [], JSON.stringify(routes(report), null, 1));
});
