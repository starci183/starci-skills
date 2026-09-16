import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadArchitectureConfig } from '../checks/architecture/config.mjs';
import { checkArchitecture } from '../checks/architecture.mjs';
import { checkFrontendDataLifecycle, SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID } from '../checks/architecture/next-data.mjs';
import { buildTypeScriptContext } from '../checks/architecture/typescript.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function write(root, relative, content) {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function lifecycleContract(overrides = {}) {
  return {
    schema: 'starci/next-data-lifecycle@1',
    swr: { package: 'swr', major: 2 },
    hooks: [
      { id: 'course-query', path: 'src/features/course/use-course.ts', export: 'useCourse', kind: 'query', resultBinding: 'query', identities: [
        { id: 'course', binding: 'params.courseId', gatesRequest: true, resource: true },
        { id: 'viewer', binding: 'viewer', gatesRequest: false, resource: false },
      ] },
      { id: 'course-mutation', path: 'src/features/course/use-course.ts', export: 'useCourse', kind: 'mutation', resultBinding: 'add', identities: [
        { id: 'course', binding: 'params.courseId', gatesRequest: true, resource: true },
      ] },
      { id: 'disabled-fixed-query', path: 'src/features/course/use-disabled.ts', export: 'useDisabled', kind: 'query', identities: [] },
    ],
    ...overrides,
  };
}

function fixture(t, { source, contract = lifecycleContract(), extra = {}, version = '2.3.8' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-data-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = {
    private: true,
    dependencies: { swr: `^${version}` },
    starci: { codePatterns: { next: { schema: 'starci/next-code-pattern-contract@1', owners: [], closedVocabularies: [],
      ...(contract === null ? {} : { dataLifecycle: contract }) } } },
  };
  const files = {
    'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'architecture.json': `${JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['frontend'], tsconfig: 'tsconfig.json' }, null, 2)}\n`,
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      jsx: 'react-jsx', skipLibCheck: true, noEmit: true }, include: ['src/**/*'] }),
    'node_modules/swr/package.json': JSON.stringify({ name: 'swr', version, types: './index.d.ts', exports: {
      '.': { types: './index.d.ts', default: './index.js' },
      './immutable': { types: './immutable.d.ts', default: './immutable.js' },
      './mutation': { types: './mutation.d.ts', default: './mutation.js' },
      './package.json': './package.json',
    } }),
    'node_modules/swr/index.d.ts': `
declare function useSWR<T=unknown>(key:unknown,fetcher?:unknown):{data:T,error?:unknown,mutate:(data?:T)=>Promise<T|undefined>};
export default useSWR;
export declare function mutate(key:unknown,data?:unknown,options?:unknown):Promise<unknown>;
export declare function useSWRConfig():{mutate:typeof mutate};
`,
    'node_modules/swr/immutable.d.ts': 'import useSWR from "./index"; export default useSWR;\n',
    'node_modules/swr/mutation.d.ts': 'export default function useSWRMutation<T=unknown>(key:unknown,fetcher?:unknown):{data:T,trigger:(arg?:unknown)=>Promise<T>};\n',
    'node_modules/swr/index.js': 'export default function useSWR(){}; export const mutate=()=>{}; export const useSWRConfig=()=>({mutate});\n',
    'node_modules/swr/immutable.js': 'export {default} from "./index.js";\n',
    'node_modules/swr/mutation.js': 'export default function useSWRMutation(){}\n',
    'src/shared/cache.ts': 'export {default as cache} from "swr"; export {default as mutateCache} from "swr/mutation";\n',
    'src/features/course/use-course.ts': source ?? `
import {cache,mutateCache} from '../../shared/cache';
const QUERY_COURSE='QUERY_COURSE', MUTATE_COURSE='MUTATE_COURSE';
const useViewerKey=():string|undefined=>'viewer';
export const useCourse=(params:{courseId?:string})=>{
  const viewer=useViewerKey();
  const query=cache(()=>params.courseId===undefined?null:[QUERY_COURSE,params.courseId,viewer??'guest'],async()=>null);
  const {trigger:add}=mutateCache(params.courseId===undefined?null:{operation:MUTATE_COURSE,courseId:params.courseId},async()=>null);
  return {query,add};
};
`,
    'src/features/course/use-disabled.ts': `import {cache} from '../../shared/cache'; export const useDisabled=()=>cache(null,async()=>null);\n`,
    ...extra,
  };
  for (const [relative, content] of Object.entries(files)) write(root, relative, content);
  return root;
}

function check(root) {
  const config = loadArchitectureConfig(root, 'architecture.json');
  const context = buildTypeScriptContext(config, ts);
  assert.deepEqual(context.errors, [], JSON.stringify(context.errors, null, 2));
  return checkFrontendDataLifecycle(config, context);
}

test('checks aliased SWR2 array/object keys, multiple selected calls, and a disabled fixed query', t => {
  const root = fixture(t);
  const result = check(root);
  assert.deepEqual(result.violations, [], JSON.stringify(result, null, 2));
  assert.deepEqual(result.coverage, { status: 'checked', ruleIds: [SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID], hooks: 3, calls: 3,
    swr: { name: 'swr', version: '2.3.8', major: 2 } });
  const integrated = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts });
  assert.deepEqual(integrated.coverage.frontendDataLifecycle, result.coverage);
  assert.ok(integrated.coverage.checkedRuleIds.includes(SWR_KEY_RULE_ID));
  assert.ok(integrated.coverage.checkedRuleIds.includes(SWR_MUTATION_RULE_ID));
});

test('reports missing result identity, unavailable-input null gate, and mutation resource identity', t => {
  const root = fixture(t, { source: `
import {cache,mutateCache} from '../../shared/cache';
const QUERY_COURSE='QUERY_COURSE', MUTATE_COURSE='MUTATE_COURSE';
const useViewerKey=():string|undefined=>'viewer';
export const useCourse=(params:{courseId?:string})=>{
  const viewer=useViewerKey();
  const query=cache(params.courseId===undefined?null:[QUERY_COURSE,params.courseId],async()=>null);
  const {trigger:add}=mutateCache({operation:MUTATE_COURSE},async()=>null);
  return {query,add,viewer};
};
`, extra: { 'src/features/course/use-disabled.ts': `import {cache} from '../../shared/cache'; export const useDisabled=()=>cache(false,async()=>null);\n` } });
  const result = check(root);
  assert.equal(result.coverage.status, 'checked', JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && item.identity === 'viewer'), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && /explicit null key/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === SWR_MUTATION_RULE_ID && item.identity === 'course'), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && /explicit null/.test(item.message)), JSON.stringify(result, null, 2));
});

test('makes coverage unavailable for omitted calls, ambiguous selectors, and dynamic keys', t => {
  const hooks = lifecycleContract().hooks.filter(entry => entry.id !== 'course-mutation').map(entry => entry.id === 'course-query'
    ? { ...entry, resultBinding: undefined } : entry);
  const omitted = check(fixture(t, { contract: lifecycleContract({ hooks }) }));
  assert.equal(omitted.coverage.status, 'unavailable');
  assert.ok(omitted.coverage.details.some(item => /select exactly one SWR call|not matched by exactly one/.test(item)), JSON.stringify(omitted, null, 2));

  const dynamic = check(fixture(t, { source: `
import {cache,mutateCache} from '../../shared/cache';
const buildKey=(id:string)=>['COURSE',id]; const useViewerKey=()=> 'viewer';
export const useCourse=(params:{courseId?:string})=>{const viewer=useViewerKey();const query=cache(params.courseId?buildKey(params.courseId):null);
const {trigger:add}=mutateCache(params.courseId?['MUTATE',params.courseId]:null);return {query,add,viewer}};
` }));
  assert.equal(dynamic.coverage.status, 'unavailable');
  assert.ok(dynamic.coverage.details.some(item => /dynamic SWR key/.test(item)), JSON.stringify(dynamic, null, 2));
});

test('does not certify missing metadata, installed-version drift, or global mutate resource bypasses', t => {
  const missing = check(fixture(t, { contract: null }));
  assert.equal(missing.coverage.status, 'unavailable');
  assert.deepEqual(missing.coverage.ruleIds, [SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID]);
  assert.ok(missing.coverage.details.some(item => /dataLifecycle is required/.test(item)));

  const drift = check(fixture(t, { contract: lifecycleContract({ swr: { package: 'swr', major: 3 } }) }));
  assert.equal(drift.coverage.status, 'unavailable');
  assert.ok(drift.coverage.details.some(item => /does not match declared major/.test(item)));

  const global = check(fixture(t, { extra: { 'src/features/course/reset-course.ts': `
import {mutate} from 'swr'; export const resetCourse=(courseId:string)=>mutate(['QUERY_COURSE',courseId]);
` } }));
  assert.equal(global.coverage.status, 'unavailable');
  assert.ok(global.coverage.details.some(item => /global mutate/.test(item)), JSON.stringify(global, null, 2));
});
