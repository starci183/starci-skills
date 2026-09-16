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
export async function saveFromForm() { const result = await saveCourse(); return withFeedback(Promise.resolve(result)); }`,
    'src/app/global-error.tsx': `'use client';
type BoundaryProps = { readonly error: Error; readonly reset: () => void };
export default function GlobalError({ error, reset }: BoundaryProps) {
  return <html><body><button onClick={() => reset()}>{error.message}</button></body></html>;
}`,
  };
  mutate(files);
  const contract = {
    sourceRoots: ['src'],
    transports: [{ root: 'src/api', mode: 'envelope', envelopeIds: ['read'] }],
    envelopes: [{ id: 'read', type: { path: 'src/api/envelope.ts', export: 'ReadEnvelope' }, discriminator: { field: 'ok', success: true },
      dataField: 'data', errorFields: ['error'], readers: [{ path: 'src/api/read.ts', export: 'readCourse', emptyData: 'valid' }] }],
    writes: [{ action: { path: 'src/api/write.ts', export: 'saveCourse' }, feedback: { path: 'src/ui/feedback.ts', export: 'withFeedback' },
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
