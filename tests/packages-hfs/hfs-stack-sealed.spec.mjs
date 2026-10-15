// proves: sealed custody is opened in memory, secret names are versioned like the earlier tooling, grants follow their options, and refusals name no value.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configBytes, configObjects, hasAgeIdentity, isBinary, lfBytes, lfText, loadSealed, openMember, requireAgeIdentity, secretRuntimeName, sha, versionKeyOf } from '../../packages/hfs/stack/sealed.mjs';
import { makeApp, MEMBERS } from '../helpers/stack-release-fakes.mjs';

const apps = [];
const app = (options) => { const made = makeApp(options); apps.push(made); return made; };
after(() => apps.forEach((made) => made.dispose()));

const expectedName = (stack, key, value, versionKey) => {
  const version = crypto.createHmac('sha256', versionKey).update(`${key}\0${value}`).digest('hex').slice(0, 10);
  return `${stack}-${key.toLowerCase().replaceAll('_', '-')}-v${version}`;
};

const refused = (fn, code) => assert.throws(fn, (error) => error.code === code && error.exit === 2);

test('a runtime name equals the formula of the earlier tooling for the same inputs', () => {
  assert.equal(secretRuntimeName('app', 'DATABASE_URL', 'v1', 'k'), expectedName('app', 'DATABASE_URL', 'v1', 'k'));
  assert.notEqual(secretRuntimeName('app', 'DATABASE_URL', 'v2', 'k'), secretRuntimeName('app', 'DATABASE_URL', 'v1', 'k'));
});

test('a runtime name above 64 characters is refused', () => {
  refused(() => secretRuntimeName('app', 'A'.repeat(60), 'v', 'k'), 'STACK_SECRET_NAME_TOO_LONG');
});

test('the version key comes from either variable and its absence is refused', () => {
  assert.equal(versionKeyOf({ env: { STARCI_SECRET_VERSION_KEY: 'fixture', SOPS_AGE_KEY: 'age' } }), 'fixture');
  assert.equal(versionKeyOf({ env: { SOPS_AGE_KEY: 'age' } }), 'age');
  assert.throws(() => versionKeyOf({ env: {} }), (error) => error.code === 'STACK_VERSION_KEY_MISSING' && error.message.includes('SOPS_AGE_KEY') && error.message.includes('STARCI_SECRET_VERSION_KEY'));
});

test('grants honour keys null, key lists, fill, required, exclusions and empty values', () => {
  const { config, ctx } = app();
  const sealed = loadSealed(ctx(), config);
  assert.deepEqual(sealed.grants.api, ['API_TOKEN', 'DATABASE_URL', 'SESSION_KEY', 'TOKEN']);
  assert.deepEqual(sealed.grants.worker, ['PROVIDER_KEY', 'TOKEN']);
  assert.equal(sealed.secrets.EXTRA_FILE, undefined);
  assert.equal(sealed.secrets.lower_case, undefined);
  assert.equal(sealed.secrets.EMPTY_ONE, undefined);
  assert.equal(sealed.secrets.TOKEN.value, MEMBERS.shared.TOKEN);
  assert.equal(sealed.secrets.TOKEN.runtimeName, expectedName('app', 'TOKEN', MEMBERS.shared.TOKEN, 'fixture-version-key'));
});

test('a secret key granted to two services with the same value is one shared secret', () => {
  const { config, ctx } = app();
  const sealed = loadSealed(ctx(), config);
  assert.equal(Object.keys(sealed.secrets).filter((key) => key === 'TOKEN').length, 1);
  assert.ok(sealed.grants.api.includes('TOKEN') && sealed.grants.worker.includes('TOKEN'));
});

test('fill never overrides an earlier source while a plain later source does', () => {
  const members = { ...MEMBERS, api: { ...MEMBERS.api, TOKEN: 'from-api-first' } };
  const filled = app({
    members,
    mutate: (deploy) => { deploy.secrets.grants = [{ service: 'api', from: [{ member: 'api' }, { member: 'shared', keys: ['TOKEN'], fill: true }] }]; },
  });
  assert.equal(loadSealed(filled.ctx(), filled.config).secrets.TOKEN.value, 'from-api-first');
  const overriding = app({
    members,
    mutate: (deploy) => { deploy.secrets.grants = [{ service: 'api', from: [{ member: 'api' }, { member: 'shared', keys: ['TOKEN'] }] }]; },
  });
  assert.equal(loadSealed(overriding.ctx(), overriding.config).secrets.TOKEN.value, MEMBERS.shared.TOKEN);
});

test('two grant entries of one service merge their keys', () => {
  const { config, ctx } = app({
    mutate: (deploy) => { deploy.secrets.grants = [{ service: 'api', from: [{ member: 'auth' }] }, { service: 'api', from: [{ member: 'web' }] }]; },
  });
  assert.deepEqual(loadSealed(ctx(), config).grants.api, ['PUBLIC_KEY', 'SESSION_KEY']);
});

test('different values for one key in two services are a conflict naming the key only', () => {
  const members = { ...MEMBERS, auth: { TOKEN: 'conflicting-value' } };
  const { config, ctx } = app({
    members,
    mutate: (deploy) => { deploy.secrets.grants = [{ service: 'api', from: [{ member: 'auth' }] }, { service: 'worker', from: [{ member: 'shared', keys: ['TOKEN'] }] }]; },
  });
  assert.throws(() => loadSealed(ctx(), config), (error) => {
    assert.equal(error.code, 'STACK_SECRET_CONFLICT');
    assert.match(error.message, /TOKEN.*api.*worker/u);
    assert.ok(!error.message.includes('conflicting-value') && !error.message.includes(MEMBERS.shared.TOKEN));
    return true;
  });
});

test('a required key that is absent or empty is refused naming member and key', () => {
  const { config, ctx } = app({ members: { ...MEMBERS, shared: { ...MEMBERS.shared, TOKEN: '' } } });
  assert.throws(() => loadSealed(ctx(), config), (error) => error.code === 'STACK_SECRET_MISSING' && error.message.includes('shared') && error.message.includes('TOKEN'));
});

test('a member that cannot be opened is refused naming the member', () => {
  const { config, ctx } = app();
  const broken = ctx({ sops: { decrypt() { throw new Error('boom with db-secret-value'); } } });
  assert.throws(() => openMember(broken, config, 'api'), (error) => error.code === 'STACK_SECRET_MEMBER_UNREADABLE' && error.message.includes('api') && !error.message.includes('db-secret-value'));
});

/** An environment whose per-user locations are an empty temp home, so no age identity exists on disk. */
function emptyHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-home-'));
  apps.push({ dispose: () => fs.rmSync(home, { recursive: true, force: true }) });
  return { USERPROFILE: home, HOME: home, APPDATA: path.join(home, 'AppData'), XDG_CONFIG_HOME: path.join(home, 'cfg') };
}

test('the age identity is found in SOPS_AGE_KEY, SOPS_AGE_KEY_FILE, the repository secret.env or the per-user keys.txt, and its absence is refused up front', () => {
  const { config, ctx } = app();
  const home = emptyHome();
  assert.equal(hasAgeIdentity(ctx({ env: home }), config), false);
  refused(() => requireAgeIdentity(ctx({ env: home }), config, 'build'), 'STACK_AGE_IDENTITY_MISSING');
  assert.throws(() => requireAgeIdentity(ctx({ env: home }), config, 'build'), (error) => error.message.includes('load the age identity into SOPS_AGE_KEY') && error.message.includes('build needs the sealed members'));
  assert.equal(hasAgeIdentity(ctx({ env: { ...home, SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE' } }), config), true);
  assert.equal(hasAgeIdentity(ctx({ env: { ...home, sops_age_key_file: '/keys/age.txt' } }), config), true);
  assert.equal(hasAgeIdentity(ctx({ env: { ...home, SOPS_AGE_KEY: '' } }), config), false, 'an empty value is no identity');
  assert.doesNotThrow(() => requireAgeIdentity(ctx({ env: { ...home, SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE' } }), config, 'build'));
  fs.mkdirSync(path.join(config.repoRoot, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(config.repoRoot, '.claude', 'secret.env'), 'SOPS_AGE_KEY=x');
  assert.equal(hasAgeIdentity(ctx({ env: home }), config), true);
  fs.rmSync(path.join(config.repoRoot, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(home.XDG_CONFIG_HOME, 'sops', 'age'), { recursive: true });
  fs.mkdirSync(path.join(home.APPDATA, 'sops', 'age'), { recursive: true });
  fs.writeFileSync(path.join(home.XDG_CONFIG_HOME, 'sops', 'age', 'keys.txt'), 'k');
  fs.writeFileSync(path.join(home.APPDATA, 'sops', 'age', 'keys.txt'), 'k');
  fs.mkdirSync(path.join(home.HOME, 'Library', 'Application Support', 'sops', 'age'), { recursive: true });
  fs.writeFileSync(path.join(home.HOME, 'Library', 'Application Support', 'sops', 'age', 'keys.txt'), 'k');
  assert.equal(hasAgeIdentity(ctx({ env: home }), config), true);
});

test('an unreadable member says to load the age identity when none is available, and to check the recipients when one is', () => {
  const { config, ctx } = app();
  const home = emptyHome();
  const decrypt = () => { throw new Error('boom'); };
  assert.throws(() => openMember(ctx({ env: home, sops: { decrypt } }), config, 'web'), (error) => error.code === 'STACK_SECRET_MEMBER_UNREADABLE' && error.message.includes('load the age identity into SOPS_AGE_KEY'));
  assert.throws(() => openMember(ctx({ env: { ...home, SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE' }, sops: { decrypt } }), config, 'web'), (error) => error.message.includes('recipient') && !error.message.includes('load the age identity'));
});

test('each member is opened once however many sources name it', () => {
  const { config, ctx, sops } = app();
  let opened = 0;
  const counting = { ...sops, decrypt: (file, format) => { opened += 1; return sops.decrypt(file, format); } };
  loadSealed(ctx({ sops: counting }), config);
  assert.equal(opened, 3);
});

test('settings keep the present plain values and refuse an unsafe one', () => {
  const { config, ctx } = app();
  assert.deepEqual(loadSealed(ctx(), config).settings, { MODEL: 'model-x', ALERT_MAX: '30' });
  for (const bad of ['a\nb', 'a"b', "a'b", String.raw`a\b`, 'a\rb']) {
    const unsafe = app({ members: { ...MEMBERS, shared: { ...MEMBERS.shared, MODEL: bad } } });
    refused(() => loadSealed(unsafe.ctx(), unsafe.config), 'STACK_SETTING_INVALID');
  }
});

test('a deploy block without settings yields no settings', () => {
  const { config, ctx } = app({ mutate: (deploy) => { delete deploy.secrets.settings; } });
  assert.deepEqual(loadSealed(ctx(), config).settings, {});
});

test('config objects are named by the digest of their file bytes', () => {
  const { config } = app();
  const [routes] = configObjects(config);
  assert.equal(routes.logical, 'routes');
  assert.equal(routes.env, 'APP_CFG_ROUTES');
  assert.equal(routes.name, `app-routes-c${crypto.createHash('sha256').update('routes: []\n').digest('hex').slice(0, 10)}`);
  assert.ok(routes.file.endsWith('routes.yml'));
  assert.equal(sha('x'), crypto.createHash('sha256').update('x').digest('hex'));
});

const CRLF = String.fromCharCode(13, 10);

test('line endings: CRLF text becomes LF, binary content and lone CR are left alone', () => {
  assert.equal(lfBytes(Buffer.from(`set -e${CRLF}echo ok${CRLF}`)).toString(), 'set -e\necho ok\n');
  const binary = Buffer.from([0, 13, 10, 255, 13, 10]);
  assert.equal(lfBytes(binary), binary);
  const plain = Buffer.from('already lf\n');
  assert.equal(lfBytes(plain), plain);
  assert.equal(lfBytes(Buffer.from('a\rb')).toString(), 'a\rb');
  assert.equal(lfText(`x${CRLF}y`), 'x\ny');
  assert.equal(isBinary(Buffer.from('text')), false);
});

test('a config rendered from a CRLF checkout has the same name and bytes as its LF twin', () => {
  const lf = app({ files: { 'infra/swarm/entry.sh': 'set -eu\necho go\n' } });
  const crlf = app({ files: { 'infra/swarm/entry.sh': `set -eu${CRLF}echo go${CRLF}` } });
  const only = (made) => made.config.configs.length;
  assert.equal(only(lf), only(crlf));
  const file = (made) => path.join(made.config.envDir, 'infra/swarm/entry.sh');
  assert.equal(configBytes(file(crlf)).toString(), 'set -eu\necho go\n');
  assert.equal(sha(configBytes(file(crlf))), sha(configBytes(file(lf))));
  const [routes] = configObjects(crlf.config);
  assert.equal(routes.name, configObjects(lf.config)[0].name, 'CRLF does not change the object name either');
});

test('a sealed secret value with CRLF is delivered with LF, a value with NUL is untouched', () => {
  const members = { ...MEMBERS, auth: { SESSION_KEY: `line1${CRLF}line2${CRLF}` } };
  const made = app({ members });
  const sealed = loadSealed(made.ctx(), made.config);
  assert.equal(sealed.secrets.SESSION_KEY.value, 'line1\nline2\n');
  const nul = app({ members: { ...MEMBERS, auth: { SESSION_KEY: `a\0${CRLF}b` } } });
  assert.equal(loadSealed(nul.ctx(), nul.config).secrets.SESSION_KEY.value, `a\0${CRLF}b`);
});
