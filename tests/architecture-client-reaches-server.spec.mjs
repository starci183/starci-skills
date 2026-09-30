import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R55 client-reaches-server (FE_CLIENT_REACHES_SERVER): from every "use client" module, over runtime imports, no reachable module
// imports server-only, next/headers, next/server, next-intl/server, node:* or a Node built-in.
const hits = report => findings(report, 'FE_CLIENT_REACHES_SERVER');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files }));
const READER = "import 'server-only';\nimport { headers } from 'next/headers';\nexport const readSession = async () => (await headers()).get('x');\n";

test('a client component that reaches a server reader through three hops is one finding naming the entry and the chain', t => {
  const report = run(t, {
    'apps/web/src/components/blocks/Cart/index.tsx': "'use client';\nimport { useCart } from '../../../hooks/cart/useCart';\nexport const Cart = () => useCart();\n",
    'apps/web/src/hooks/cart/useCart.ts': "import { loadCart } from '../../modules/cart/load-cart';\nexport const useCart = () => loadCart();\n",
    'apps/web/src/modules/cart/load-cart.ts': "import { session } from './session';\nexport const loadCart = () => session();\n",
    'apps/web/src/modules/cart/session.ts': READER,
  });
  const found = hits(report);
  assert.equal(found.length, 2, JSON.stringify(found, null, 1));
  assert.deepEqual(found.map(item => item.specifier).sort(), ['next/headers', 'server-only']);
  assert.equal(found[0].path, 'apps/web/src/components/blocks/Cart/index.tsx');
  assert.equal(found[0].clientEntry, 'apps/web/src/components/blocks/Cart/index.tsx');
  assert.deepEqual(found[0].dependencyChain, [
    'apps/web/src/components/blocks/Cart/index.tsx', 'apps/web/src/hooks/cart/useCart.ts', 'apps/web/src/modules/cart/load-cart.ts', 'apps/web/src/modules/cart/session.ts']);
  assert.match(found[0].message, /useCart\.ts -> apps\/web\/src\/modules\/cart\/load-cart\.ts -> apps\/web\/src\/modules\/cart\/session\.ts/);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_CLIENT_REACHES_SERVER'));
});

test('a client module that itself imports next/server, next-intl/server, node:fs or a bare Node built-in is a finding', t => {
  const report = run(t, {
    'apps/web/src/hooks/a/useA.ts': "'use client';\nimport { NextResponse } from 'next/server';\nexport const useA = () => NextResponse;\n",
    'apps/web/src/hooks/b/useB.ts': "'use client';\nimport { getTranslations } from 'next-intl/server';\nexport const useB = () => getTranslations;\n",
    'apps/web/src/hooks/c/useC.ts': "'use client';\nimport { readFileSync } from 'node:fs';\nexport const useC = () => readFileSync;\n",
    'apps/web/src/hooks/d/useD.ts': "'use client';\nimport { readFileSync } from 'fs';\nexport const useD = () => readFileSync;\n",
    'apps/web/src/hooks/e/useE.ts': "'use client';\nimport { join } from 'path';\nexport const useE = () => join;\n",
  });
  assert.deepEqual(hits(report).map(item => item.specifier).sort(), ['fs', 'next-intl/server', 'next/server', 'node:fs', 'path']);
});

test('a server reader reached only from server components, and a client tree free of server imports, raise no FE_CLIENT_REACHES_SERVER', t => {
  const report = run(t, {
    'apps/web/src/app/page.tsx': "import { readSession } from '../modules/cart/session';\nexport default async function Page() { return <main>{await readSession()}</main>; }\n",
    'apps/web/src/modules/cart/session.ts': READER,
    'apps/web/src/components/blocks/Cart/index.tsx': "'use client';\nimport { useCart } from '../../../hooks/cart/useCart';\nexport const Cart = () => useCart();\n",
    'apps/web/src/hooks/cart/useCart.ts': "import { format } from '../../modules/cart/format';\nexport const useCart = () => format(1);\n",
    'apps/web/src/modules/cart/format.ts': 'export const format = (value: number) => String(value);\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('a type-only import of a server module, and a type-only edge to the server reader, vanish at build and pass', t => {
  const report = run(t, {
    'apps/web/src/components/blocks/Cart/index.tsx': "'use client';\nimport type { Session } from '../../../modules/cart/session';\nimport { type Headers as H } from 'next/headers';\nexport const Cart = (props: { session: Session; h: H }) => props.session;\n",
    'apps/web/src/modules/cart/session.ts': "import type { ReadonlyHeaders } from 'next/headers';\nimport 'server-only';\nexport type Session = { headers: ReadonlyHeaders };\nexport const read = async () => 1;\n",
    'apps/web/src/hooks/cart/useTypes.ts': "'use client';\nimport type { NextRequest } from 'next/server';\nexport type Req = NextRequest;\nexport const useTypes = () => 1;\n",
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});
