// proves: FE_SERVER_ACTION_FORBIDDEN@lite FE_SERVER_ACTION_FORBIDDEN@full
// proves: FE_ROUTE_HANDLER_FORBIDDEN@lite FE_ROUTE_HANDLER_FORBIDDEN@full
// proves: FE_STACK_FORBIDDEN@lite FE_STACK_FORBIDDEN@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { checkServerActions } from '../runtime/scripts/hfs/architecture/server-action.mjs';
import { feStackFindings } from '../runtime/scripts/hfs/rules/fe-stack.mjs';

const source = (rel, text, slot) => ({
  rel, slot, sourceFile: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true),
});

const actionInput = (edition, files) => ({
  graph: { files: new Map(files.map(file => [file.rel, file])) },
  context: { ts, edition, repo: { profile: 'fe', edition } },
});

function manifestInput(t, edition, dependencies) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-frontend-stack-coverage-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repoRoot, 'apps/web'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'apps/web/package.json'), JSON.stringify(dependencies));
  return { repoRoot, files: ['apps/web/package.json'], repo: { profile: 'fe', edition } };
}

for (const edition of ['lite', 'full']) {
  test(`FE_SERVER_ACTION_FORBIDDEN rejects module and inline directives in ${edition}`, () => {
    const input = actionInput(edition, [
      source('apps/web/src/modules/orders/actions.ts', "'use strict'; 'use server'; export const save = async () => 1;"),
      source('apps/web/src/modules/orders/inline.ts', "export async function save() { 'use server'; return 1; }"),
      source('packages/ui/src/leaves/Save/index.tsx', "export const save = async () => { 'use server'; return 1; };"),
    ]);
    assert.deepEqual(checkServerActions(input).violations.map(finding => finding.ruleId), [
      'FE_SERVER_ACTION_FORBIDDEN', 'FE_SERVER_ACTION_FORBIDDEN', 'FE_SERVER_ACTION_FORBIDDEN',
    ]);
  });

  test(`FE_SERVER_ACTION_FORBIDDEN accepts ordinary strings and client modules in ${edition}`, () => {
    const input = actionInput(edition, [
      source('apps/web/src/modules/orders/format.ts', "export const label = 'use server';"),
      source('apps/web/src/components/blocks/Save/index.tsx', "'use client'; export const Save = () => null;"),
      source('apps/web/src/modules/orders/inline.ts', "export const save = () => { const text = 'use server'; return text; };"),
    ]);
    assert.deepEqual(checkServerActions(input).violations, []);
  });

  test(`FE_ROUTE_HANDLER_FORBIDDEN rejects application API and ready handlers in ${edition}`, () => {
    const input = actionInput(edition, [
      source('apps/web/src/app/api/orders/route.ts', 'export const POST = () => new Response();'),
      source('apps/admin/src/app/health/ready/route.ts', 'export const GET = () => new Response();'),
    ]);
    assert.deepEqual(checkServerActions(input).violations.map(finding => finding.ruleId), [
      'FE_ROUTE_HANDLER_FORBIDDEN', 'FE_ROUTE_HANDLER_FORBIDDEN',
    ]);
  });

  test(`FE_ROUTE_HANDLER_FORBIDDEN accepts liveness and the owned auth callback in ${edition}`, () => {
    const input = actionInput(edition, [
      source('apps/web/src/app/health/live/route.ts', 'export const GET = () => new Response();'),
      source('apps/web/src/app/auth/callback/route.ts', 'export const GET = () => new Response();', 'fe.route.callback'),
      source('apps/web/src/modules/routes/route.ts', 'export const route = (path: string) => path;'),
    ]);
    assert.deepEqual(checkServerActions(input).violations, []);
  });

  test(`FE_STACK_FORBIDDEN rejects forbidden dependency sections in ${edition}`, t => {
    const input = manifestInput(t, edition, {
      dependencies: { urql: '4.0.0' }, devDependencies: { moment: '2.30.0' },
      peerDependencies: { formik: '2.4.0' }, optionalDependencies: { sonner: '2.0.0' },
    });
    assert.deepEqual(feStackFindings(input).map(finding => finding.code), [
      'FE_STACK_FORBIDDEN', 'FE_STACK_FORBIDDEN', 'FE_STACK_FORBIDDEN', 'FE_STACK_FORBIDDEN',
    ]);
  });

  test(`FE_STACK_FORBIDDEN accepts the canonical front-end libraries in ${edition}`, t => {
    const input = manifestInput(t, edition, {
      dependencies: { '@apollo/client': '4.0.0', swr: '2.3.0', dayjs: '1.11.0', 'react-hook-form': '7.60.0' },
    });
    assert.deepEqual(feStackFindings(input), []);
  });
}
