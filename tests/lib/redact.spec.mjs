import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { redactBytes, redactText } from '../../scripts/lib/redact.mjs';
import { secretEnv, connectorSecret } from '../../engine/secrets.mjs';
import { redactTextStream } from '../../ui/api/redact-read.mjs';

const utf16 = (text, be) => {
  const body = Buffer.from(text, 'utf16le');
  if (be) body.swap16();
  return Buffer.concat([Buffer.from(be ? [0xfe, 0xff] : [0xff, 0xfe]), body]);
};

test('write-time redaction normalizes every supported BOM and refuses malformed text', () => {
  const text = 'ACCESS_TOKEN=opaque-fixture-credential\n';
  for (const bytes of [Buffer.from(text), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]), utf16(text, false), utf16(text, true)]) {
    const filtered = redactBytes(bytes, 'text/plain');
    assert.equal(filtered.redaction, 'v1');
    assert.doesNotMatch(filtered.bytes.toString('utf8'), /opaque-fixture-credential/);
    assert.match(filtered.bytes.toString('utf8'), /redacted/);
  }
  for (const bytes of [Buffer.from([0xff, 0xfe, 0x01]), Buffer.from([0xc3, 0x28])]) assert.throws(() => redactBytes(bytes, 'text/plain'));
});

test('read-time filtering handles a split BOM and UTF16BE characters crossing every chunk boundary', async () => {
  const bytes = utf16('ACCESS_TOKEN=opaque-fixture-credential\nnext line\n', true);
  const output = [];
  for await (const chunk of Readable.from([...bytes].map(byte => Buffer.from([byte]))).pipe(redactTextStream())) output.push(chunk);
  const text = Buffer.concat(output).toString('utf8');
  assert.doesNotMatch(text, /opaque-fixture-credential/);
  assert.match(text, /next line/);
});

test('a long-lived reader filters newly resolved and rotated fake opaque credentials without exposing the value set', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-redact-resolved-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'secret.env');
  fs.writeFileSync(file, 'CUSTOM_CREDENTIAL=opaque-first-fixture\n');
  secretEnv(root, {});
  assert.doesNotMatch(redactText('opaque-first-fixture'), /opaque-first-fixture/);
  fs.writeFileSync(file, 'CUSTOM_CREDENTIAL=opaque-rotated-fixture\n');
  secretEnv(root, {});
  assert.doesNotMatch(redactText('opaque-rotated-fixture'), /opaque-rotated-fixture/);
  connectorSecret('CUSTOM_SECRET', { CUSTOM_SECRET: 'opaque-direct-fixture' });
  assert.doesNotMatch(redactText('opaque-direct-fixture'), /opaque-direct-fixture/);
});

test('declared stack custody refreshes after a new fake credential replaces the prior value', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-redact-rotation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stack = path.join(root, '.starcistacks', 'fixture'); fs.mkdirSync(stack, { recursive: true });
  fs.writeFileSync(path.join(stack, 'stack.yaml'), 'secrets:\n  customer-secret: {file: fixture-token}\n');
  const file = path.join(stack, 'fixture-token'); fs.writeFileSync(file, 'opaque-custody-first');
  assert.doesNotMatch(redactText('opaque-custody-first', { repoRoots: [root] }), /opaque-custody-first/);
  fs.writeFileSync(file, 'opaque-custody-second');
  assert.doesNotMatch(redactText('opaque-custody-second', { repoRoots: [root] }), /opaque-custody-second/);
});
