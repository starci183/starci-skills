// proves: BE_JWT_ALG_PINNED@lite BE_JWT_ALG_PINNED@full
import assert from 'node:assert/strict';
import test from 'node:test';
import { appDeclaration, archFixture, ts } from '../helpers/hfs-arch-fixture.mjs';
import { loadArchitectureConfig } from '../../scripts/hfs/architecture/config.mjs';
import { buildTypeScriptContext } from '../../scripts/hfs/architecture/typescript.mjs';
import { buildHfsGraph } from '../../scripts/hfs/architecture/hfs-graph.mjs';
import { checkJwtPolicy } from '../../scripts/hfs/architecture/supabase.mjs';

const verifier = (algorithms) => `
import { jwtVerify } from 'jose';
interface Options { url: string }
export async function verify(token: string, options: Options) {
  const { payload } = await jwtVerify(token, {}, {
    issuer: options.url, audience: 'authenticated', algorithms: ${algorithms},
  });
  if (payload.role !== 'authenticated') return null;
  return { id: payload.sub, role: 'authenticated' };
}`;

const jwtPolicyFindings = (t, edition, algorithms) => {
  const declaration = appDeclaration('be', {
    apps: [{ name: 'core', kind: 'api' }],
    connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }],
  });
  declaration.edition = edition;
  const root = archFixture(t, { profile: 'be', files: {
    '../hfs.json': JSON.stringify(declaration),
    '../node_modules/jose/package.json': JSON.stringify({ name: 'jose', version: '1.0.0', types: 'index.d.ts' }),
    '../node_modules/jose/index.d.ts': 'export declare function jwtVerify(token: string, keys: unknown, options: unknown): Promise<{payload: {role: string; sub: string}}>;',
    'src/modules/integrations/supabase/supabase.jwks.ts': verifier(algorithms),
  } });
  const config = loadArchitectureConfig(root);
  const context = buildTypeScriptContext(config, ts, []);
  const graph = buildHfsGraph(config, context);
  return checkJwtPolicy({ config, context, graph }).violations.filter((finding) => finding.ruleId === 'BE_JWT_ALG_PINNED');
};

for (const edition of ['lite', 'full']) {
  test(`R260 BE_JWT_ALG_PINNED accepts the literal asymmetric algorithm allowlist (${edition})`, (t) => {
    assert.deepEqual(jwtPolicyFindings(t, edition, "['ES256', 'RS256', 'EdDSA']"), []);
  });

  test(`R260 BE_JWT_ALG_PINNED rejects a shared-secret algorithm (${edition})`, (t) => {
    const findings = jwtPolicyFindings(t, edition, "['HS256']");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'BE_JWT_ALG_PINNED');
  });
}
