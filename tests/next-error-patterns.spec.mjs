import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNextErrors, NEXT_ERROR_RULES } from '../checks/code-patterns/next-errors.mjs';

const require = createRequire(import.meta.url);

function fixture(t, mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-errors-'));
  const files = {
    'src/api/envelope.ts': `export type ReadEnvelope =
  | { readonly ok: true; readonly data: string | null; readonly error?: never }
  | { readonly ok: false; readonly data: null; readonly error: string };`,
    'src/api/read.ts': `import type { ReadEnvelope } from './envelope';
export function readCourse(result: ReadEnvelope): string | null {
  if (!result.ok) throw new Error(result.error);
  return result.data ?? null;
}`,
    'src/api/write.ts': `export async function saveCourse(): Promise<{ readonly disposition: 'saved' | 'refused' }> {
  return { disposition: 'refused' };
}`,
    'src/ui/feedback.ts': `export async function withFeedback<T>(operation: Promise<T>): Promise<T> { return operation; }`,
    'src/features/save.ts': `import { saveCourse } from '../api/write';
import { withFeedback } from '../ui/feedback';
export async function saveFromForm() { return withFeedback(saveCourse()); }`,
    'src/api/use-course.ts': `export function useCourseWorld() { return { error: null as Error | null }; }`,
    'src/ui/course-view.tsx': `export type CourseState = 'ready' | 'failed';
export function CourseView({ state }: { readonly state: CourseState }) { return <p>{state}</p>; }`,
    'src/features/course-owner.tsx': `import { useCourseWorld } from '../api/use-course';
import { CourseView, type CourseState } from '../ui/course-view';
export function CourseOwner() { const query = useCourseWorld(); const state: CourseState = query.error ? 'failed' : 'ready'; return <CourseView state={state}/>; }`,
    'src/app/global-error.tsx': `'use client';
type BoundaryProps = { readonly error: Error; readonly reset: () => void };
export default function GlobalError({ error, reset }: BoundaryProps) {
  return <html><body><button onClick={() => reset()}>{error.message}</button></body></html>;
}`,
  };
  mutate(files);
  const contract = {
    schema: 'starci/next-error-state@1',
    sourceRoots: ['src'],
    worldMappings: [{ id: 'course', owner: { path: 'src/features/course-owner.tsx', export: 'CourseOwner' },
      source: { path: 'src/api/use-course.ts', export: 'useCourseWorld' }, failurePath: 'query.error',
      state: { path: 'src/ui/course-view.tsx', export: 'CourseState' }, failureState: 'failed',
      render: { path: 'src/ui/course-view.tsx', symbol: 'CourseView', stateProp: 'state' } }],
    transports: [{ root: 'src/api', mode: 'envelope', envelopeIds: ['read'] }],
    envelopes: [{ id: 'read', type: { path: 'src/api/envelope.ts', export: 'ReadEnvelope' }, discriminator: { field: 'ok', success: true },
      dataField: 'data', errorFields: ['error'], readers: [{ path: 'src/api/read.ts', export: 'readCourse', emptyData: 'valid' }] }],
    writes: [{ action: { path: 'src/api/write.ts', export: 'saveCourse' }, feedback: { path: 'src/ui/feedback.ts', export: 'withFeedback' }, binding: 'promise',
      sites: [{ path: 'src/features/save.ts', export: 'saveFromForm' }] }],
    boundaries: [{ role: 'global', routeRoot: 'src/app', path: 'src/app/global-error.tsx', recoveryProp: 'reset' }],
  };
  const write = (file, content) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content)); };
  write('package.json', { private: true, dependencies: { next: '15.5.0' }, starci: { codePatterns: { next: { errorState: contract } } } });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['frontend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', strict: true }, include: ['src/**/*'] });
  for (const [file, content] of Object.entries(files)) write(file, content);
  const typescript = path.dirname(require.resolve('typescript/package.json'));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(typescript, path.join(root, 'node_modules', 'typescript'), 'junction');
  write('node_modules/next/package.json', { name: 'next', version: '15.5.0' });
  write('node_modules/next/dist/client/components/error-boundary.d.ts', 'export interface ErrorBoundaryHandlerProps { error: Error; reset: () => void }');
  const selected = ['src/api/read.ts', 'src/features/save.ts', 'src/app/global-error.tsx'];
  const contextFiles = Object.keys(files).filter(file => !selected.includes(file));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starci-next-errors-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { root, write, contract, files, input: { root, files: selected, contextFiles, ruleIds: NEXT_ERROR_RULES, architectureConfig: 'architecture.json' } };
}

test('valid envelope, exact feedback site and installed Next boundary are checked together', t => {
  const f = fixture(t), result = checkNextErrors(f.input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, [...NEXT_ERROR_RULES].sort());
  assert.equal(result.compiler.next.version, '15.5.0');
});

test('envelope failure is distinct from valid empty data and required payload absence', t => {
  const f = fixture(t, files => { files['src/api/read.ts'] = `import type { ReadEnvelope } from './envelope';
export function readCourse(result: ReadEnvelope) { return result.data ?? null; }`; });
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_ENVELOPE_POLICY'] });
  assert.ok(result.violations.some(item => item.message.includes('transport failure')));
  f.contract.envelopes[0].readers[0].emptyData = 'required';
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  f.write('src/api/read.ts', `import type { ReadEnvelope } from './envelope';
export function readCourse(result: ReadEnvelope): string { if (!result.ok) throw new Error(result.error); return result.data as string; }`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_ENVELOPE_POLICY'] });
  assert.ok(result.violations.some(item => item.message.includes('required data')));
});

test('typed business dispositions remain data while action uses are exhaustively bound to declared feedback sites', t => {
  const f = fixture(t);
  f.write('src/features/save.ts', `import { saveCourse } from '../api/write';
import { withFeedback } from '../ui/feedback';
export async function saveFromForm() { return withFeedback(saveCourse()); }
export async function hiddenUse() { return saveCourse(); }`);
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.violations.some(item => item.message.includes('outside its exact declared feedback sites')));
  f.write('src/features/save.ts', `import { saveCourse } from '../api/write';
import { withFeedback } from '../ui/feedback';
export async function saveFromForm() { const dynamic = saveCourse; return withFeedback(dynamic()); }`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.errors.some(item => item.message.includes('Dynamic reference')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('declared feedback sites must call the resolved action through the resolved feedback owner', t => {
  const f = fixture(t, files => { files['src/features/save.ts'] = `import { saveCourse } from '../api/write';
export async function saveFromForm() { return saveCourse(); }`; });
  const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.violations.some(item => item.message.includes('does not bind')));
});

test('boundary recovery contract follows installed declarations and its declared role', t => {
  const f = fixture(t);
  f.write('node_modules/next/dist/client/components/error-boundary.d.ts', 'export interface ErrorBoundaryHandlerProps { error: Error; unstable_retry: () => void }');
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  assert.ok(result.errors.some(item => item.message.includes('do not expose recovery prop reset')));
  f.contract.boundaries[0].recoveryProp = 'unstable_retry';
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  f.write('src/app/global-error.tsx', `'use client'; type P={error:Error;unstable_retry:()=>void};
export default function GlobalError(props:P){return <html><body><button onClick={props.unstable_retry}>{props.error.message}</button></body></html>}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('source-root omission and undeclared contract paths fail closed', t => {
  const f = fixture(t);
  f.write('src/features/other.ts', 'export const other = 1;');
  f.write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve' }, include: ['src/**/*'] });
  let result = checkNextErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('coverage is incomplete')));
  f.contract.writes[0].sites[0].path = '../outside.ts';
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  result = checkNextErrors(f.input);
  assert.ok(result.errors.some(item => item.message.includes('normalized repository-relative')));
});

test('local lookalikes do not satisfy resolved action, feedback or recovery identities', t => {
  const f = fixture(t, files => { files['src/features/save.ts'] = `import { saveCourse } from '../api/write';
import { withFeedback as importedFeedback } from '../ui/feedback';
const withFeedback = <T>(value:T) => value;
export async function saveFromForm() { return withFeedback(saveCourse()); }`; });
  const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.violations.some(item => item.message.includes('does not bind')));
});

test('each action call needs its own feedback binding and an unused recovery reference is not an action', t => {
  const f = fixture(t);
  f.write('src/features/save.ts', `import { saveCourse } from '../api/write';
import { withFeedback } from '../ui/feedback';
export async function saveFromForm() { await saveCourse(); return withFeedback(saveCourse()); }`);
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.violations.some(item => item.message.includes('does not bind')));
  f.write('src/app/global-error.tsx', `'use client'; type P={error:Error;reset:()=>void};
export default function GlobalError(props:P){const unused=props.reset;return <html><body>{props.error.message}</body></html>}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  assert.ok(result.violations.some(item => item.message.includes('reachable reset')));
});

test('required-data proof is symbol-bound and success-else-failure is supported', t => {
  const f = fixture(t);
  f.contract.envelopes[0].readers[0].emptyData = 'required';
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  f.write('src/api/read.ts', `import type { ReadEnvelope } from './envelope';
export function readCourse(result: ReadEnvelope): string {
  if (result.ok) { if (result.data === null) throw new Error('missing'); return result.data; }
  else throw new Error(result.error);
}`);
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_ENVELOPE_POLICY'] });
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.write('src/api/read.ts', `import type { ReadEnvelope } from './envelope';
export function readCourse(result: ReadEnvelope): string {
  if (!result.ok) throw new Error(result.error);
  const dataLabel = undefined; if (dataLabel === undefined) throw new Error('unrelated');
  return result.data as string;
}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_ENVELOPE_POLICY'] });
  assert.ok(result.violations.some(item => item.message.includes('required data')));
});

test('uncalled or out-of-order envelope guards cannot supply failure proof', t => {
  const cases = [
    `const never = () => { if (!result.ok) throw new Error(result.error); }; return result.data ?? null;`,
    `return result.data ?? null; if (!result.ok) throw new Error(result.error);`,
    `if (!result.ok) { const never = () => { throw new Error(result.error); }; } return result.data ?? null;`,
    `if (Date.now() > 0) { if (!result.ok) throw new Error(result.error); } return result.data ?? null;`,
  ];
  for (const body of cases) {
    const f = fixture(t);
    f.write('src/api/read.ts', `import type { ReadEnvelope } from './envelope'; export function readCourse(result: ReadEnvelope){${body}}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_ENVELOPE_POLICY'] });
    assert.ok(result.errors.some(item => item.ruleId === 'FE_ERROR_ENVELOPE_POLICY')
      || result.violations.some(item => item.ruleId === 'FE_ERROR_ENVELOPE_POLICY'), JSON.stringify(result));
  }
});

test('feedback proof follows executed direct promises or callbacks, not uncalled helpers, mutable results or post-await values', t => {
  const cases = [
    `const promise=saveCourse(); const never=()=>withFeedback(promise); return promise;`,
    `let result=saveCourse(); result=Promise.resolve({disposition:'saved' as const}); return withFeedback(result);`,
    `const result=await saveCourse(); return withFeedback(Promise.resolve(result));`,
    `return withFeedback(await saveCourse());`,
  ];
  for (const body of cases) {
    const f = fixture(t);
    f.write('src/features/save.ts', `import {saveCourse} from '../api/write'; import {withFeedback} from '../ui/feedback'; export async function saveFromForm(){${body}}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
    assert.ok(result.errors.some(item => item.ruleId === 'FE_WRITE_FEEDBACK_OWNER')
      || result.violations.some(item => item.ruleId === 'FE_WRITE_FEEDBACK_OWNER'), JSON.stringify(result));
  }
  const callback = fixture(t);
  callback.contract.writes[0].binding = 'callback';
  callback.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: callback.contract } } } });
  callback.write('src/ui/feedback.ts', `export async function withFeedback<T>(operation:()=>Promise<T>):Promise<T>{return operation()}`);
  callback.write('src/features/save.ts', `import {saveCourse} from '../api/write'; import {withFeedback} from '../ui/feedback';
export async function saveFromForm(){return withFeedback(()=>saveCourse())}`);
  assert.deepEqual(checkNextErrors({ ...callback.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] }).errors, []);
});

test('world owner maps the resolved source failure into a closed state consumed by a local or imported render symbol', t => {
  const f = fixture(t);
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.contract.worldMappings[0].render = { path: 'src/features/course-owner.tsx', symbol: 'CourseView', stateProp: 'state' };
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  f.write('src/features/course-owner.tsx', `import {useCourseWorld} from '../api/use-course'; import type {CourseState} from '../ui/course-view';
function CourseView({state}:{readonly state:CourseState}){return <p>{state}</p>}
export function CourseOwner(){const query=useCourseWorld();const state:CourseState=query.error?'failed':'ready';return <CourseView state={state}/>}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('world-state metadata cannot bless an unused mapping, missing state member, omitted owner or dynamic source alias', t => {
  const f = fixture(t);
  f.write('src/features/course-owner.tsx', `import {useCourseWorld} from '../api/use-course'; import {CourseView} from '../ui/course-view';
export function CourseOwner(){const query=useCourseWorld();const unused=query.error?'failed':'ready';return <CourseView state='ready'/>}`);
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.ok(result.violations.some(item => item.ruleId === 'FE_ERROR_WORLD_STATE_MAPPING'));
  f.write('src/ui/course-view.tsx', `export type CourseState='ready'; export function CourseView({state}:{readonly state:CourseState}){return <p>{state}</p>}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.ok(result.violations.some(item => item.message.includes('not a member')));
  f.write('src/ui/course-view.tsx', `export type CourseState='ready'|'failed'; export function CourseView({state}:{readonly state:CourseState}){return <p>{state}</p>}`);
  f.write('src/features/other-owner.tsx', `import {useCourseWorld} from '../api/use-course'; export function Other(){return useCourseWorld()}`);
  f.input.contextFiles.push('src/features/other-owner.tsx');
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.ok(result.violations.some(item => item.message.includes('outside every declared')), JSON.stringify(result, null, 2));
  f.write('src/features/other-owner.tsx', `import {useCourseWorld} from '../api/use-course'; export const alias=useCourseWorld;`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.ok(result.errors.some(item => item.message.includes('Dynamic reference')));
});

test('resolved identities remain stable across separate canonical TypeScript programs', t => {
  const f = fixture(t);
  f.write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['frontend'], projects: ['tsconfig.api.json', 'tsconfig.app.json'] });
  const options = { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', strict: true };
  f.write('tsconfig.api.json', { compilerOptions: options, include: ['src/api/envelope.ts', 'src/api/write.ts', 'src/api/use-course.ts'] });
  f.write('tsconfig.app.json', { compilerOptions: options, include: ['src/api/read.ts', 'src/app/**/*', 'src/features/**/*', 'src/ui/**/*'] });
  const result = checkNextErrors(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('uncalled boundary and world helpers are unavailable rather than credited as reachable UI', t => {
  const boundary = fixture(t);
  boundary.write('src/app/global-error.tsx', `'use client'; type P={error:Error;reset:()=>void};
export default function GlobalError(props:P){const never=()=>props.reset();return <html><body>{props.error.message}</body></html>}`);
  let result = checkNextErrors({ ...boundary.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  assert.ok(result.errors.some(item => item.message.includes('unsupported indirect control flow')));

  const world = fixture(t);
  world.write('src/features/course-owner.tsx', `import {useCourseWorld} from '../api/use-course'; import {CourseView} from '../ui/course-view';
export function CourseOwner(){const never=()=>{const query=useCourseWorld();return <CourseView state={query.error?'failed':'ready'}/>};return <CourseView state='ready'/>}`);
  result = checkNextErrors({ ...world.input, ruleIds: ['FE_ERROR_WORLD_STATE_MAPPING'] });
  assert.ok(result.errors.some(item => item.message.includes('unsupported indirect control flow')), JSON.stringify(result));
});

test('indirect promise storage cannot fabricate feedback provenance', t => {
  const f = fixture(t);
  f.write('src/features/save.ts', `import {saveCourse} from '../api/write'; import {withFeedback} from '../ui/feedback';
export async function saveFromForm(){const box={operation:saveCourse()};return withFeedback(box.operation)}`);
  const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
  assert.ok(result.errors.some(item => item.message.includes('unsupported indirect binding')), JSON.stringify(result));
});

test('uses the lockfile-installed Next recovery declaration rather than a synthetic version rule', t => {
  const installedManifest = require.resolve('next/package.json');
  const installedRoot = path.dirname(installedManifest), installed = JSON.parse(fs.readFileSync(installedManifest, 'utf8'));
  assert.equal(installed.version, '16.3.1');
  const f = fixture(t), target = path.join(f.root, 'node_modules', 'next');
  fs.rmSync(target, { recursive: true, force: true });
  fs.symlinkSync(installedRoot, target, 'junction');
  let result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  const supported = result.compiler?.next?.recoveryProps ?? [];
  assert.ok(supported.length > 0, JSON.stringify(result, null, 2));
  const recoveryProp = supported.includes('unstable_retry') ? 'unstable_retry' : supported[0];
  f.contract.boundaries[0].recoveryProp = recoveryProp;
  f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
  f.write('src/app/global-error.tsx', `'use client'; type P={error:Error;${recoveryProp}:()=>void};
export default function GlobalError(props:P){return <html><body><button onClick={props.${recoveryProp}}>{props.error.message}</button></body></html>}`);
  result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.equal(result.compiler.next.version, installed.version);
});

test('mutable provenance, partial render coverage and statically unreachable actions cannot certify error handling', async t => {
  const cases = [
    ['mutable envelope data alias', 'FE_ERROR_ENVELOPE_POLICY', `import type {ReadEnvelope} from './envelope';
export function readCourse(result:ReadEnvelope){if(!result.ok)throw new Error(result.error);let data=result.data;data=null;return data}`, 'src/api/read.ts'],
    ['mutable world state', 'FE_ERROR_WORLD_STATE_MAPPING', `import {useCourseWorld} from '../api/use-course';import {CourseView,type CourseState} from '../ui/course-view';
export function CourseOwner(){const query=useCourseWorld();let state:CourseState=query.error?'failed':'ready';state='ready';return <CourseView state={state}/>}`, 'src/features/course-owner.tsx'],
    ['one unproven render path', 'FE_ERROR_WORLD_STATE_MAPPING', `import {useCourseWorld} from '../api/use-course';import {CourseView,type CourseState} from '../ui/course-view';
export function CourseOwner({alternate}:{alternate:boolean}){const query=useCourseWorld();const state:CourseState=query.error?'failed':'ready';if(alternate)return <CourseView state={state}/>;return <CourseView state='ready'/>}`, 'src/features/course-owner.tsx'],
    ['promise feedback in unreachable branch', 'FE_WRITE_FEEDBACK_OWNER', `import {saveCourse} from '../api/write';import {withFeedback} from '../ui/feedback';
export async function saveFromForm(){if(false)return withFeedback(saveCourse());return {disposition:'saved' as const}}`, 'src/features/save.ts'],
    ['boundary recovery in unreachable branch', 'FE_NEXT_ERROR_BOUNDARY_LOCATION', `'use client';type P={readonly error:Error;readonly reset:()=>void};
export default function GlobalError({error,reset}:P){if(false)reset();return <html><body>{error.message}</body></html>}`, 'src/app/global-error.tsx'],
  ];
  for (const [name, ruleId, source, file] of cases) await t.test(name, () => {
    const f = fixture(t); f.write(file, source);
    const result = checkNextErrors({ ...f.input, ruleIds: [ruleId] });
    assert.ok(result.errors.length || result.violations.length, `${name} was falsely clean: ${JSON.stringify(result, null, 2)}`);
  });

  await t.test('callback owner invocation in unreachable branch', () => {
    const f = fixture(t);
    f.contract.writes[0].binding = 'callback';
    f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
    f.write('src/ui/feedback.ts', `export async function withFeedback<T>(operation:()=>Promise<T>):Promise<T>{if(false)return operation();throw new Error('disabled')}`);
    f.write('src/features/save.ts', `import {saveCourse} from '../api/write';import {withFeedback} from '../ui/feedback';
export async function saveFromForm(){return withFeedback(()=>saveCourse())}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
    assert.ok(result.errors.some(item => /statically unreachable/.test(item.message)), JSON.stringify(result, null, 2));
  });

  await t.test('callback owner invocation after a terminal throw', () => {
    const f = fixture(t);
    f.contract.writes[0].binding = 'callback';
    f.write('package.json', { private: true, starci: { codePatterns: { next: { errorState: f.contract } } } });
    f.write('src/ui/feedback.ts', `export async function withFeedback<T>(operation:()=>Promise<T>):Promise<T>{throw new Error('disabled');return operation()}`);
    f.write('src/features/save.ts', `import {saveCourse} from '../api/write';import {withFeedback} from '../ui/feedback';
export async function saveFromForm(){return withFeedback(()=>saveCourse())}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_WRITE_FEEDBACK_OWNER'] });
    assert.ok(result.errors.some(item => /statically unreachable/.test(item.message)), JSON.stringify(result, null, 2));
  });

  for (const [name, body] of [
    ['boundary recovery after return', `return <html><body>{error.message}</body></html>;reset()`],
    ['boundary recovery under numeric falsy guard', `if(0)reset();return <html><body>{error.message}</body></html>`],
    ['boundary recovery in zero-iteration while', `while(false)reset();return <html><body>{error.message}</body></html>`],
    ['boundary recovery in zero-iteration for', `for(;false;)reset();return <html><body>{error.message}</body></html>`],
  ]) await t.test(name, () => {
    const f = fixture(t);
    f.write('src/app/global-error.tsx', `'use client';type P={readonly error:Error;readonly reset:()=>void};
export default function GlobalError({error,reset}:P){${body}}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
    assert.ok(result.errors.length || result.violations.length, JSON.stringify(result, null, 2));
  });

  await t.test('do-while body remains reachable once', () => {
    const f = fixture(t);
    f.write('src/app/global-error.tsx', `'use client';type P={readonly error:Error;readonly reset:()=>void};
export default function GlobalError({error,reset}:P){do reset();while(false);return <html><body>{error.message}</body></html>}`);
    const result = checkNextErrors({ ...f.input, ruleIds: ['FE_NEXT_ERROR_BOUNDARY_LOCATION'] });
    assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  });
});
