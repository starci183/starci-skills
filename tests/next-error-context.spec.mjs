import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNextErrors } from '../scripts/checks/code-patterns/next-errors.mjs';

const require = createRequire(import.meta.url);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-error-context-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-next-error-context-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (relative, value) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const contract = {
    schema: 'starci/next-error-state@1', sourceRoots: ['src'], worldMappings: [], writes: [], boundaries: [], requiredValues: [],
    transports: [{ root: 'src/api', mode: 'envelope', envelopeIds: ['read'] }],
    envelopes: [{ id: 'read', type: { path: 'src/api/envelope.ts', export: 'ReadEnvelope' }, discriminator: { field: 'ok', success: true },
      dataField: 'data', errorFields: ['error'], readers: [{ path: 'src/api/read.ts', export: 'readCourse', emptyData: 'valid' }] }],
  };
  write('package.json', { private: true, starci: { codePatterns: { next: { errorState: contract } } } });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['frontend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true }, include: ['src/**/*.ts', 'jest.config.ts'] });
  write('src/api/envelope.ts', `export type ReadEnvelope=
  |{readonly ok:true;readonly data:string|null;readonly error?:never}
  |{readonly ok:false;readonly data:null;readonly error:string};`);
  write('src/api/read.ts', `import type {ReadEnvelope} from './envelope';
export function readCourse(result:ReadEnvelope){if(!result.ok)throw new Error(result.error);return result.data??null}`);
  write('jest.config.ts', `import type {ReadEnvelope} from './src/api/envelope';
export function metadataOnly(value:ReadEnvelope){return value.data}
export default {testEnvironment:'node'}`);
  write('src/api/read.spec.ts', `import type {ReadEnvelope} from './envelope';
export function testMetadata(value:ReadEnvelope){return value.data}`);
  write('src/api/generated.d.ts', `import type {ReadEnvelope} from './envelope';
export declare const generatedMetadata:ReadEnvelope;`);
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules', 'typescript'), 'junction');
  const selected = ['src/api/envelope.ts', 'src/api/read.ts'];
  const metadata = ['jest.config.ts', 'src/api/generated.d.ts', 'src/api/read.spec.ts'];
  const input = { root, files: selected, contextFiles: metadata, sourceContextFiles: ['src/api/generated.d.ts', 'src/api/read.spec.ts'],
    ruleIds: ['FE_ERROR_ENVELOPE_POLICY'], architectureConfig: 'architecture.json' };
  return { root, write, contract, input };
}

test('explicit source roles retain TypeScript metadata without applying production contracts to it', t => {
  const f = fixture(t), result = checkNextErrors(f.input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, ['FE_ERROR_ENVELOPE_POLICY']);
  assert.deepEqual(result.compiler.metadataFiles, ['jest.config.ts', 'src/api/generated.d.ts', 'src/api/read.spec.ts']);
});

test('a context-only application source remains covered and inspected when its source role is explicit', t => {
  const f = fixture(t);
  f.write('src/api/opaque.ts', `import type {ReadEnvelope} from './envelope';
export class StoredEnvelope{constructor(readonly value:ReadEnvelope){}}`);
  const result = checkNextErrors({ ...f.input, contextFiles: [...f.input.contextFiles, 'src/api/opaque.ts'], sourceContextFiles: ['src/api/opaque.ts'] });
  assert.ok(result.errors.some(item => item.ruleId === 'FE_ERROR_ENVELOPE_POLICY' && item.path === 'src/api/opaque.ts'), JSON.stringify(result.errors));
  assert.deepEqual(result.compiler.metadataFiles, ['jest.config.ts', 'src/api/generated.d.ts', 'src/api/read.spec.ts']);
});

test('an explicit metadata role cannot hide an owning-program source beneath a declared source root', t => {
  const f = fixture(t);
  f.write('src/api/opaque.ts', 'export const hidden=true');
  const result = checkNextErrors({ ...f.input, contextFiles: [...f.input.contextFiles, 'src/api/opaque.ts'] });
  assert.ok(result.errors.some(item => item.ruleId === null && item.message.includes('sourceRoots coverage is incomplete') && item.message.includes('src/api/opaque.ts')), JSON.stringify(result.errors));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('standalone calls derive source context from the owning program and declared source roots', t => {
  const f = fixture(t);
  f.write('src/api/opaque.ts', `import type {ReadEnvelope} from './envelope';
export class StoredEnvelope{constructor(readonly value:ReadEnvelope){}}`);
  const result = checkNextErrors({ ...f.input, contextFiles: [...f.input.contextFiles, 'src/api/opaque.ts'], sourceContextFiles: undefined });
  assert.ok(result.errors.some(item => item.ruleId === 'FE_ERROR_ENVELOPE_POLICY' && item.path === 'src/api/opaque.ts'), JSON.stringify(result.errors));
  assert.deepEqual(result.compiler.metadataFiles, ['jest.config.ts', 'src/api/generated.d.ts', 'src/api/read.spec.ts']);
});

test('sourceContextFiles is unique, source-shaped and bounded by the selected context', t => {
  const f = fixture(t);
  for (const sourceContextFiles of [['src/missing.ts'], ['jest.config.ts', 'jest.config.ts'], ['package.json']]) {
    const result = checkNextErrors({ ...f.input, sourceContextFiles });
    assert.ok(result.errors.length, JSON.stringify({ sourceContextFiles, result }));
    assert.deepEqual(result.checkedRuleIds, []);
  }
  for (const file of ['src/api/read.spec.ts', 'src/api/generated.d.ts']) {
    const result = checkNextErrors({ ...f.input, files: [...f.input.files, file] });
    assert.ok(result.errors.some(item => item.message.includes('production source files')), JSON.stringify({ file, result }));
  }
});
