import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R41 default-deny-app-guard (BE_DEFAULT_DENY): the api app root provides APP_GUARD entries in the order throttler ->
// CSRF origin guard (platform/http-security) -> AuthGuard (domain/identity). A guard is judged by structure, never by its
// name or folder alone (BE-CONVENTION 1.7 names the roles, not a library): the throttler is a @nestjs/throttler class or a
// guard reading the per-door metadata its own capability's decorator writes; the CSRF guard is an http-security guard that
// reads the request origin.

const TIER_GUARDS = [
  "import { SetMetadata } from '@nestjs/common';",
  "const TIER_KEY = 'tier';",
  "const STRAY_KEY = 'stray';",
  'export const RateLimit = (tier: string) => SetMetadata(TIER_KEY, tier);',
  'interface Reader { getAllAndOverride(key: string, targets: unknown[]): unknown }',
  // A rate limiter of its own (no @nestjs/throttler): it reads the tier that the decorator of its capability writes.
  'export class TierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(TIER_KEY, []) !== undefined; } }',
  // Reads nothing: neither a throttler nor a CSRF guard, only a guard that happens to live in http-security.
  'export class PlainGuard { canActivate(): boolean { return true; } }',
  // Reads a key that no SetMetadata of its capability writes.
  'export class StrayTierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(STRAY_KEY, []) !== undefined; } }',
  '',
].join('\n');

const FILES = {
  'src/modules/platform/http-security/index.ts': "export { CsrfOriginGuard } from './csrf-origin.guard';\nexport { AppThrottlerGuard } from './app-throttler.guard';\nexport { PlainGuard, StrayTierGuard, TierGuard } from './tier.guard';\n",
  'src/modules/platform/http-security/csrf-origin.guard.ts': 'export class CsrfOriginGuard { canActivate(context: { headers: { origin?: string } }): boolean { return context.headers.origin !== undefined; } }\n',
  'src/modules/platform/http-security/app-throttler.guard.ts': "import { ThrottlerGuard } from '@nestjs/throttler';\nexport class AppThrottlerGuard extends ThrottlerGuard {}\n",
  'src/modules/platform/http-security/tier.guard.ts': TIER_GUARDS,
  'src/modules/domain/identity/index.ts': "export { AuthGuard } from './auth.guard';\nexport { Lookalike } from './lookalike';\n",
  'src/modules/domain/identity/auth.guard.ts': 'export class AuthGuard { canActivate(): boolean { return true; } }\n',
  'src/modules/domain/identity/lookalike.ts': 'export class Lookalike { canActivate(): boolean { return true; } }\n',
};
const APP = guards => `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppThrottlerGuard, CsrfOriginGuard, PlainGuard, StrayTierGuard, TierGuard } from '../../../src/modules/platform/http-security';
import { AuthGuard, Lookalike } from '../../../src/modules/domain/identity';
@Module({ providers: [${guards.map(name => `{ provide: APP_GUARD, useClass: ${name} }`).join(', ')}] })
export class AppModule {}
`;
const hits = report => findings(report, 'BE_DEFAULT_DENY');
const run = (t, guards) => runArch(archFixture(t, { files: { ...FILES, 'apps/core/src/app.module.ts': APP(guards) } }));

test('BE: throttler, CSRF, AuthGuard in that order raise nothing (the throttler may be the package class, a subclass or a rate limiter reading its door metadata)', t => {
  for (const guards of [['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], ['AppThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], ['TierGuard', 'CsrfOriginGuard', 'AuthGuard'], ['ThrottlerGuard', 'Lookalike', 'CsrfOriginGuard', 'AuthGuard']]) {
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

test('BE: two guards of platform/http-security are two roles - the rate limiter is the throttler, the one reading the origin is the CSRF guard', t => {
  const swapped = hits(run(t, ['CsrfOriginGuard', 'TierGuard', 'AuthGuard']));
  assert.equal(swapped.length, 1, JSON.stringify(swapped.map(item => item.message)));
  assert.match(swapped[0].message, /before the throttler guard/);
});

test('BE: an http-security guard that reads no origin and no door metadata, or a key that nothing writes, is neither the throttler nor the CSRF guard', t => {
  for (const other of ['PlainGuard', 'StrayTierGuard']) {
    const found = hits(run(t, [other, 'CsrfOriginGuard', 'AuthGuard']));
    assert.equal(found.length, 1, other);
    assert.match(found[0].message, /does not provide the throttler guard/);
  }
});
