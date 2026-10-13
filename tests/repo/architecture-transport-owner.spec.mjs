import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R50 transport-owner (FE_TRANSPORT_OWNER): the browser calls the back end through Apollo GraphQL and axios (owner ruling
// 2026-10-13). modules/api/graphql/clients/ is the one Apollo client folder of an app (the only place the global fetch and
// `new ApolloClient` appear), modules/api/graphql/types.ts the one GraphQLResponse union, axios lives only in the api owner, and
// every GraphQL operation imports the client.
const API = 'apps/web/src/modules/api';
const CLIENT = "import { ApolloClient } from '@apollo/client';\nexport const authClient = new ApolloClient({ uri: '/graphql', fetch: (input: string) => fetch(input) });\n";
const OUTCOME = 'export type GraphQLResponse<T> = { success: boolean; message: string; error?: string; data?: T };\n';
const QUERY = "import { authClient } from '../clients';\nexport const queryCourse = (id: string) => authClient.query({ query: id });\n";
const REST = "import axios from 'axios';\nexport const presign = (name: string) => axios.post('/uploads', { name });\n";
const GOOD = {
  [`${API}/graphql/clients/index.ts`]: CLIENT,
  [`${API}/graphql/types.ts`]: OUTCOME,
  [`${API}/graphql/queries/query-course.ts`]: QUERY,
  [`${API}/rest/uploads/presign.ts`]: REST,
  'apps/web/src/hooks/course/useCourse.ts': "import { queryCourse } from '../../modules/api/graphql/queries/query-course';\nexport const useCourse = (id: string) => queryCourse(id);\n",
};
const hits = report => findings(report, 'FE_TRANSPORT_OWNER');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files: { ...GOOD, ...files } }));
const messages = report => hits(report).map(item => `${item.path}: ${item.message}`);

test('one Apollo client folder, one GraphQLResponse union, an operation that imports the client and axios inside modules/api/rest raise no FE_TRANSPORT_OWNER', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.transportOwner;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.apps, 1);
  assert.equal(coverage.operations, 1);
  assert.equal(coverage.clients, 1);
  assert.equal(coverage.outcomes, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_TRANSPORT_OWNER'));
});

test('several files of one client folder (clients, links) are one client, and fetch inside the folder is the client\'s own', t => {
  const report = run(t, {
    [`${API}/graphql/clients/links/http.ts`]: "export const httpFetch = (input: string) => globalThis.fetch(input);\n",
    [`${API}/graphql/clients/clients/no-auth.ts`]: "import { ApolloClient } from '@apollo/client';\nexport const noAuthClient = new ApolloClient({ uri: '/graphql' });\n",
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.transportOwner.clients, 1);
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

test('axios outside the api owner, and any other HTTP library anywhere (import, import() or require), are FE_TRANSPORT_OWNER', t => {
  const report = run(t, {
    'apps/web/src/hooks/course/useAxios.ts': "import axios from 'axios';\nexport const useAxios = () => axios;\n",
    'apps/web/src/hooks/course/useKy.ts': "export const useKy = () => import('ky');\n",
    [`${API}/rest/uploads/got.ts`]: "declare function require(name: string): unknown;\nexport const viaGot = () => require('got');\n",
  });
  assert.deepEqual(hits(report).map(item => item.library).sort(), ['axios', 'got', 'ky']);
  assert.equal(hits(report).some(item => item.path === `${API}/rest/uploads/presign.ts`), false, 'axios inside modules/api/rest is the rest transport');
});

test('an operation that does not import the client, and an ApolloClient constructed outside the client folder, are FE_TRANSPORT_OWNER', t => {
  const report = run(t, {
    [`${API}/graphql/mutations/mutation-lonely.ts`]: 'export const mutationLonely = () => 1;\n',
    'apps/web/src/hooks/course/useOwnClient.ts': "import { ApolloClient } from '@apollo/client';\nexport const useOwnClient = () => new ApolloClient({ uri: '/graphql' });\n",
  });
  const found = messages(report);
  assert.ok(found.some(text => /mutation-lonely\.ts: .*does not import the transport client/.test(text)), found.join('\n'));
  assert.ok(found.some(text => /useOwnClient\.ts: .*constructs an ApolloClient outside/.test(text)), found.join('\n'));
});

// Exactly ONE client folder and ONE GraphQLResponse union per repository, named by slot: the api package's, or the only app's.
const TWO_APPS = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];
const PKG = 'packages/shop-api';
const TSCONFIG = `${JSON.stringify({
  compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true, paths: { '@shop/api': [`${PKG}/src/index.ts`] } },
  include: ['src/**/*', 'apps/**/*', 'packages/**/*'],
}, null, 2)}\n`;
const PACKAGE = {
  'tsconfig.json': TSCONFIG,
  [`${PKG}/package.json`]: JSON.stringify({ name: '@shop/api', private: true }),
  [`${PKG}/tsconfig.json`]: '{}\n',
  [`${PKG}/src/index.ts`]: "export { authClient } from './graphql/clients';\nexport type { GraphQLResponse } from './graphql/types';\n",
  [`${PKG}/src/graphql/clients/index.ts`]: CLIENT,
  [`${PKG}/src/graphql/types.ts`]: OUTCOME,
};
const APP_OPERATION = app => ({ [`apps/${app}/src/modules/api/graphql/queries/query-course.ts`]: "import { authClient } from '@shop/api';\nexport const queryCourse = (id: string) => authClient.query({ query: id });\n" });
const runShape = (t, files, apps = TWO_APPS) => runArch(archFixture(t, { profile: 'fe', apps, declaration: { optionalSlots: ['fe.package.api'] }, files }));

test('a two-app repository whose one client folder and one union live in the api package, with operations in the apps, raises no FE_TRANSPORT_OWNER', t => {
  const report = runShape(t, { ...PACKAGE, ...APP_OPERATION('web'), ...APP_OPERATION('admin') });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.transportOwner;
  assert.equal(coverage.clients, 1);
  assert.equal(coverage.outcomes, 1);
  assert.equal(coverage.operations, 2);
});

test('two apps that each keep their own client folder are FE_TRANSPORT_OWNER on both', t => {
  const report = runShape(t, { 'apps/web/src/modules/api/graphql/clients/index.ts': CLIENT, 'apps/admin/src/modules/api/graphql/clients/index.ts': CLIENT });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/admin/src/modules/api/graphql/clients/index.ts', 'apps/web/src/modules/api/graphql/clients/index.ts']);
  assert.match(messages(report)[0], /2 transport clients/);
});

test('a package client folder next to an app client folder is FE_TRANSPORT_OWNER on both', t => {
  const report = runShape(t, { ...PACKAGE, 'apps/web/src/modules/api/graphql/clients/index.ts': CLIENT }, [TWO_APPS[0]]);
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/web/src/modules/api/graphql/clients/index.ts', `${PKG}/src/graphql/clients/index.ts`]);
});

test('two apps that both call the back end, one app client folder and no package, are FE_TRANSPORT_OWNER: the shared client belongs to the package', t => {
  const report = runShape(t, { 'apps/web/src/modules/api/graphql/clients/index.ts': CLIENT, 'apps/admin/src/modules/api/index.ts': 'export type Course = { readonly id: string };\n' });
  assert.deepEqual(hits(report).map(item => item.path), ['apps/web/src/modules/api/graphql/clients/index.ts']);
  assert.match(messages(report)[0], /repository of 2 apps that call the back end \(web, admin\)/);
});

test('an app client folder and union beside an app that calls no back end (a marketing landing) raise no FE_TRANSPORT_OWNER', t => {
  const report = runShape(t, {
    'apps/web/src/modules/api/graphql/clients/index.ts': CLIENT,
    'apps/web/src/modules/api/graphql/types.ts': OUTCOME,
    'apps/admin/src/hooks/course/useNothing.ts': 'export const useNothing = () => 1;\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('two GraphQLResponse unions (a package one and an app one), or an app one in a two-app repository, are FE_TRANSPORT_OWNER', t => {
  const twice = runShape(t, { ...PACKAGE, 'apps/web/src/modules/api/graphql/types.ts': OUTCOME }, [TWO_APPS[0]]);
  assert.deepEqual(hits(twice).map(item => item.path).sort(), ['apps/web/src/modules/api/graphql/types.ts', `${PKG}/src/graphql/types.ts`]);
  const shared = runShape(t, { ...PACKAGE, 'apps/admin/src/modules/api/graphql/types.ts': OUTCOME });
  assert.deepEqual(hits(shared).map(item => item.path).sort(), ['apps/admin/src/modules/api/graphql/types.ts', `${PKG}/src/graphql/types.ts`]);
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

test('a fetch outside the package client folder in a package-client repository is FE_TRANSPORT_OWNER, the client itself is not', t => {
  const report = runShape(t, { ...PACKAGE, 'apps/admin/src/hooks/course/useCalled.ts': "export const useCalled = () => fetch('/x');\n" });
  assert.deepEqual(hits(report).map(item => item.path), ['apps/admin/src/hooks/course/useCalled.ts']);
});

test('lite judges the transport exactly as full: the same client folder and union raise nothing, a fetch outside the client is a finding', t => {
  const lite = (files) => {
    const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
    declaration.edition = 'lite';
    declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
    return runArch(archFixture(t, { profile: 'fe', files: { ...GOOD, '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`, ...files } }));
  };
  const clean = lite({});
  assert.deepEqual(hits(clean), [], JSON.stringify(hits(clean), null, 1));
  assert.equal(clean.coverage.hfsMachine.transportOwner.outcomes, 1);
  const fetching = lite({ 'apps/web/src/hooks/course/useCalled.ts': "export const useCalled = () => fetch('/x');\n" });
  assert.deepEqual(hits(fetching).map(item => item.path), ['apps/web/src/hooks/course/useCalled.ts']);
});
