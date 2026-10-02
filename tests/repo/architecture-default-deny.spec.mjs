import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDenyFixture, scenarioCount } from '../helpers/repo-architecture-default-deny-fixture.mjs';

// R41 default-deny-app-guard (BE_DEFAULT_DENY): the api app root provides APP_GUARD entries in the order throttler ->
// CSRF origin guard (platform/http-security) -> AuthGuard (domain/identity). A guard is judged by structure, never by its
// name or folder alone (BE-CONVENTION 1.7 names the roles, not a library): the throttler is a @nestjs/throttler class or a
// guard reading the per-door metadata its own capability's decorator writes; the CSRF guard is an http-security guard that
// reads the request origin.

const cleanups = [];
let fixture;
before(() => { fixture = defaultDenyFixture(cleanup => cleanups.push(cleanup)); });
after(() => { for (const cleanup of cleanups) cleanup(); });
const hits = name => fixture.hits(name);

test('BE: throttler, CSRF, AuthGuard in that order raise nothing (the throttler may be the package class, a subclass or a rate limiter reading its door metadata)', () => {
  for (const name of ['good-package', 'good-subclass', 'good-tier', 'good-extra']) {
    assert.deepEqual(hits(name), [], name);
  }
  assert.equal(fixture.report.coverage.hfsMachine.defaultDeny.apps, scenarioCount);
  assert.ok(fixture.report.coverage.checkedRuleIds.includes('BE_DEFAULT_DENY'));
});

test('BE: a missing guard is one finding naming it', () => {
  assert.match(hits('missing-throttler')[0].message, /does not provide the throttler guard/);
  assert.match(hits('missing-csrf')[0].message, /does not provide the CSRF origin guard/);
  assert.match(hits('missing-auth')[0].message, /does not provide AuthGuard/);
  assert.equal(hits('missing-all').length, 3);
});

test('BE: a guard that only looks like AuthGuard, declared elsewhere, does not count', () => {
  const found = hits('auth-lookalike');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /does not provide AuthGuard/);
});

test('BE: reordered guards are refused, one finding per guard out of place', () => {
  const found = hits('reordered-auth-first');
  assert.equal(found.length, 1, JSON.stringify(found.map(item => item.message)));
  assert.match(found[0].message, /CSRF origin guard of platform\/http-security before the throttler guard|AuthGuard of domain\/identity before/);
  assert.equal(hits('reordered-auth-middle').length, 1);
});

test('BE: a repeated guard is refused', () => {
  const found = hits('repeated-auth');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /more than once/);
});

test('BE: two guards of platform/http-security are two roles - the rate limiter is the throttler, the one reading the origin is the CSRF guard', () => {
  const swapped = hits('swapped-http-security');
  assert.equal(swapped.length, 1, JSON.stringify(swapped.map(item => item.message)));
  assert.match(swapped[0].message, /before the throttler guard/);
});

test('BE: an http-security guard that reads no origin and no door metadata, or a key that nothing writes, is neither the throttler nor the CSRF guard', () => {
  for (const name of ['not-throttler-plain', 'not-throttler-stray']) {
    const found = hits(name);
    assert.equal(found.length, 1, name);
    assert.match(found[0].message, /does not provide the throttler guard/);
  }
});

// A helper that builds the APP_GUARD entries outside the app root file is followed: the chain is judged where it is provided.
test('BE: guards built by a helper declared outside the app root file, called or spread from it, are judged like inline ones', () => {
  for (const kind of ['call', 'spread']) {
    assert.deepEqual(hits(`helper-${kind}-good`), [], kind);
    assert.match(hits(`helper-${kind}-missing`)[0].message, /does not provide AuthGuard/, kind);
    assert.equal(hits(`helper-${kind}-reordered`).length, 1, kind);
  }
});
