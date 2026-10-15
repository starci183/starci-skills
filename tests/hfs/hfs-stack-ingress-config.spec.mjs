import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIngress } from '../../scripts/hfs/stack-ingress-config.mjs';

const probe = { exists: (rel) => rel === 'edge/routes.yml' };

const valid = () => ({
  network: 'edge-shared',
  acmeVolume: 'edge_acme',
  legacy: { dir: '/home/deploy/app-edge', dynamicDir: '/home/deploy/app-edge/dynamic', container: 'app-edge-proxy' },
  upstreams: [
    { name: 'tenant-api', hosts: ['api.tenant.example'], container: 'tenant-api', port: 3000, middlewares: ['secure'] },
    { name: 'tool', hosts: ['tool.example'], hostAddress: '172.29.0.1', port: 5678 },
  ],
  middlewares: { secure: { headers: { stsSeconds: 1 } } },
  verify: [{ host: 'api.tenant.example', path: '/health', status: 200 }, { host: 'tool.example' }],
  drop: ['old.example'],
  redirects: [{ host: 'www.example.org', to: 'example.org' }, { host: 'a.example.org', to: 'b.example.org', status: 308 }],
  backup: { dir: '/home/deploy/backups' },
  takeover: { gateSeconds: 20 },
});

const problemsOf = (mutate, options = probe) => {
  const block = valid();
  mutate(block);
  const out = normalizeIngress(block, { probe: options });
  return out.problems.map((item) => `${item.at}: ${item.message}`).join('\n');
};

test('an absent block is no ingress and no problem', () => {
  assert.deepEqual(normalizeIngress(undefined, { probe }), { ingress: null, problems: [] });
});

test('a valid block is normalised with defaults', () => {
  const { ingress, problems } = normalizeIngress(valid(), { probe });
  assert.deepEqual(problems, []);
  assert.equal(ingress.name, 'ingress');
  assert.equal(ingress.service, 'ingress');
  assert.deepEqual(ingress.upstreams[0].aliases, ['tenant-api']);
  assert.deepEqual(ingress.upstreams[1], { name: 'tool', hosts: ['tool.example'], container: null, hostAddress: '172.29.0.1', port: 5678, aliases: [], middlewares: [] });
  assert.deepEqual(ingress.verify[1], { host: 'tool.example', path: '/', status: null });
  assert.deepEqual(ingress.redirects.map((item) => item.status), [301, 308]);
  assert.deepEqual(ingress.takeover, { gateSeconds: 20 });
});

test('minimal block: no optional fields', () => {
  const { ingress } = normalizeIngress({ network: 'n1', acmeVolume: 'v1', name: 'edge', service: 'proxy', legacy: valid().legacy, routes: 'edge/routes.yml' }, { probe });
  assert.equal(ingress.name, 'edge');
  assert.equal(ingress.routes, 'edge/routes.yml');
  assert.deepEqual(ingress.upstreams, []);
  assert.equal(ingress.backup, null);
  assert.deepEqual(ingress.takeover, { gateSeconds: 30 });
});

test('a block that is not a mapping, and unknown fields', () => {
  assert.match(normalizeIngress('x', { probe }).problems[0].message, /mapping/u);
  assert.match(problemsOf((b) => { b.extra = 1; }), /deploy\.ingress\.extra: is not a field/u);
});

test('names, network and volume patterns', () => {
  assert.match(problemsOf((b) => { b.network = '-bad'; }), /network: must match/u);
  assert.match(problemsOf((b) => { b.acmeVolume = 5; }), /acmeVolume: must match/u);
  assert.match(problemsOf((b) => { b.name = 'Bad'; }), /deploy\.ingress\.name: must match/u);
  assert.match(problemsOf((b) => { b.service = 'Bad'; }), /deploy\.ingress\.service: must match/u);
});

test('legacy paths and container', () => {
  assert.match(problemsOf((b) => { b.legacy = 'x'; }), /legacy: must be a mapping/u);
  assert.match(problemsOf((b) => { b.legacy.dir = 'relative'; }), /legacy\.dir: must be an absolute path/u);
  assert.match(problemsOf((b) => { b.legacy.dynamicDir = '/a/../b'; }), /dynamicDir: must be an absolute path/u);
  assert.match(problemsOf((b) => { b.legacy.dynamicDir = 7; }), /dynamicDir: must be an absolute path/u);
  assert.match(problemsOf((b) => { b.legacy.container = 'a b'; }), /container: must match/u);
});

test('upstream fields', () => {
  assert.match(problemsOf((b) => { b.upstreams = []; }), /upstreams: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.upstreams = 'x'; }), /upstreams: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.upstreams[0] = 'x'; }), /upstreams\[0\]: must be a mapping/u);
  assert.match(problemsOf((b) => { b.upstreams[0].name = 'Bad'; }), /name: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[0].port = 0; }), /port: must be a port/u);
  assert.match(problemsOf((b) => { b.upstreams[0].port = 70000; }), /port: must be a port/u);
  assert.match(problemsOf((b) => { b.upstreams[0].hosts = ['https://x.example']; }), /hosts\[0\]: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[0].hosts = ['Upper.example']; }), /hosts\[0\]: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[0].hosts = []; }), /hosts: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.upstreams[0].container = 'a b'; }), /container: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[0].aliases = []; }), /aliases: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.upstreams[0].aliases = ['bad alias']; }), /aliases\[0\]: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[0].middlewares = ['Bad']; }), /middlewares\[0\]: must match/u);
});

test('container versus host address', () => {
  assert.match(problemsOf((b) => { delete b.upstreams[0].container; }), /exactly one of container and hostAddress/u);
  assert.match(problemsOf((b) => { b.upstreams[0].hostAddress = '172.29.0.1'; }), /exactly one of container and hostAddress/u);
  assert.match(problemsOf((b) => { b.upstreams[1].hostAddress = '999.1.1.1'; }), /hostAddress: must match/u);
  assert.match(problemsOf((b) => { b.upstreams[1].aliases = ['x']; }), /aliases: a hostAddress upstream has no alias/u);
});

test('duplicates: name, host and alias', () => {
  assert.match(problemsOf((b) => { b.upstreams[1].name = 'tenant-api'; }), /upstream name tenant-api is declared more than once/u);
  assert.match(problemsOf((b) => { b.upstreams[1].hosts = ['api.tenant.example']; }), /host api\.tenant\.example is declared more than once/u);
  assert.match(problemsOf((b) => {
    b.upstreams[1] = { name: 'other', hosts: ['o.example'], container: 'other', port: 1, aliases: ['tenant-api'] };
  }), /alias \(aliases must be unique on the shared overlay\) tenant-api is declared more than once/u);
});

test('middlewares: declared map and references', () => {
  assert.match(problemsOf((b) => { b.middlewares = 'x'; }), /middlewares: must be a mapping of name/u);
  assert.match(problemsOf((b) => { b.middlewares.Bad = {}; }), /middlewares\.Bad: must match/u);
  assert.match(problemsOf((b) => { b.middlewares.secure = 'x'; }), /middlewares\.secure: must be a mapping/u);
  assert.match(problemsOf((b) => { delete b.middlewares; }), /middleware secure is not declared/u);
});

test('a routes file defers middleware references to the plan and must exist in the tree', () => {
  assert.equal(problemsOf((b) => { delete b.middlewares; b.routes = 'edge/routes.yml'; }), '');
  assert.match(problemsOf((b) => { b.routes = 'edge/missing.yml'; }), /does not exist under the environment directory/u);
  assert.match(problemsOf((b) => { b.routes = '../x.yml'; }), /relative path inside the environment directory/u);
  assert.match(problemsOf((b) => { b.routes = '/abs.yml'; }), /relative path/u);
  assert.match(problemsOf((b) => { b.routes = String.raw`a\b.yml`; }), /relative path/u);
  assert.match(problemsOf((b) => { b.routes = ''; }), /relative path/u);
  assert.match(problemsOf((b) => { b.routes = 4; }), /relative path/u);
});

test('verify entries', () => {
  assert.match(problemsOf((b) => { b.verify = []; }), /verify: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.verify[0] = 'x'; }), /verify\[0\]: must be a mapping/u);
  assert.match(problemsOf((b) => { b.verify[0].host = 'x'; }), /verify\[0\]\.host: must match/u);
  assert.match(problemsOf((b) => { b.verify[0].path = 'no-slash'; }), /verify\[0\]\.path: must match/u);
  assert.match(problemsOf((b) => { b.verify[0].status = 99; }), /status: must be an HTTP status code/u);
  assert.match(problemsOf((b) => { b.verify[0].status = 'ok'; }), /status: must be an HTTP status code/u);
});

test('drop and redirects', () => {
  assert.match(problemsOf((b) => { b.drop = []; }), /drop: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.drop = ['Bad']; }), /drop\[0\]: must match/u);
  assert.match(problemsOf((b) => { b.redirects = []; }), /redirects: must be a non-empty list/u);
  assert.match(problemsOf((b) => { b.redirects[0] = 'x'; }), /redirects\[0\]: must be a mapping/u);
  assert.match(problemsOf((b) => { b.redirects[0].host = 'x'; }), /redirects\[0\]\.host: must match/u);
  assert.match(problemsOf((b) => { b.redirects[0].to = 'x'; }), /redirects\[0\]\.to: must match/u);
  assert.match(problemsOf((b) => { b.redirects[0].status = 200; }), /status: must be one of 301/u);
});

test('backup and takeover', () => {
  assert.match(problemsOf((b) => { b.backup = 'x'; }), /backup: must be a mapping/u);
  assert.match(problemsOf((b) => { b.backup.dir = 'relative'; }), /backup\.dir: must be an absolute path/u);
  assert.match(problemsOf((b) => { b.takeover = 'x'; }), /takeover: must be a mapping/u);
  assert.match(problemsOf((b) => { b.takeover.gateSeconds = 0; }), /gateSeconds: must be a whole number/u);
  assert.match(problemsOf((b) => { b.takeover.gateSeconds = 301; }), /gateSeconds: must be a whole number/u);
  const { ingress } = normalizeIngress({ ...valid(), takeover: {} }, { probe });
  assert.deepEqual(ingress.takeover, { gateSeconds: 30 });
});

test('a block with problems yields no ingress', () => {
  const out = normalizeIngress({ ...valid(), network: '!' }, { probe });
  assert.equal(out.ingress, null);
  assert.equal(out.problems.length, 1);
});
