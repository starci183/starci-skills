import assert from 'node:assert/strict';
import test from 'node:test';
import { appDeclaration, archFixture, findings, runArch, ts } from '../helpers/hfs-arch-fixture.mjs';
import { isServerActionModule } from '../../scripts/hfs/architecture/server-action.mjs';

const sourceFile = source => ts.createSourceFile('action.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

test('Server Action recognition accepts only use-server in the directive prologue', () => {
  const cases = [
    ['first directive', '"use server";\nexport const act = async () => 1;', true],
    ['after another directive', '"use strict";\n"use server";\nexport const act = async () => 1;', true],
    ['BOM and CRLF', '\uFEFF"use server";\r\nexport const act = async () => 1;\r\n', true],
    ['after an import', 'import "server-only";\n"use server";\nexport const act = async () => 1;', false],
    ['parenthesized string expression', '("use server");\nexport const act = async () => 1;', false],
    ['inside a function only', 'export async function act() { "use server"; return 1; }', false],
  ];
  for (const [name, source, expected] of cases) {
    assert.equal(isServerActionModule(ts, sourceFile(source)), expected, name);
  }
});

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

test('the graph treats only a direct action import from a connected block as the RPC boundary', t => {
  const root = liteFixture(t, {
    'apps/web/src/modules/db/index.ts': "export { writeBarrel } from './orders/write-barrel';\n",
    'apps/web/src/modules/db/orders/write-good.ts': '\uFEFF"use strict";\r\n"use server";\r\nimport "server-only";\r\nexport const writeGood = async () => 1;\r\n',
    'apps/web/src/modules/db/orders/write-late.ts': 'import "server-only";\n"use server";\nexport const writeLate = async () => 1;\n',
    'apps/web/src/modules/db/orders/write-parenthesized.ts': '("use server");\nimport "server-only";\nexport const writeParenthesized = async () => 1;\n',
    'apps/web/src/modules/db/orders/write-function.ts': 'import "server-only";\nexport async function writeFunction() { "use server"; return 1; }\n',
    'apps/web/src/modules/db/orders/write-client-import.ts': '"use server";\nimport "server-only";\nimport { ClientLeaf } from "../../../components/leaves/ClientLeaf";\nexport const writeClientImport = async () => ClientLeaf;\n',
    'apps/web/src/modules/db/orders/write-barrel.ts': '"use server";\nimport "server-only";\nexport const writeBarrel = async () => 1;\n',
    'apps/web/src/modules/db/orders/read-order.ts': 'import "server-only";\nexport const readOrder = async () => 1;\n',
    'apps/web/src/components/leaves/ClientLeaf/index.tsx': '"use client";\nexport const ClientLeaf = () => null;\n',
    'apps/web/src/components/blocks/Good/index.tsx': '"use client";\nimport { writeGood } from "../../../modules/db/orders/write-good";\nexport const Good = writeGood;\n',
    'apps/web/src/components/blocks/Late/index.tsx': '"use client";\nimport { writeLate } from "../../../modules/db/orders/write-late";\nexport const Late = writeLate;\n',
    'apps/web/src/components/blocks/Parenthesized/index.tsx': '"use client";\nimport { writeParenthesized } from "../../../modules/db/orders/write-parenthesized";\nexport const Parenthesized = writeParenthesized;\n',
    'apps/web/src/components/blocks/FunctionOnly/index.tsx': '"use client";\nimport { writeFunction } from "../../../modules/db/orders/write-function";\nexport const FunctionOnly = writeFunction;\n',
    'apps/web/src/components/blocks/ClientImport/index.tsx': 'import { writeClientImport } from "../../../modules/db/orders/write-client-import";\nexport const ClientImport = writeClientImport;\n',
    'apps/web/src/components/blocks/Mixed/index.tsx': 'import { writeGood } from "../../../modules/db/orders/write-good";\nimport { readOrder } from "../../../modules/db/orders/read-order";\nexport const Mixed = [writeGood, readOrder];\n',
    'apps/web/src/components/blocks/Barrel/index.tsx': 'import { writeBarrel } from "../../../modules/db";\nexport const Barrel = writeBarrel;\n',
    'apps/web/src/hooks/orders/index.ts': 'import { writeGood } from "../../modules/db/orders/write-good";\nexport const useWriteOrder = () => writeGood;\n',
  });
  const report = runArch(root);

  assert.deepEqual(
    findings(report, 'FE_CLIENT_REACHES_SERVER').map(item => item.path).sort(),
    [
      'apps/web/src/components/blocks/FunctionOnly/index.tsx',
      'apps/web/src/components/blocks/Late/index.tsx',
      'apps/web/src/components/blocks/Parenthesized/index.tsx',
    ],
  );
  assert.deepEqual(
    findings(report, 'FE_TIER_DIRECTION').map(item => `${item.path} -> ${item.resolvedPath}`).sort(),
    [
      'apps/web/src/components/blocks/Barrel/index.tsx -> apps/web/src/modules/db/index.ts',
      'apps/web/src/components/blocks/FunctionOnly/index.tsx -> apps/web/src/modules/db/orders/write-function.ts',
      'apps/web/src/components/blocks/Late/index.tsx -> apps/web/src/modules/db/orders/write-late.ts',
      'apps/web/src/components/blocks/Mixed/index.tsx -> apps/web/src/modules/db/orders/read-order.ts',
      'apps/web/src/components/blocks/Parenthesized/index.tsx -> apps/web/src/modules/db/orders/write-parenthesized.ts',
      'apps/web/src/hooks/orders/index.ts -> apps/web/src/modules/db/orders/write-good.ts',
      'apps/web/src/modules/db/orders/write-client-import.ts -> apps/web/src/components/leaves/ClientLeaf/index.tsx',
    ],
  );
});

test('an action public entry may not hide export-star behind its directive', t => {
  const root = liteFixture(t, {
    'apps/web/src/modules/db/index.ts': 'export const db = 1;\n',
    'apps/web/src/modules/db/orders/write-inner.ts': '"use server";\nexport const writeInner = async () => 1;\n',
    'apps/web/src/modules/db/orders/write-star.ts': '"use server";\nexport * from "./write-inner";\n',
    'apps/web/src/components/blocks/Star/index.tsx': 'import { writeInner } from "../../../modules/db/orders/write-star";\nexport const Star = writeInner;\n',
  });
  const stars = findings(runArch(root), 'ARCH_OWNER_EXPORT_STAR');
  assert.equal(stars.length, 1, JSON.stringify(stars));
  assert.equal(stars[0].path, 'apps/web/src/modules/db/orders/write-star.ts');
});
