import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askUpstreamPath } from '../../scripts/connectors/ask-gateway-routes.mjs';

const N = 'a-0123456789abcdef01';

test('every route the serve-ask form answers maps to the same path', () => {
  assert.equal(askUpstreamPath(`/${N}`), `/${N}`);
  assert.equal(askUpstreamPath(`/${N}/img/0`), `/${N}/img/0`);
  assert.equal(askUpstreamPath(`/${N}/img/007`), `/${N}/img/007`);
  assert.equal(askUpstreamPath(`/${N}/answer`), `/${N}/answer`);
});

test('anything the form does not serve is refused at the gateway', () => {
  const refused = [
    '', '/', `/${N}/`, `/${N}/answer/`, `/${N}/img`, `/${N}/img/`, `/${N}/img/x`, `/${N}/img/1/2`, `/${N}/img/-1`, `/${N}/img/${'1'.repeat(7)}`,
    `/${N}/favicon.ico`, `/${N}/static/app.js`, `/${N}/..`, `/${N}/../a-bbbbbbbbbbbbbbbbbb`, `/${N}/%2e%2e/x`, `/${N}%2Fanswer`, `/${N}/img%2F0`,
    `/${N}/img/0%2F..`, `/${N}@evil.test/answer`, `/@evil.test/${N}`, `//evil.test/${N}`, `/${N}/answer?x=1`, `/${N}/answer#x`,
    `/${N} /answer`, `/${N}\\answer`, `/${'a'.repeat(65)}`, '/a b', '/a%00b',
  ];
  for (const p of refused) assert.equal(askUpstreamPath(p), null, JSON.stringify(p));
  assert.equal(askUpstreamPath(undefined), null);
});
