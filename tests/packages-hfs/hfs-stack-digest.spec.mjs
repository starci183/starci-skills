import test from 'node:test';
import assert from 'node:assert/strict';
import { DIGEST_REF, hasPlaceholderDigest, isImageReference, isReleaseId } from '../../packages/hfs/stack/digest.mjs';

const real = `ghcr.io/o/app-api@sha256:${'a1'.repeat(32)}`;
const zero = `ghcr.io/o/app-api@sha256:${'0'.repeat(64)}`;

test('a pinned reference with a real digest is accepted', () => {
  assert.equal(isImageReference(real), true);
  assert.equal(DIGEST_REF.test(`registry.example/team/app:1.2.3@sha256:${'b'.repeat(64)}`), true);
});

test('the all-zero placeholder digest is refused everywhere, also for unpinned local images', () => {
  assert.equal(isImageReference(zero), false);
  assert.equal(isImageReference(zero, true), false);
  assert.equal(hasPlaceholderDigest(`image: ${zero}\n`), true);
  assert.equal(hasPlaceholderDigest(`image: ${real}\n`), false);
});

test('an unpinned or malformed reference is refused unless a local throwaway swarm allows it', () => {
  assert.equal(isImageReference('ghcr.io/o/app-api:latest'), false);
  assert.equal(isImageReference('ghcr.io/o/app-api:latest', true), true);
  assert.equal(isImageReference(''), false);
  assert.equal(isImageReference(undefined), false);
  assert.equal(isImageReference(`GHCR.io/O/App@sha256:${'a'.repeat(64)}`), false);
});

test('a release id is exactly 16 lowercase hex characters', () => {
  assert.equal(isReleaseId('0123456789abcdef'), true);
  for (const bad of ['0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0', '0123456789abcdeg', '$(id)', undefined]) assert.equal(isReleaseId(bad), false);
});
