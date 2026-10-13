import assert from 'node:assert/strict';
import test from 'node:test';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

// Owner ruling 2026-10-13 (lite = full): a lite front end runs no Server Action. FE_SERVER_ACTION_FORBIDDEN recognises a
// "use server" directive exactly where JavaScript does - in the directive prologue of the file or of a function body - and no
// "use server" module is an RPC boundary any more: the tier, owner-entry and client-graph checks judge it like any module.
const liteFixture = (t, files) => {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = 'lite';
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return archFixture(t, {
    profile: 'fe',
    files: {
      '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`,
      ...files,
    },
  });
};

test('FE_SERVER_ACTION_FORBIDDEN in a lite app follows the directive prologue: first, after another directive, BOM and CRLF, and inside a function', t => {
  const cases = [
    ['first directive', 'apps/web/src/modules/orders/first.ts', '"use server";\nexport const act = async () => 1;\n', ['file']],
    ['after another directive', 'apps/web/src/modules/orders/second.ts', '"use strict";\n"use server";\nexport const act = async () => 1;\n', ['file']],
    ['BOM and CRLF', 'apps/web/src/modules/orders/bom.ts', '﻿"use server";\r\nexport const act = async () => 1;\r\n', ['file']],
    ['inside a function', 'apps/web/src/modules/orders/inner.ts', 'export async function act() { "use server"; return 1; }\n', ['function']],
    ['after an import is no directive', 'apps/web/src/modules/orders/late.ts', 'import "server-only";\n"use server";\nexport const act = async () => 1;\n', []],
    ['a parenthesized string is no directive', 'apps/web/src/modules/orders/paren.ts', '("use server");\nexport const act = async () => 1;\n', []],
    ['a template literal is no directive', 'apps/web/src/modules/orders/template.ts', '`use server`;\nexport const act = async () => 1;\n', []],
  ];
  const files = { 'apps/web/src/modules/orders/index.ts': 'export const orders = 1;\n', ...Object.fromEntries(cases.map(([, file, source]) => [file, source])) };
  const report = runArch(liteFixture(t, files));
  const found = findings(report, 'FE_SERVER_ACTION_FORBIDDEN');
  for (const [name, file, , levels] of cases) {
    assert.deepEqual(found.filter(item => item.path === file).map(item => item.level), levels, name);
  }
});

test('a "use server" module is no RPC boundary in lite: a block or hook reaching into it is a tier, owner-entry and client-graph finding', t => {
  const root = liteFixture(t, {
    'apps/web/src/modules/orders/index.ts': 'export const orders = 1;\n',
    'apps/web/src/modules/orders/write-good.ts': '﻿"use strict";\r\n"use server";\r\nimport "server-only";\r\nexport const writeGood = async () => 1;\r\n',
    'apps/web/src/components/blocks/Good/index.tsx': '"use client";\nimport { writeGood } from "../../../modules/orders/write-good";\nexport const Good = writeGood;\n',
    'apps/web/src/hooks/orders/index.ts': 'import { writeGood } from "../../modules/orders/write-good";\nexport const useWriteOrder = () => writeGood;\n',
  });
  const report = runArch(root);
  const edges = code => findings(report, code).map(item => `${item.path} -> ${item.resolvedPath}`).sort();
  assert.deepEqual(findings(report, 'FE_SERVER_ACTION_FORBIDDEN').map(item => item.path), ['apps/web/src/modules/orders/write-good.ts']);
  assert.deepEqual(findings(report, 'FE_CLIENT_REACHES_SERVER').map(item => item.path), ['apps/web/src/components/blocks/Good/index.tsx']);
  assert.deepEqual(edges('ARCH_OWNER_EXPORT_BYPASS'), [
    'apps/web/src/components/blocks/Good/index.tsx -> apps/web/src/modules/orders/write-good.ts',
    'apps/web/src/hooks/orders/index.ts -> apps/web/src/modules/orders/write-good.ts',
  ]);
});
