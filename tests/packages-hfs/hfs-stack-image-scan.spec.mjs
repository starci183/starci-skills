import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanImage, walkTar } from '../../packages/hfs/stack/image-scan.mjs';
import { tarOf } from '../helpers/tar-fixture.mjs';

const temps = [];
const tempFile = (buffer) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-tar-'));
  temps.push(dir);
  const file = path.join(dir, 'x.tar');
  fs.writeFileSync(file, buffer);
  return file;
};
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });

const NL = String.fromCharCode(10);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stderr = 'boom') => ({ status: 1, stdout: '', stderr });
const KEY_BLOCK = ['-----BEGIN OPENSSH', 'PRIVATE KEY-----'].join(' ');
const SECRET_VALUE = 'SECRET-VALUE-NEVER-PRINTED';

test('walkTar reads plain, prefixed, GNU long, PAX and base-256 entries and skips content it is not asked for', () => {
  const entries = [
    { name: 'app/server.js', content: 'hello' },
    { name: 'deep.txt', prefix: 'very/long/prefix', content: 'x' },
    { name: 'placeholder', longName: 'gnu/long/name/file.txt', content: 'y' },
    { name: 'placeholder2', pax: 'pax/path/file.txt', content: 'z' },
    { name: 'big.bin', content: 'q'.repeat(10), base256: true },
    { name: 'dir/', type: '5' },
  ];
  const seen = [];
  walkTar(tempFile(tarOf(entries)), ({ name, type, size, read }) => seen.push({ name, type, size, body: size > 0 && size < 3 ? read().toString() : null }));
  assert.deepEqual(seen.map((entry) => entry.name), ['app/server.js', 'very/long/prefix/deep.txt', 'gnu/long/name/file.txt', 'pax/path/file.txt', 'big.bin', 'dir']);
  assert.deepEqual(seen.map((entry) => entry.size), [5, 1, 1, 1, 10, 0]);
  assert.equal(seen[1].body, 'x');
  assert.equal(seen[5].type, '5');
});

test('walkTar stops at the end marker and at a truncated file', () => {
  assert.doesNotThrow(() => walkTar(tempFile(tarOf([{ name: 'a', content: 'b' }], { terminate: false })), () => {}));
  assert.doesNotThrow(() => walkTar(tempFile(Buffer.alloc(100)), () => assert.fail('no entry')));
});

/** A docker whose answers the spec controls; the filesystem tar is written where `docker export -o` says. */
function docker({ history = '', env = '[]', tar = tarOf([]), failing = [] } = {}) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push(args);
    if (failing.includes(args[0])) return bad(`${args[0]} failed`);
    if (args[0] === 'history') return ok(history);
    if (args[0] === 'inspect') return ok(env);
    if (args[0] === 'create') return ok('cid1' + NL);
    if (args[0] === 'export') { fs.writeFileSync(args[2], tar); return ok(); }
    if (args[0] === 'rm') return ok();
    throw new Error(`unknown docker command ${args.join(' ')}`);
  };
  return { ctx: { spawn }, calls };
}

const scan = (setup, allowedArgs = ['NEXT_PUBLIC_URL']) => scanImage(setup.ctx, 'ghcr.io/o/app-web:sha', { allowedArgs });

test('a clean image passes: no secret pattern, only the public build arguments, library directories ignored', () => {
  const history = ['|1 NEXT_PUBLIC_URL=https://app.example /bin/sh -c npm run build', 'COPY dir:abc in /app', 'ARG NEXT_PUBLIC_URL=https://app.example'].join(NL);
  const tar = tarOf([
    { name: 'app/server.js', content: 'console.log(1)' }, { name: 'app/.env.example', content: 'A=1' }, { name: 'app/node_modules/x/test/key.pem', content: KEY_BLOCK },
    { name: 'etc/ssl/private/ca.key', content: 'k' }, { name: 'usr/share/doc/note.md', content: KEY_BLOCK }, { name: 'app/empty.json', content: '' },
    { name: 'app/huge.json', content: 'a'.repeat(200 * 1024) }, { name: 'app/link', type: '2' },
  ]);
  const result = scan(docker({ history, env: JSON.stringify(['PATH=/usr/bin', 'NODE_ENV=production', 'EMPTY_TOKEN=']), tar }));
  assert.deepEqual(result, { ok: true, hits: [], errors: [] });
});

test('hits name the rule and the place, never the matched text', () => {
  const history = [`RUN echo ${KEY_BLOCK}`, '|2 NEXT_PUBLIC_URL=x DB_PASSWORD=hunter2 /bin/sh -c build', 'ARG SESSION_SECRET'].join(NL);
  const env = JSON.stringify([`API_TOKEN=${SECRET_VALUE}`, `OTHER=${KEY_BLOCK}`, 'BROKEN']);
  const tar = tarOf([{ name: 'app/.env', content: 'A=1' }, { name: 'app/keys/id_ed25519', content: 'x' }, { name: 'app/config.json', content: `{"sops": {"age": []}}` }, { name: 'app/notes.txt', content: 'AGE-SECRET-KEY-1ABCDEFGHIJKLMNOPQRSTUVWXYZ0123' }]);
  const result = scan(docker({ history, env, tar }));
  assert.equal(result.ok, false);
  const kinds = result.hits.map((hit) => `${hit.kind}:${hit.where}`);
  for (const expected of ['history:history line 1', 'build-arg:history line 2', 'build-arg:history line 3', 'env:environment variable API_TOKEN', 'env:environment variable OTHER', 'file:app/.env', 'file:app/keys/id_ed25519', 'content:app/config.json', 'content:app/notes.txt']) {
    assert.ok(kinds.includes(expected), expected);
  }
  assert.ok(result.hits.some((hit) => hit.why === 'build argument DB_PASSWORD is not on the public build-args list'));
  const printed = JSON.stringify(result);
  for (const secret of [SECRET_VALUE, 'hunter2', 'ABCDEFGHIJKLMNOP', 'BEGIN OPENSSH']) assert.equal(printed.includes(secret), false, secret);
});

test('an environment that is not JSON is treated as empty', () => {
  assert.equal(scan(docker({ env: 'not json' })).ok, true);
  assert.equal(scan(docker({ env: '{"a":1}' })).ok, true);
});

test('every scan step that cannot run is an error, and a failed export still removes the container', () => {
  for (const failing of ['history', 'inspect', 'create']) {
    const result = scan(docker({ failing: [failing] }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.startsWith(`docker ${failing === 'create' ? 'create' : failing} failed`)), failing);
  }
  const exportFailing = docker({ failing: ['export'] });
  const result = scan(exportFailing);
  assert.ok(result.errors.includes('docker export failed: export failed'));
  assert.ok(exportFailing.calls.some((args) => args[0] === 'rm'));
  const emptyId = { ctx: { spawn: (command, args) => (args[0] === 'create' ? ok('') : ok()) } };
  assert.ok(scan(emptyId).errors.some((error) => error.startsWith('docker create failed')));
});

test('walkTar tolerates a header with an empty size field and no type byte, and a PAX record without a path', () => {
  const bare = Buffer.alloc(512);
  bare.write('bare-file', 0);
  const names = [];
  walkTar(tempFile(Buffer.concat([bare, Buffer.alloc(1024)])), ({ name, type, size }) => names.push(`${name}:${type}:${size}`));
  assert.deepEqual(names, ['bare-file:0:0']);
  const seen = [];
  walkTar(tempFile(tarOf([{ name: 'kept.txt', paxOther: 'mtime=1', content: 'k' }])), ({ name }) => seen.push(name));
  assert.deepEqual(seen, ['kept.txt']);
  const both = [];
  walkTar(tempFile(tarOf([{ name: 'x', longName: 'long/kept.txt', paxOther: 'mtime=1', content: 'k' }])), ({ name }) => both.push(name));
  assert.deepEqual(both, ['long/kept.txt']);
});
