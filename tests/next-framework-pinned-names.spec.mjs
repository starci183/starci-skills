// Supervisor ruling, nivo wf-nivo-fe-debt-mug06w7h inc-846867b9a34e: FE_SOURCE_NAME_SHAPE flagged
// `export const config = { matcher }` in src/middleware.ts. The export names Next.js mandates in a
// framework-pinned source-root file (knowledge/patterns/fe/folder.yaml FE-FOLDER-1
// frameworkPinnedRootExports) keep their framework spelling there, and only there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNextPatterns } from '../scripts/checks/code-patterns/next.mjs';
import { frameworkPinnedRootExports, frameworkPinnedRootFiles, frameworkMandatedExports } from '../scripts/checks/architecture/framework-pinned.mjs';

const require = createRequire(import.meta.url);

// The fixture reaches the installed TypeScript through a plain forwarding module, never a link.
function fixture(t, sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-pinned-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, value) => {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  write('node_modules/typescript/package.json', JSON.stringify({ name: 'typescript', version: require('typescript/package.json').version, main: 'index.js' }));
  write('node_modules/typescript/index.js', `module.exports = require(${JSON.stringify(require.resolve('typescript'))});\n`);
  write('package.json', '{"private":true}');
  write('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Node', jsx: 'preserve' },
    include: ['src/**/*.ts', 'src/**/*.tsx'] }));
  for (const [relative, value] of Object.entries(sources)) write(relative, value);
  const projects = ['tsconfig.json'];
  const architectureBytes = Buffer.from(JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['frontend'], projects }));
  fs.writeFileSync(path.join(root, 'architecture.json'), architectureBytes);
  return {
    root, files: Object.keys(sources).filter(relative => /\.tsx?$/.test(relative)).sort(), contextFiles: ['architecture.json', 'package.json'],
    architectureProjects: { schema: 'starci/typescript-project-selection@1', configPath: 'architecture.json',
      configDigest: crypto.createHash('sha256').update(architectureBytes).digest('hex'), projects },
  };
}

const ROUTE = { 'src/app/page.tsx': 'export default function Page(){return null}\n' };
const flagged = result => result.violations.filter(item => item.ruleId === 'FE_SOURCE_NAME_SHAPE').map(item => `${item.path}:${item.line}`).sort();

test('mandated export names are authored per pinned file stem in knowledge, proxy included', () => {
  const exported = frameworkPinnedRootExports();
  assert.deepEqual([...exported.get('middleware')].sort(), ['config', 'default', 'middleware']);
  assert.deepEqual([...exported.get('proxy')].sort(), ['config', 'default', 'proxy']);
  assert.deepEqual([...exported.get('instrumentation')].sort(), ['onRequestError', 'register']);
  assert.deepEqual([...exported.get('instrumentation-client')], ['onRouterTransitionStart']);
  for (const name of ['proxy.ts', 'proxy.js', 'proxy.mjs']) assert.ok(frameworkPinnedRootFiles().has(name), name);
});

test('framework-mandated exports in a pinned source-root file keep their framework spelling', t => {
  const context = fixture(t, {
    ...ROUTE,
    'src/middleware.ts': 'export const config = { matcher: ["/((?!api|_next).*)"] }\nexport default function middleware(){return null}\n',
    'src/proxy.ts': 'export const config = { matcher: ["/"] } as const\nexport const proxy = () => null\n',
    'src/instrumentation.ts': 'export const onRequestError = {} as const\nexport function register(){}\n',
    'src/instrumentation-client.ts': 'export const onRouterTransitionStart = [] as const\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(flagged(result), [], JSON.stringify(result.violations, null, 2));
  assert.deepEqual(result.checkedRuleIds, ['FE_SOURCE_NAME_SHAPE']);
  assert.deepEqual([...frameworkMandatedExports(path.join(context.root, 'src', 'middleware.ts'))].sort(), ['config', 'default', 'middleware']);
});

test('the name-shape rule is unchanged outside those names and files', t => {
  const context = fixture(t, {
    ...ROUTE,
    // not a mandated name for middleware
    'src/middleware.ts': 'export const matchers = ["/"] as const\nexport const register = {} as const\nexport const config = {}\n',
    // proxy mandates proxy, not middleware
    'src/proxy.ts': 'export const middleware = {} as const\n',
    // a pinned basename below the source root is an ordinary file
    'src/lib/middleware.ts': 'export const config = { matcher: ["/"] }\n',
    // the same name in any other file
    'src/modules/edge/matcher.ts': 'export const config = { matcher: ["/"] }\n',
    // an unexported declaration is not the framework export
    'src/instrumentation.ts': 'const register = {} as const\nexport function onRequestError(){ return register }\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(flagged(result), [
    'src/instrumentation.ts:1', 'src/lib/middleware.ts:1', 'src/middleware.ts:1', 'src/middleware.ts:2', 'src/modules/edge/matcher.ts:1', 'src/proxy.ts:1',
  ], JSON.stringify(result.violations, null, 2));
});

test('a source root is where app/ lives: without it a pinned basename is not pinned', t => {
  const context = fixture(t, { 'src/middleware.ts': 'export const config = { matcher: ["/"] }\n' });
  assert.equal(frameworkMandatedExports(path.join(context.root, 'src', 'middleware.ts')), null);
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(flagged(result), ['src/middleware.ts:1']);
});
