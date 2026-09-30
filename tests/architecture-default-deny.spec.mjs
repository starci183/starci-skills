import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R41 default-deny-app-guard (BE_DEFAULT_DENY): the api app root provides APP_GUARD entries in the order throttler ->
// CSRF origin guard (platform/http-security) -> AuthGuard (domain/identity).

const FILES = {
  'src/modules/platform/http-security/index.ts': "export { CsrfOriginGuard } from './csrf-origin.guard';\nexport { AppThrottlerGuard } from './app-throttler.guard';\n",
  'src/modules/platform/http-security/csrf-origin.guard.ts': 'export class CsrfOriginGuard { canActivate(): boolean { return true; } }\n',
  'src/modules/platform/http-security/app-throttler.guard.ts': "import { ThrottlerGuard } from '@nestjs/throttler';\nexport class AppThrottlerGuard extends ThrottlerGuard {}\n",
  'src/modules/domain/identity/index.ts': "export { AuthGuard } from './auth.guard';\nexport { Lookalike } from './lookalike';\n",
  'src/modules/domain/identity/auth.guard.ts': 'export class AuthGuard { canActivate(): boolean { return true; } }\n',
  'src/modules/domain/identity/lookalike.ts': 'export class Lookalike { canActivate(): boolean { return true; } }\n',
};
const APP = guards => `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppThrottlerGuard, CsrfOriginGuard } from '../../../src/modules/platform/http-security';
import { AuthGuard, Lookalike } from '../../../src/modules/domain/identity';
@Module({ providers: [${guards.map(name => `{ provide: APP_GUARD, useClass: ${name} }`).join(', ')}] })
export class AppModule {}
`;
const hits = report => findings(report, 'BE_DEFAULT_DENY');
const run = (t, guards) => runArch(archFixture(t, { files: { ...FILES, 'apps/core/src/app.module.ts': APP(guards) } }));

test('BE: throttler, CSRF, AuthGuard in that order raise nothing (the throttler may be the package class or a subclass)', t => {
  for (const guards of [['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], ['AppThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], ['ThrottlerGuard', 'Lookalike', 'CsrfOriginGuard', 'AuthGuard']]) {
    const report = run(t, guards);
    assert.deepEqual(hits(report), [], guards.join());
  }
  const report = run(t, ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard']);
  assert.equal(report.coverage.hfsMachine.defaultDeny.apps, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_DEFAULT_DENY'));
});

test('BE: a missing guard is one finding naming it', t => {
  assert.match(hits(run(t, ['CsrfOriginGuard', 'AuthGuard']))[0].message, /does not provide the throttler guard/);
  assert.match(hits(run(t, ['ThrottlerGuard', 'AuthGuard']))[0].message, /does not provide the CSRF origin guard/);
  assert.match(hits(run(t, ['ThrottlerGuard', 'CsrfOriginGuard']))[0].message, /does not provide AuthGuard/);
  assert.equal(hits(run(t, [])).length, 3);
});

test('BE: a guard that only looks like AuthGuard, declared elsewhere, does not count', t => {
  const found = hits(run(t, ['ThrottlerGuard', 'CsrfOriginGuard', 'Lookalike']));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /does not provide AuthGuard/);
});

test('BE: reordered guards are refused, one finding per guard out of place', t => {
  const found = hits(run(t, ['AuthGuard', 'ThrottlerGuard', 'CsrfOriginGuard']));
  assert.equal(found.length, 1, JSON.stringify(found.map(item => item.message)));
  assert.match(found[0].message, /CSRF origin guard of platform\/http-security before the throttler guard|AuthGuard of domain\/identity before/);
  assert.equal(hits(run(t, ['ThrottlerGuard', 'AuthGuard', 'CsrfOriginGuard'])).length, 1);
});

test('BE: a repeated guard is refused', t => {
  const found = hits(run(t, ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard', 'AuthGuard']));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /more than once/);
});
