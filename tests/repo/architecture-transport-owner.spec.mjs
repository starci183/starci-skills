import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R50 transport-owner (FE_TRANSPORT_OWNER): the machine half of the eslint fetch rules. modules/api/client.ts is the one module
// of an app that references the global fetch (call, alias or value), no app file imports an HTTP library, and every server
// reader imports the client.
const API = 'apps/web/src/modules/api';
const CLIENT = 'export const client = { get: (url: string, signal: AbortSignal) => fetch(url, { signal }) };\n';
const READER = "import { client } from '../client';\nexport const readCourse = (id: string) => client.get(`/courses/${id}`, AbortSignal.timeout(8000));\n";
const GOOD = {
  [`${API}/client.ts`]: CLIENT,
  [`${API}/course/read-course.ts`]: READER,
  'apps/web/src/hooks/course/useCourse.ts': "import { readCourse } from '../../modules/api/course/read-course';\nexport const useCourse = (id: string) => readCourse(id);\n",
};
const hits = report => findings(report, 'FE_TRANSPORT_OWNER');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files: { ...GOOD, ...files } }));

test('a client that owns fetch, readers that import it and hooks that never touch it raise no FE_TRANSPORT_OWNER', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.transportOwner;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.apps, 1);
  assert.equal(coverage.readers, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_TRANSPORT_OWNER'));
});

test('a fetch call, globalThis.fetch and a fetch passed as a value outside the client are FE_TRANSPORT_OWNER', t => {
  const report = run(t, {
    'apps/web/src/hooks/course/useCalled.ts': "export const useCalled = () => fetch('/x');\n",
    'apps/web/src/hooks/course/useMember.ts': "export const useMember = () => globalThis.fetch('/x');\n",
    'apps/web/src/hooks/course/useAliased.ts': "const send = fetch;\nexport const useAliased = () => send('/x');\n",
    'apps/web/src/hooks/course/useSwr.ts': "declare function useSwr(key: string, fetcher: typeof fetch): unknown;\nexport const useSwrCourse = () => useSwr('/x', fetch);\n",
  });
  assert.deepEqual([...new Set(hits(report).map(item => item.path))].sort(), [
    'apps/web/src/hooks/course/useAliased.ts', 'apps/web/src/hooks/course/useCalled.ts', 'apps/web/src/hooks/course/useMember.ts', 'apps/web/src/hooks/course/useSwr.ts']);
});

test('a local function named fetch and a property named fetch are not the global transport', t => {
  const report = run(t, {
    'apps/web/src/hooks/course/useLocal.ts': "const fetch = (id: string) => id;\nexport const useLocal = () => fetch('1');\n",
    'apps/web/src/hooks/course/useType.ts': "export type Sender = typeof fetch;\nexport type Sent = ReturnType<typeof globalThis.fetch>;\n",
    'apps/web/src/hooks/course/useProperty.ts': "export const useProperty = (repo: { fetch: () => void }) => repo.fetch();\n",
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('an HTTP library imported, dynamically imported or required anywhere in the app is FE_TRANSPORT_OWNER', t => {
  const report = run(t, {
    'apps/web/src/hooks/course/useAxios.ts': "import axios from 'axios';\nexport const useAxios = () => axios;\n",
    'apps/web/src/hooks/course/useKy.ts': "export const useKy = () => import('ky');\n",
    [`${API}/course/read-got.ts`]: "declare function require(name: string): unknown;\nimport { client } from '../client';\nexport const readGot = () => [client, require('got')];\n",
  });
  assert.deepEqual(hits(report).map(item => item.library).sort(), ['axios', 'got', 'ky']);
});

test('a reader that does not import the client, and a client that never calls fetch, are FE_TRANSPORT_OWNER', t => {
  const report = run(t, {
    [`${API}/course/read-lonely.ts`]: 'export const readLonely = () => 1;\n',
    [`${API}/client.ts`]: 'export const client = { get: (url: string) => url };\n',
  });
  const messages = hits(report).map(item => `${item.path}: ${item.message}`);
  assert.ok(messages.some(text => /read-lonely\.ts: .*does not import/.test(text)), messages.join('\n'));
  assert.ok(messages.some(text => /client\.ts: .*never calls the global fetch/.test(text)), messages.join('\n'));
});

// Exactly ONE transport client and ONE Outcome union per repository, named by slot: the api package's, or the only app's.
const TWO_APPS = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];
const PKG = 'packages/shop-api';
const OUTCOME = "export type Outcome<T> = { kind: 'ok'; value: T } | { kind: 'refused' };\n";
const TSCONFIG = `${JSON.stringify({
  compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true, paths: { '@shop/api': [`${PKG}/src/index.ts`] } },
  include: ['src/**/*', 'apps/**/*', 'packages/**/*'],
}, null, 2)}\n`;
const PACKAGE = {
  'tsconfig.json': TSCONFIG,
  [`${PKG}/package.json`]: JSON.stringify({ name: '@shop/api', private: true }),
  [`${PKG}/tsconfig.json`]: '{}\n',
  [`${PKG}/src/index.ts`]: "export { client } from './client';\nexport type { Outcome } from './outcome';\n",
  [`${PKG}/src/client.ts`]: CLIENT,
  [`${PKG}/src/outcome.ts`]: OUTCOME,
};
const APP_READER = app => ({ [`apps/${app}/src/modules/api/course/read-course.ts`]: "import { client } from '@shop/api';\nexport const readCourse = (id: string) => client.get(`/courses/${id}`, AbortSignal.timeout(8000));\n" });
const runShape = (t, files, apps = TWO_APPS) => runArch(archFixture(t, { profile: 'fe', apps, declaration: { optionalSlots: ['fe.package.api'] }, files }));
const messages = report => hits(report).map(item => `${item.path}: ${item.message}`);

test('a two-app repository whose one client and one Outcome union live in the api package, with readers in the apps, raises no FE_TRANSPORT_OWNER', t => {
  const report = runShape(t, { ...PACKAGE, ...APP_READER('web'), ...APP_READER('admin') });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.transportOwner;
  assert.equal(coverage.clients, 1);
  assert.equal(coverage.outcomes, 1);
  assert.equal(coverage.readers, 2);
});

test('a one-app repository whose client and Outcome union are the app\'s own raises no FE_TRANSPORT_OWNER', t => {
  const report = run(t, { [`${API}/outcome.ts`]: OUTCOME });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.transportOwner.outcomes, 1);
});

test('two apps that each keep their own client are FE_TRANSPORT_OWNER on both clients', t => {
  const report = runShape(t, { 'apps/web/src/modules/api/client.ts': CLIENT, 'apps/admin/src/modules/api/client.ts': CLIENT });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/admin/src/modules/api/client.ts', 'apps/web/src/modules/api/client.ts']);
  assert.match(messages(report)[0], /2 transport clients/);
});

test('a package client next to an app client is FE_TRANSPORT_OWNER on both', t => {
  const report = runShape(t, { ...PACKAGE, 'apps/web/src/modules/api/client.ts': CLIENT }, [TWO_APPS[0]]);
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/web/src/modules/api/client.ts', `${PKG}/src/client.ts`]);
});

test('two apps that keep one app client, with no package, are FE_TRANSPORT_OWNER: the shared client belongs to the package', t => {
  const report = runShape(t, { 'apps/web/src/modules/api/client.ts': CLIENT });
  assert.deepEqual(hits(report).map(item => item.path), ['apps/web/src/modules/api/client.ts']);
  assert.match(messages(report)[0], /repository of 2 apps/);
});

test('two Outcome unions (a package one and an app one), or an app one in a two-app repository, are FE_TRANSPORT_OWNER', t => {
  const twice = runShape(t, { ...PACKAGE, 'apps/web/src/modules/api/outcome.ts': OUTCOME }, [TWO_APPS[0]]);
  assert.deepEqual(hits(twice).map(item => item.path).sort(), ['apps/web/src/modules/api/outcome.ts', `${PKG}/src/outcome.ts`]);
  const shared = runShape(t, { ...PACKAGE, 'apps/admin/src/modules/api/outcome.ts': OUTCOME });
  assert.deepEqual(hits(shared).map(item => item.path).sort(), ['apps/admin/src/modules/api/outcome.ts', `${PKG}/src/outcome.ts`]);
});

test('a module that fetches in a repository with no client is FE_TRANSPORT_OWNER and says the repository has no client', t => {
  const report = runShape(t, { 'apps/web/src/hooks/course/useCalled.ts': "export const useCalled = () => fetch('/x');\n" });
  assert.equal(hits(report).length, 1);
  assert.match(messages(report)[0], /no transport client/);
});

test('a repository with no client and no fetch has nothing to own and raises no FE_TRANSPORT_OWNER', t => {
  const report = runShape(t, { 'apps/web/src/hooks/course/useNothing.ts': 'export const useNothing = () => 1;\n' });
  assert.deepEqual(hits(report), []);
});

test('a fetch outside the package client in a package-client repository is FE_TRANSPORT_OWNER, the client itself is not', t => {
  const report = runShape(t, { ...PACKAGE, 'apps/admin/src/hooks/course/useCalled.ts': "export const useCalled = () => fetch('/x');\n" });
  assert.deepEqual(hits(report).map(item => item.path), ['apps/admin/src/hooks/course/useCalled.ts']);
});

// The Outcome homes are the slots the manifest marks `outcomeHome`; the lite edition adds fe.modules.db.outcome (modules/db/outcome.ts).
const DB_OUTCOME = 'apps/web/src/modules/db/outcome.ts';
const runEdition = (t, edition, files) => {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  if (edition) declaration.edition = edition;
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return runArch(archFixture(t, { profile: 'fe', files: { '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`, 'apps/web/src/modules/db/index.ts': 'export const db = 1;\n', ...files } }));
};

test('lite: the db owner outcome is THE Outcome union (counted), alone it raises no FE_TRANSPORT_OWNER', t => {
  const report = runEdition(t, 'lite', { [DB_OUTCOME]: OUTCOME });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.transportOwner.outcomes, 1);
});

test('lite: a second Outcome union next to the db owner one is FE_TRANSPORT_OWNER on both', t => {
  const report = runEdition(t, 'lite', { [DB_OUTCOME]: OUTCOME, [`${API}/outcome.ts`]: OUTCOME });
  assert.deepEqual(hits(report).map(item => item.path).sort(), [DB_OUTCOME, `${API}/outcome.ts`].sort());
  assert.match(messages(report)[0], /2 Outcome unions/);
});

test('full: modules/db/outcome.ts is plain db owner content, not an Outcome home, so the one api outcome raises no FE_TRANSPORT_OWNER', t => {
  const report = runEdition(t, null, { [DB_OUTCOME]: OUTCOME, [`${API}/outcome.ts`]: OUTCOME });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.transportOwner.outcomes, 1);
});
