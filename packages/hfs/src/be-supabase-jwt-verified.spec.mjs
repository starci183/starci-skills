// proves: BE_SUPABASE_JWT_VERIFIED@lite
// proves: BE_SUPABASE_JWT_VERIFIED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from './helpers/hfs-arch-fixture.mjs';

const code = 'BE_SUPABASE_JWT_VERIFIED';

function fixture(t, edition, invalid) {
  const declaration = appDeclaration('be', { apps: [{ name: 'core', kind: 'api' }] });
  declaration.edition = edition;
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return archFixture(t, { profile: 'be', files: {
    '../hfs.json': JSON.stringify(declaration),
    '../node_modules/jose/package.json': JSON.stringify({ name: 'jose', types: 'index.d.ts' }),
    '../node_modules/jose/index.d.ts': `export declare function createRemoteJWKSet(url: URL): { kind: 'jwks' };
export declare function jwtVerify(token: string, jwks: unknown, options: { issuer: string; audience: string; algorithms: string[] }): Promise<unknown>;
export declare function decodeJwt(token: string): unknown;`,
    'src/modules/integrations/supabase/supabase.jwks.ts': `import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
const jwks = createRemoteJWKSet(new URL('https://fixture.invalid/auth/v1/.well-known/jwks.json'));
export const verify = (token: string) => {
  ${invalid ? 'decodeJwt(token);' : ''}
  return jwtVerify(token, jwks, { issuer: 'https://fixture.invalid/auth/v1', audience: 'authenticated', algorithms: ${invalid ? '[]' : "['ES256']"} });
};`,
  } });
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: refuses decode-only use and verification without algorithms`, t => {
    const report = runArch(fixture(t, edition, true));
    const violations = findings(report, code);
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.ok(violations.some(item => /decodes a token without/.test(item.message)));
    assert.ok(violations.some(item => /pin issuer/.test(item.message)));
  });

  test(`${code} ${edition}: accepts JWKS verification with issuer, audience and algorithm`, t => {
    const report = runArch(fixture(t, edition, false));
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.deepEqual(findings(report, code), []);
  });
}
