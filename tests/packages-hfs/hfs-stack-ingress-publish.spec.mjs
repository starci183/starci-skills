import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runIngress, hostsOfRule } from '../../packages/hfs/stack/ingress.mjs';
import { makeTree, DYNAMIC, SECRET_TOKENS } from '../helpers/stack-ingress-fakes.mjs';

const OLD_TOKEN = SECRET_TOKENS[0];
const NEW_TOKEN = 'SECRETTOKEN-2';
const rule = (host) => `Host(\`${host}\`)`;
const json = (value) => JSON.stringify(value);
const cert = (host) => `serial=BB${host.length}\nsubject=CN=${host}`;
const HOSTS = ['api.app.example', 'api.tenant.example', 'tool.example', 'www.tenant.example'];

const routers = (hosts) => Object.fromEntries(hosts.map((host) => [host.replaceAll('.', '-'), { rule: rule(host), service: 'app-api' }]));
const routesFile = (hosts, token) => ({
  http: {
    routers: routers(hosts),
    services: { 'app-api': { loadBalancer: { servers: [{ url: 'http://app-api:3000' }] } } },
    middlewares: { secure: { headers: { customRequestHeaders: { 'X-Token': token } } } },
  },
});
const OWN = routesFile(HOSTS, NEW_TOKEN);
const OLD_ROUTES = json(routesFile(['api.tenant.example', 'tool.example', 'www.tenant.example'], OLD_TOKEN));
const TENANTS = {
  'tayson.yml': json({ http: { routers: { 'tayson-web': { rule: rule('tayson.example'), service: 'tayson' } }, services: { tayson: {} } } }),
  'academy.yml': json({ http: { routers: { 'academy-api': { rule: rule('academy.example'), service: 'academy' } }, services: { academy: {} } } }),
};
const ALLOWED = new Set(['app.yml', 'app.yml.tmp', 'routes.yml', 'routes.yml.tmp']);

const trees = [];
const tree = (extra = {}, options = {}) => {
  const made = makeTree({ publish: { file: 'app.yml', supersedes: ['routes.yml'] }, ...extra }, { ownRoutes: OWN, ...options });
  trees.push(made);
  return made;
};
after(() => { for (const made of trees) made.cleanup(); });

const parseArgs = (command) => [...command.matchAll(/'((?:[^']|'\\'')*)'/gu)].map((match) => match[1].replaceAll(String.raw`'\''`, "'"));
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stderr = 'failed') => ({ status: 1, stdout: '', stderr });

/** A strict VPS for the publish action: file operations are simulated on `state.files`, anything outside the allowed names throws. */
function makeVps(overrides = {}) {
  const state = {
    files: { 'routes.yml': OLD_ROUTES, ...TENANTS },
    dirError: false,
    swarm: 'active true',
    ingressRow: '1/1',
    legacyRunning: 'false',
    stackRows: 'app_api 1/1\napp_n8n 1/1\n',
    stackFail: false,
    catFail: new Set(),
    fail: new Set(),
    table: Object.fromEntries(HOSTS.map((host) => [host, { code: host.startsWith('www') ? 301 : 200, cert: cert(host) }])),
    whenPublished: {},
    blackout: false,
    afterSwap: null,
    defaultCert: null,
    ...overrides,
  };
  const calls = [];
  const writes = [];
  const backups = [];
  const clock = { t: 1_700_000_000_000 };
  const hostsNow = () => Object.entries(state.files).filter(([name]) => /\.ya?ml$/u.test(name)).flatMap(([, body]) => {
    try { return Object.values(JSON.parse(body).http?.routers ?? {}).flatMap((router) => hostsOfRule(router.rule)); } catch { return []; }
  });
  const serving = (host) => {
    if (state.blackout || !hostsNow().includes(host) || !state.table[host]) return null;
    return { ...state.table[host], ...(Object.hasOwn(state.files, 'app.yml') && (!state.onlyNew || state.files['app.yml'].includes(NEW_TOKEN)) ? state.whenPublished[host] : {}) };
  };
  const guard = (target) => {
    const name = target.slice(DYNAMIC.length + 1);
    if (!target.startsWith(`${DYNAMIC}/`) || !ALLOWED.has(name)) throw new Error(`fake vps: forbidden path ${target}`);
    return name;
  };
  const operation = (part, input) => {
    const [first, second] = parseArgs(part);
    if (part.startsWith('umask')) return;
    if (part.startsWith('cat >')) { state.files[guard(first)] = input; writes.push(['write', first]); return; }
    if (part.startsWith('mv -f')) {
      state.files[guard(second)] = state.files[guard(first)];
      delete state.files[guard(first)];
      writes.push(['mv', first, second]);
      return;
    }
    if (part.startsWith('rm -f')) {
      for (const target of parseArgs(part)) { delete state.files[guard(target)]; writes.push(['rm', target]); }
      return;
    }
    throw new Error(`fake vps: unknown operation ${part}`);
  };
  const shell = (command, input) => {
    const script = command.slice("sh -c '".length, -1).replaceAll(String.raw`'\''`, "'");
    const forward = script.startsWith('mv') && !state.swapped;
    if (script.startsWith('mv')) state.swapped = true;
    if (script.startsWith('umask 022') && state.fail.has('upload') && !script.includes('routes.yml.tmp')) return bad('disk full');
    if (script.startsWith('umask 022') && state.fail.has('upload-restore') && script.includes('routes.yml.tmp')) return bad('disk full');
    if (script.startsWith('mv') && forward && state.fail.has('swap')) return bad('mv failed');
    if (script.startsWith('mv') && !forward && state.fail.has('swap-restore')) return bad('mv failed');
    for (const part of script.split(' && ')) operation(part, input);
    if (script.startsWith('mv') && forward) state.afterSwap?.(state);
    return ok();
  };
  const bash = (command, input) => {
    if (command.includes('openssl')) {
      const host = /-servername[^a-z0-9]+([a-z0-9.-]+)/u.exec(command)[1];
      const entry = serving(host);
      if (entry) return ok(`${entry.cert}\n`);
      return state.defaultCert ? ok(`${state.defaultCert}\n`) : bad('no certificate');
    }
    if (command.includes(' age ')) {
      if (state.fail.has('backup')) return bad('age: failed');
      if (state.fail.has('backup-previous') && command.includes('app.yml-')) return bad('age: failed');
      backups.push({ file: /-o '\\''([^']+)'\\''/u.exec(command)[1], input });
      return ok();
    }
    throw new Error(`fake vps: unknown script ${command}`);
  };
  const docker = (args) => {
    const key = args.slice(0, 2).join(' ');
    if (args[0] === 'info') return ok(`${state.swarm}\n`);
    if (key === 'service ls') return ok(`edge_ingress ${state.ingressRow}\n`);
    if (args[0] === 'inspect') return ok(`${state.legacyRunning}\n`);
    if (key === 'stack services') return state.stackFail ? bad('no such stack') : ok(state.stackRows);
    throw new Error(`fake vps: unknown docker command ${args.join(' ')}`);
  };
  const run = (command, options = {}) => {
    calls.push(command);
    if (command.startsWith(`cd '${DYNAMIC}' && for f in`)) {
      if (state.dirError) return bad('No such file or directory');
      return ok(Object.entries(state.files).filter(([name]) => /\.ya?ml$/u.test(name)).map(([name, body]) => `#@@FILE ${name}\n${body}\n`).join(''));
    }
    if (command.startsWith('cat -- ')) {
      const name = guard(parseArgs(command)[0]);
      return Object.hasOwn(state.files, name) && !state.catFail.has(name) ? ok(state.files[name]) : bad('No such file');
    }
    if (command.startsWith('sh -c ')) return shell(command, options.input);
    if (command.startsWith('bash -c ')) return bash(command, options.input);
    if (command.startsWith('docker ')) return docker(parseArgs(command));
    if (command.startsWith('curl ')) {
      const entry = serving(parseArgs(command)[4].split(':')[0]);
      return entry ? ok(String(entry.code)) : { status: 7, stdout: '000', stderr: 'connection refused' };
    }
    throw new Error(`fake vps: unknown command ${command}`);
  };
  const ctx = { now: () => clock.t, sleep: async () => { clock.t += 1000; } };
  return { run, state, calls, writes, backups, ctx };
}

const call = (vps, config, options = {}) => runIngress(vps.ctx, config, { action: 'publish', ...options }, { ssh: vps.run });
const text = (result) => result.lines.join('\n');
const refused = (promise, code) => assert.rejects(promise, (error) => error.code === code);

function assertTenantsUntouched(vps) {
  assert.equal(vps.state.files['tayson.yml'], TENANTS['tayson.yml']);
  assert.equal(vps.state.files['academy.yml'], TENANTS['academy.yml']);
  for (const command of vps.calls.filter((item) => /^(sh|bash) -c /u.test(item))) {
    assert.doesNotMatch(command, /tayson|academy/u, command);
  }
  for (const entry of vps.writes) for (const target of entry.slice(1)) assert.ok(ALLOWED.has(target.slice(DYNAMIC.length + 1)), target);
}

function assertNoSecrets(result) {
  const everything = JSON.stringify(result);
  for (const token of [OLD_TOKEN, NEW_TOKEN]) assert.ok(!everything.includes(token), `${token} leaked`);
}

test('publish is refused without a publish block or without a routes file', async () => {
  const noBlock = makeTree({});
  trees.push(noBlock);
  await refused(call(makeVps(), noBlock.config), 'STACK_INGRESS_PUBLISH_UNDECLARED');
  const noRoutes = tree({ routes: undefined, middlewares: { secure: {} } });
  await refused(call(makeVps(), noRoutes.config), 'STACK_INGRESS_PUBLISH_NO_ROUTES');
});

test('dry run: preconditions, baseline and plan, no write', async () => {
  const { config } = tree();
  const vps = makeVps();
  const result = await call(vps, config);
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /precondition ok: every service of the stack app is healthy/u);
  assert.match(text(result), /baseline api\.tenant\.example\/: status 200/u);
  assert.match(text(result), /baseline api\.app\.example\/: status 0/u);
  assert.match(text(result), /dry run: would back up routes\.yml \(age\) to \/srv\/deploy\/backups, upload app\.yml, swap it in, retire routes\.yml and verify 4 host\(s\)/u);
  assert.deepEqual(result.data.steps, ['preconditions', 'baseline']);
  assert.deepEqual(vps.writes, []);
  assert.deepEqual(vps.backups, []);
  assertNoSecrets(result);
});

test('dry run with nothing superseded on the host', async () => {
  const { config } = tree();
  const vps = makeVps({ files: { ...TENANTS } });
  const result = await call(vps, config);
  assert.match(text(result), /would back up no superseded file \(age\) to .*retire nothing/u);
});

const REFUSALS = [
  ['the routes file is not yaml', () => ({ extra: {}, own: 'a: [' }), {}, /precondition FAILED: edge\/routes\.yml parses with routers and services \(edge\/routes\.yml cannot be read as YAML\)/u],
  ['the routes file has no services map', () => ({ extra: {}, own: json({ http: { routers: {} } }) }), {}, /needs http\.routers and http\.services mappings/u],
  ['the directory cannot be read', () => ({ extra: {} }), { dirError: true }, /precondition FAILED: \/srv\/deploy\/app-edge\/dynamic is readable/u],
  ['a router name exists in a tenant file', () => ({ extra: {}, own: json({ http: { routers: { 'academy-api': { rule: rule('x.example') } }, services: {} } }) }), {}, /router academy-api \(academy\.yml\)/u],
  ['a service name exists in a tenant file', () => ({ extra: {}, own: json({ http: { routers: {}, services: { tayson: {} } } }) }), {}, /service tayson \(tayson\.yml\)/u],
  ['a tenant file cannot be checked', () => ({ extra: {} }), { files: { 'routes.yml': OLD_ROUTES, 'bad.yml': 'a: [' } }, /every other file of the directory can be checked \(not valid YAML: bad\.yml\)/u],
  ['swarm is not an active manager', () => ({ extra: {} }), { swarm: 'inactive false' }, /precondition FAILED: swarm active/u],
  ['the ingress service is not running', () => ({ extra: {} }), { ingressRow: '0/0' }, /precondition FAILED: ingress service edge_ingress is running \(run the takeover first\)/u],
  ['the ingress service has no running task', () => ({ extra: {} }), { ingressRow: '0/1' }, /ingress service edge_ingress is running/u],
  ['the old edge is still running', () => ({ extra: {} }), { legacyRunning: 'true' }, /precondition FAILED: old edge app-edge-proxy is not running/u],
  ['no service of the stack is listed', () => ({ extra: {} }), { stackRows: '' }, /precondition FAILED: every service of the stack app is healthy \(no service listed\)/u],
  ['a stack service has a missing task', () => ({ extra: {} }), { stackRows: 'app_api 1/1\napp_n8n 0/1\n' }, /not healthy: app_n8n/u],
  ['a stack service is scaled to zero', () => ({ extra: {} }), { stackRows: 'app_api 0/0\n' }, /not healthy: app_api/u],
  ['a stack row has no replicas', () => ({ extra: {} }), { stackRows: 'app_api\n' }, /not healthy: app_api/u],
  ['the stack listing fails', () => ({ extra: {} }), { stackFail: true }, /no service listed/u],
  ['there is no backup directory', () => ({ extra: { backup: undefined } }), {}, /precondition FAILED: age recipient and backup directory declared \(declare deploy\.ingress\.backup\)/u],
  ['there is no age recipient', () => ({ extra: {}, options: { recipient: false } }), {}, /age recipient and backup directory declared \(STACK_INGRESS_RECIPIENT/u],
];

for (const [title, setup, overrides, pattern] of REFUSALS) {
  test(`publish refuses and changes nothing: ${title}`, async () => {
    const { extra, own, options } = setup();
    const made = tree(extra, options);
    if (own !== undefined) fs.writeFileSync(path.join(made.config.envDir, 'edge', 'routes.yml'), own);
    const vps = makeVps(overrides);
    const result = await call(vps, made.config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /publish refused: nothing was changed/u);
    assert.deepEqual(vps.writes, []);
    assert.deepEqual(vps.backups, []);
  });
}

test('idempotent: nothing to do when the file is current and no superseded file exists', async () => {
  const { config } = tree();
  const own = fs.readFileSync(path.join(config.envDir, 'edge', 'routes.yml'), 'utf8');
  const vps = makeVps({ files: { 'app.yml': own, ...TENANTS } });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true);
  assert.match(text(result), /nothing to do: app\.yml is current and no superseded file exists/u);
  assert.deepEqual(vps.writes, []);
  assert.equal(result.data.changed, false);
});

test('execute: backup, upload, one swap, every host verified, tenants untouched, no secret printed', async () => {
  const { config } = tree();
  const vps = makeVps();
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.deepEqual(result.data.steps, ['preconditions', 'baseline', 'backup', 'upload', 'swap', 'verify']);
  assert.equal(vps.backups.length, 1);
  assert.match(vps.backups[0].file, /^\/srv\/deploy\/backups\/routes\.yml-20231114-221320\.age$/u);
  assert.equal(vps.backups[0].input, OLD_ROUTES);
  assert.deepEqual(vps.writes.map((entry) => entry[0]), ['write', 'mv', 'rm']);
  assert.equal(`${vps.writes[0][1]}`, `${DYNAMIC}/app.yml.tmp`);
  assert.ok(Object.hasOwn(vps.state.files, 'app.yml'));
  assert.ok(!Object.hasOwn(vps.state.files, 'routes.yml'));
  assert.ok(!Object.hasOwn(vps.state.files, 'app.yml.tmp'));
  assert.match(text(result), /ok api\.app\.example\/: status 200 \(baseline 0\), certificate serial new/u);
  assert.match(text(result), /ok api\.tenant\.example\/: status 200 \(baseline 200\), certificate serial equal/u);
  assert.match(text(result), /published app\.yml; retired routes\.yml; 4 host\(s\) verified/u);
  assert.equal(result.data.restored, null);
  assert.equal(result.data.hosts.length, 4);
  assertTenantsUntouched(vps);
  assertNoSecrets(result);
});

test('execute with no superseded file on the host publishes without a backup', async () => {
  const { config } = tree();
  const vps = makeVps({ files: { ...TENANTS } });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.deepEqual(vps.backups, []);
  assert.match(text(result), /published app\.yml; retired nothing; 4 host\(s\) verified/u);
});

test('a declared verify status is exact', async () => {
  const exact = tree({ verify: [{ host: 'api.tenant.example', path: '/health', status: 200 }] });
  const passing = await call(makeVps(), exact.config, { execute: true });
  assert.equal(passing.ok, true, text(passing));
  const wrong = tree({ verify: [{ host: 'api.tenant.example', path: '/health', status: 204 }] });
  const vps = makeVps();
  const failing = await call(vps, wrong.config, { execute: true });
  assert.equal(failing.ok, false);
  assert.match(text(failing), /MISMATCH api\.tenant\.example\/health: status 200/u);
  assert.match(text(failing), /RESTORED ok/u);
  assert.equal(vps.state.files['routes.yml'], OLD_ROUTES);
});

test('a backup that fails stops before any change', async () => {
  const { config } = tree();
  const vps = makeVps({ fail: new Set(['backup']) });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(text(result), /backup of routes\.yml FAILED: age: failed/u);
  assert.deepEqual(vps.writes, []);
});

test('a superseded file that vanishes between listing and reading is skipped', async () => {
  const { config } = tree();
  const vps = makeVps({ catFail: new Set(['routes.yml']) });
  const result = await call(vps, config, { execute: true });
  assert.deepEqual(vps.backups, []);
  assert.match(text(result), /backups written: none needed/u);
});

test('a failed upload changes nothing', async () => {
  const { config } = tree();
  const vps = makeVps({ fail: new Set(['upload']) });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(text(result), /uploading app\.yml\.tmp FAILED: disk full/u);
  assert.match(text(result), /publish refused: nothing was changed/u);
  assert.equal(vps.state.files['routes.yml'], OLD_ROUTES);
});

const RESTORES = [
  ['the swap fails', { fail: new Set(['swap']) }, /swap FAILED: mv failed/u],
  ['a host disappears', { hide: 'tool.example' }, /MISMATCH tool\.example\/: status 0/u],
  ['a certificate changes', { whenPublished: { 'tool.example': { cert: 'serial=ZZ' } } }, /MISMATCH tool\.example\/: status 200 \(baseline 200\), certificate serial different/u],
  ['the status class changes', { whenPublished: { 'www.tenant.example': { code: 502 } } }, /MISMATCH www\.tenant\.example\/: status 502/u],
  ['a new host answers 5xx', { whenPublished: { 'api.app.example': { code: 502 } } }, /MISMATCH api\.app\.example\/: status 502 \(baseline 0\)/u],
];

for (const [title, overrides, pattern] of RESTORES) {
  test(`automatic restore when ${title}`, async () => {
    let own = OWN;
    const { hide, ...state } = overrides;
    if (hide) own = routesFile(HOSTS.filter((host) => host !== hide), NEW_TOKEN);
    const made = tree();
    fs.writeFileSync(path.join(made.config.envDir, 'edge', 'routes.yml'), json(own));
    const vps = makeVps(state);
    const result = await call(vps, made.config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /RESTORED ok: the superseded files are back and every host answers as before/u);
    assert.equal(result.data.restored, 'ok');
    assert.equal(vps.state.files['routes.yml'], OLD_ROUTES);
    assert.ok(!Object.hasOwn(vps.state.files, 'app.yml'));
    assert.deepEqual(result.data.steps.slice(-3), ['verify', 'restore', 'restore-verify']);
    assertTenantsUntouched(vps);
    assertNoSecrets(result);
  });
}

const RESTORE_FAILURES = [
  ['the restore upload fails', { fail: new Set(['swap', 'upload-restore']) }],
  ['the restore swap fails', { fail: new Set(['swap-restore']), blackout: false, afterSwap: (state) => { state.table['tool.example'] = { code: 502, cert: 'x' }; } }],
  ['the baseline does not answer again', { afterSwap: (state) => { state.blackout = true; } }],
];

for (const [title, overrides] of RESTORE_FAILURES) {
  test(`RESTORE FAILED is reported with the backups: ${title}`, async () => {
    const { config } = tree();
    const vps = makeVps(overrides);
    const result = await call(vps, config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), /RESTORE FAILED \(manual: encrypted backups in \/srv\/deploy\/backups\)/u);
    assert.equal(result.data.restored, 'failed');
    assert.equal(vps.backups.length, 1);
  });
}

test('an empty routes file is refused as not having the mappings', async () => {
  const made = tree();
  fs.writeFileSync(path.join(made.config.envDir, 'edge', 'routes.yml'), '');
  const result = await call(makeVps(), made.config);
  assert.equal(result.ok, false);
  assert.match(text(result), /needs http\.routers and http\.services mappings/u);
});

test('empty and scalar tenant files cannot clash', async () => {
  const { config } = tree();
  const vps = makeVps({ files: { 'routes.yml': OLD_ROUTES, ...TENANTS, 'empty.yml': '', 'scalar.yml': '5' } });
  const result = await call(vps, config);
  assert.equal(result.ok, true, text(result));
});

// The 2026-10-16 production outage: a re-publish of an existing routes file that only ADDS a host. The edge answers an unrouted host with its default
// certificate (status 0 for curl, a certificate present), so the new host has a baseline certificate that must not be compared after the swap.
const OLD_OWN = json(routesFile(['api.tenant.example', 'tool.example', 'www.tenant.example'], OLD_TOKEN));
const republish = (overrides = {}) => makeVps({ files: { 'app.yml': OLD_OWN, ...TENANTS }, defaultCert: 'serial=DEFAULT\nsubject=CN=default', ...overrides });

test('re-publishing the existing file with only a new host passes: the new host is expected-new, its default certificate is not compared', async () => {
  const { config } = tree();
  const vps = republish();
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /ok api\.app\.example\/: status 200 \(baseline 0\), certificate serial new/u);
  assert.match(text(result), /ok api\.tenant\.example\/: status 200 \(baseline 200\), certificate serial equal/u);
  assert.equal(vps.state.files['app.yml'], json(OWN));
  assert.equal(result.data.restored, null);
});

test('the file about to be overwritten is backed up with age first, even when no superseded file exists', async () => {
  const { config } = tree();
  const vps = republish();
  const result = await call(vps, config, { execute: true });
  assert.equal(vps.backups.length, 1);
  assert.match(vps.backups[0].file, /^\/srv\/deploy\/backups\/app\.yml-20231114-221320\.age$/u);
  assert.equal(vps.backups[0].input, OLD_OWN);
  assert.doesNotMatch(text(result), /none needed/u);
  assert.ok(result.data.backups.some((file) => file.includes('app.yml-')));
  assert.deepEqual(result.data.steps.slice(0, 4), ['preconditions', 'baseline', 'backup', 'upload']);
});

test('a failed verification restores the previous published file, it never deletes it', async () => {
  const { config } = tree();
  const vps = republish({ onlyNew: true, whenPublished: { 'tool.example': { cert: 'serial=ZZ' } } });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(text(result), /MISMATCH tool\.example\/: status 200 \(baseline 200\), certificate serial different/u);
  assert.match(text(result), /RESTORED ok/u);
  assert.equal(result.data.restored, 'ok');
  assert.equal(vps.state.files['app.yml'], OLD_OWN, 'the previous file is back, byte for byte');
  assert.ok(!Object.hasOwn(vps.state.files, 'app.yml.tmp'));
  assert.deepEqual(result.data.steps.slice(-3), ['verify', 'restore', 'restore-verify']);
});

test('a failed swap with a previous file restores it together with the superseded one', async () => {
  const { config } = tree();
  const vps = republish({ files: { 'app.yml': OLD_OWN, 'routes.yml': OLD_ROUTES, ...TENANTS }, fail: new Set(['swap']) });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, false);
  assert.equal(vps.state.files['app.yml'], OLD_OWN);
  assert.equal(vps.state.files['routes.yml'], OLD_ROUTES);
  assert.equal(vps.backups.length, 2);
});

test('the new host is judged by its declared status and by answering over a valid certificate', async () => {
  const exact = tree({ verify: [{ host: 'api.app.example', path: '/', status: 200 }] });
  assert.equal((await call(republish(), exact.config, { execute: true })).ok, true);
  const wrong = tree({ verify: [{ host: 'api.app.example', path: '/', status: 204 }] });
  const failing = await call(republish(), wrong.config, { execute: true });
  assert.equal(failing.ok, false);
  assert.match(text(failing), /MISMATCH api\.app\.example\/: status 200/u);
  const noCertificate = await call(republish({ whenPublished: { 'api.app.example': { code: 0 } } }), tree().config, { execute: true });
  assert.equal(noCertificate.ok, false, 'a new host that does not answer is a failure');
});

test('a backup of the file about to be overwritten that fails stops before any change', async () => {
  const vps = republish({ fail: new Set(['backup-previous']) });
  const result = await call(vps, tree().config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(text(result), /backup of app.yml FAILED: age: failed/u);
  assert.deepEqual(vps.writes, []);
  assert.equal(vps.state.files['app.yml'], OLD_OWN);
});
