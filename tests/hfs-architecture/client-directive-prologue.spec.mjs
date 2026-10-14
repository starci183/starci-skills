import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// proves: FE_CLIENT_REACHES_SERVER@lite FE_CLIENT_REACHES_SERVER@full
const ENTRY = 'apps/web/src/components/blocks/Cart/index.tsx';
const READER = 'apps/web/src/modules/cart/read-cart.ts';
const IMPORT = "import { readCart } from '../../../modules/cart/read-cart';\nexport const Cart = () => readCart();\n";

function fixture(t, edition, files) {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = edition;
  if (edition === 'lite') {
    declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  }
  return archFixture(t, { profile: 'fe', files: {
    '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`,
    [READER]: "import { headers } from 'next/headers';\nexport const readCart = () => headers();\n",
    ...files,
  } });
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: use client after other directives traverses the runtime graph`, t => {
    const report = runArch(fixture(t, edition, {
      [ENTRY]: `// The comment is outside the statement list.\n'use strict';\n'custom directive';\n"use client";\n${IMPORT}`,
    }));
    const hits = findings(report, 'FE_CLIENT_REACHES_SERVER');
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].path, ENTRY);
    assert.equal(hits[0].importer, READER);
    assert.equal(hits[0].specifier, 'next/headers');
    assert.deepEqual(hits[0].dependencyChain, [ENTRY, READER]);
    assert.equal(report.coverage.hfsMachine.clientReachesServer.clientEntries, 1);
  });

  test(`${edition}: a client directive prologue with safe runtime and type-only server imports passes`, t => {
    const report = runArch(fixture(t, edition, {
      [ENTRY]: "'use strict';\n'use client';\nimport type { CartData } from '../../../modules/cart/read-cart';\nimport { format } from '../../../modules/cart/format';\nexport const Cart = (cart: CartData) => format(cart.total);\n",
      [READER]: "import 'server-only';\nexport type CartData = { total: number };\n",
      'apps/web/src/modules/cart/format.ts': 'export const format = (value: number) => String(value);\n',
    }));
    assert.deepEqual(findings(report, 'FE_CLIENT_REACHES_SERVER'), []);
    assert.equal(report.coverage.hfsMachine.clientReachesServer.clientEntries, 1);
  });

  test(`${edition}: a string after the directive prologue never marks a client entry`, t => {
    const prefixes = [
      "'use strict';\nconst ready = true;\n'use client';\n",
      "'use strict';\n;\n'use client';\n",
      "'use strict';\n('use client');\n",
      "'use strict';\n`use client`;\n",
      "'use strict';\nfunction nested() { 'use client'; }\n",
      "'use strict';\nexport const label = 'use client';\n",
    ];
    for (const prefix of prefixes) {
      const report = runArch(fixture(t, edition, { [ENTRY]: `${prefix}${IMPORT}` }));
      assert.deepEqual(findings(report, 'FE_CLIENT_REACHES_SERVER'), [], prefix);
      assert.equal(report.coverage.hfsMachine.clientReachesServer.clientEntries, 0, prefix);
    }
  });
}
