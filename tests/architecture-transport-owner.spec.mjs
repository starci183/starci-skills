import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

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
