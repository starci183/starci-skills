// proves: FE_SWR_KEY_IDENTITY@lite FE_SWR_KEY_IDENTITY@full
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { checkFrontendDataLifecycle, SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID } from '../../scripts/hfs/architecture/next-data.mjs';
import { appDeclaration, tempSide, ts, writeFiles } from '../helpers/hfs-arch-fixture.mjs';

const sourcePath = 'apps/web/src/hooks/swr/use-item.ts';
const header = `import useSWR from 'swr';
const CONSTANT_KEY='item';
const op=(input:unknown)=>Promise.resolve(input);
`;

function fixture(t, edition, source, contract, extra = {}) {
  const root = tempSide(t, 'starci-swr-armed-', 'fe');
  const manifest = { private: true, dependencies: { swr: '2.3.8' }, ...(contract ? {
    starci: { codePatterns: { next: { schema: 'starci/next-code-pattern-contract@1', dataLifecycle: contract } } },
  } : {}) };
  writeFiles(root, {
    '../package.json': JSON.stringify(manifest),
    '../hfs.json': JSON.stringify({ ...appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] }), edition }),
    '../node_modules/swr/package.json': JSON.stringify({ name: 'swr', version: '2.3.8', main: 'index.js', types: 'index.d.ts' }),
    '../node_modules/swr/index.js': 'export default function useSWR() {}',
    '../node_modules/swr/index.d.ts': 'export default function useSWR(key:unknown, fetcher?:unknown):unknown;',
    [sourcePath]: source,
    ...extra,
  });
  const program = ts.createProgram([path.join(root, sourcePath)], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, types: [],
  });
  assert.deepEqual(program.getSyntacticDiagnostics(), []);
  const context = { ts, files: [program.getSourceFile(path.join(root, sourcePath))], checkerFor: () => program.getTypeChecker() };
  return { config: { root, packageRoot: path.dirname(root), edition }, context };
}

function check(t, edition, source, contract, extra) {
  const { config, context } = fixture(t, edition, source, contract, extra);
  return checkFrontendDataLifecycle(config, context);
}

function declared(binding = 'id', gatesRequest = false) {
  return { schema: 'starci/next-data-lifecycle@1', swr: { package: 'swr', major: 2 }, hooks: [{
    id: 'item', path: sourcePath, export: 'useItem', kind: 'query', identities: [
      { id: binding, binding, gatesRequest, resource: true },
    ],
  }] };
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: a constant SWR key cannot omit a captured operation input without a declaration`, t => {
    const result = check(t, edition, `${header}
export function useItem(id:string) { return useSWR(CONSTANT_KEY, () => op({id})); }`);
    assert.equal(result.coverage.status, 'checked', JSON.stringify(result));
    assert.equal(result.violations.length, 1, JSON.stringify(result));
    assert.equal(result.violations[0].ruleId, SWR_KEY_RULE_ID);
    assert.equal(result.violations[0].identity, 'id');
    assert.equal(result.violations[0].path, sourcePath);
  });

  test(`${edition}: tuple, object, lazy and aliased keys carry inferred request identities`, t => {
    const result = check(t, edition, `${header}
export function useItem(params:{id:string}, viewer:string) {
  const alias=params;
  const request={id:params.id,viewer};
  const fetcher=()=>op(request);
  const tuple=useSWR([CONSTANT_KEY,params.id,viewer], fetcher);
  const object=useSWR({op:CONSTANT_KEY,id:alias.id,viewer}, ()=>op({id:params.id,viewer}));
  const lazy=useSWR(()=>params.id?[CONSTANT_KEY,alias.id,viewer]:null, ()=>op({id:params.id,viewer}));
  return {tuple,object,lazy};
}`);
    assert.deepEqual(result.violations, [], JSON.stringify(result));
    assert.equal(result.coverage.status, 'checked', JSON.stringify(result));
    assert.equal(result.coverage.calls, 3);
  });

  test(`${edition}: every active key branch must include the operation's nested input`, t => {
    const result = check(t, edition, `${header}
export const useItem=(params:{id:string}, flag:boolean)=>
  useSWR(flag?[CONSTANT_KEY,params.id]:CONSTANT_KEY, ()=>op({id:params.id}));`);
    assert.ok(result.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && item.identity === 'params.id'), JSON.stringify(result));
  });

  test(`${edition}: fetcher argument bindings are supplied by SWR and do not become captured identities`, t => {
    const result = check(t, edition, `${header}
export const useItem=(id:string)=>useSWR([CONSTANT_KEY,id], ([operation,selectedId]:[string,string])=>op({operation,id:selectedId}));`);
    assert.deepEqual(result.violations, [], JSON.stringify(result));
    assert.equal(result.coverage.status, 'checked', JSON.stringify(result));
  });

  test(`${edition}: unrelated names and request property labels cannot satisfy a missing identity`, t => {
    const result = check(t, edition, `${header}
export function useItem(id:string) { return useSWR({id:'fixed'}, ()=>op({id})); }`);
    assert.ok(result.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && item.identity === 'id'), JSON.stringify(result));
  });

  test(`${edition}: enclosing and module closure values remain request identities`, t => {
    const result = check(t, edition, `${header}
const readId=()=> 'selected';
const moduleId=readId();
export function useItem(id:string) {
  const nested=()=>useSWR(CONSTANT_KEY, ()=>Promise.resolve(op({id,moduleId})));
  return nested();
}`);
    assert.equal(result.coverage.status, 'checked', JSON.stringify(result));
    assert.deepEqual(result.violations.map(item => item.identity).sort(), ['id', 'moduleId']);
  });

  test(`${edition}: a selected request-object member preserves the identity of its original input`, t => {
    const result = check(t, edition, `${header}
export function useItem(id:string) {
  const request={id};
  return useSWR([CONSTANT_KEY,id],()=>op({id:request.id}));
}`);
    assert.deepEqual(result.violations, [], JSON.stringify(result));
    assert.equal(result.coverage.status, 'checked', JSON.stringify(result));
    const mutated = check(t, edition, `${header}
export function useItem(id:string,otherId:string) {
  const request={id}; request.id=otherId;
  return useSWR([CONSTANT_KEY,id],()=>op({id:request.id}));
}`);
    assert.ok(mutated.violations.some(item => item.ruleId === SWR_KEY_RULE_ID)
      || mutated.coverage.status === 'unavailable', JSON.stringify(mutated));
  });

  test(`${edition}: imported request values must occur in the key, including aliases and namespace fields`, t => {
    const extra = { 'apps/web/src/hooks/swr/state.ts': "export let selectedId:string='first'; export const selection={id:'first'};" };
    const importedHeader = `${header}import {selectedId as id} from './state'; import * as state from './state';`;
    const missing = check(t, edition, `${importedHeader}
export const useItem=()=>useSWR(CONSTANT_KEY,()=>op({id,selection:state.selection.id}));`, undefined, extra);
    assert.equal(missing.coverage.status, 'checked', JSON.stringify(missing));
    assert.deepEqual(missing.violations.map(item => item.identity).sort(), ['id', 'state.selection.id']);
    const passing = check(t, edition, `${importedHeader}
export const useItem=()=>useSWR([CONSTANT_KEY,id,state.selection.id],()=>op({id,selection:state.selection.id}));`, undefined, extra);
    assert.deepEqual(passing.violations, [], JSON.stringify(passing));
    assert.ok(['checked', 'unavailable'].includes(passing.coverage.status), JSON.stringify(passing));
  });

  test(`${edition}: explicit declarations retain required null gates and selected identities`, t => {
    const violation = check(t, edition, `${header}
export function useItem(id?:string) { return useSWR([CONSTANT_KEY,id], ()=>op({id})); }`, declared('id', true));
    assert.ok(violation.violations.some(item => item.ruleId === SWR_KEY_RULE_ID && /explicit null key/.test(item.message)), JSON.stringify(violation));
    const passing = check(t, edition, `${header}
export function useItem(id?:string) { return useSWR(id===undefined?null:[CONSTANT_KEY,id], ()=>op({id})); }`, declared('id', true));
    assert.deepEqual(passing.violations, [], JSON.stringify(passing));
    assert.equal(passing.coverage.status, 'checked', JSON.stringify(passing));
  });

  test(`${edition}: unsupported fetchers remain unavailable and production without SWR is not applicable`, t => {
    const unknown = check(t, edition, `${header}
declare const unknownFetcher:(key:unknown)=>unknown;
export const useItem=(id:string)=>useSWR([CONSTANT_KEY,id],unknownFetcher);`);
    assert.equal(unknown.coverage.status, 'unavailable', JSON.stringify(unknown));
    assert.ok(unknown.coverage.details.some(item => /fetcher inputs cannot be inferred/.test(item)));
    const unresolved = check(t, edition, `${header}import {id} from './unresolved';
export const useItem=()=>useSWR(CONSTANT_KEY,()=>op({id}));`);
    assert.equal(unresolved.coverage.status, 'unavailable', JSON.stringify(unresolved));
    assert.ok(unresolved.coverage.details.some(item => /imported SWR request input id cannot be resolved/.test(item)), JSON.stringify(unresolved));
    const none = check(t, edition, 'export const item=1;');
    assert.deepEqual(none.violations, []);
    assert.deepEqual(none.coverage, { status: 'not-applicable', ruleIds: [SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID] });
  });
}
