import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestMetadata, discoverNestMetadataInputs } from '../checks/code-patterns/nest-metadata.mjs';

const require = createRequire(import.meta.url);
const RULES = ['NEST_JEST_ALIAS_PARITY', 'NEST_TEST_DISCOVERY'];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-metadata-'));
  const write = (relative, value) => {
    const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('package.json', { private: true });
  write('tsconfig.json', { compilerOptions: { baseUrl: '.', paths: { '@modules/*': ['src/modules/*'] } }, include: ['src/**/*.ts'] });
  write('src/modules/store.ts', 'export const store = 1;');
  write('src/modules/store.spec.ts', 'throw new Error("A discovery check must never execute this file.");');
  write('jest.config.cjs', 'module.exports = {};');
  write('node_modules/jest/package.json', { name: 'jest', version: '30.0.0-test', bin: { jest: 'bin/jest.js' } });
  // This fixture verifies the CLI protocol and hostile results; a real-Jest smoke is separate evidence.
  write('node_modules/jest/bin/jest.js', `const fs=require('node:fs');const path=require('node:path');
const root=process.cwd(), state=JSON.parse(fs.readFileSync(path.join(root,'runner.json'),'utf8'));
if(state.exit)process.exit(state.exit);
if(process.argv.includes('--showConfig')){if(state.changeConfig && fs.existsSync(path.join(root,'.listed')))state.configs[0].rootDir=root+'/src';process.stdout.write(JSON.stringify({configs:state.configs}));}
else if(process.argv.includes('--listTests')){if(state.mutate)fs.writeFileSync(path.join(root,state.mutate),'changed');const second=fs.existsSync(path.join(root,'.listed'));fs.writeFileSync(path.join(root,'.listed'),'yes');process.stdout.write(JSON.stringify(state.changeList&&second?[]:state.tests));}
else process.exit(9);`);
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  const state = { configs: [{ rootDir: root, moduleNameMapper: [['^@modules/(.*)$', path.join(root, 'src/modules/$1')]] }],
    tests: [path.join(root, 'src/modules/store.spec.ts')] };
  const save = () => write('runner.json', state); save();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, write, state, save, input: { root, files: ['package.json', 'tsconfig.json', 'jest.config.cjs'], ruleIds: RULES } };
}

test('binds resolved aliases and real runner discovery with exact metadata inputs', t => {
  const f = fixture(t), result = checkNestMetadata(f.input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, RULES);
  assert.equal(result.inputs.stable, true);
  assert.deepEqual(result.discoveredTests, ['src/modules/store.spec.ts']);
  assert.ok(result.inputFiles.includes('src/modules/store.ts'));
});

test('discovers config helper and inherited TypeScript inputs before execution', t => {
  const f = fixture(t);
  f.write('jest.config.cjs', 'module.exports = require("./config/jest-base.cjs");');
  f.write('config/jest-base.cjs', 'module.exports = {};');
  f.write('tsconfig.json', { extends: './config/ts-base.json', include: ['src/**/*.ts'] });
  f.write('config/ts-base.json', { compilerOptions: { baseUrl: '..', paths: { '@modules/*': ['src/modules/*'] } } });
  const inputs = discoverNestMetadataInputs(f.input);
  assert.deepEqual(inputs.errors, []);
  assert.ok(inputs.files.includes('config/jest-base.cjs'));
  assert.ok(inputs.files.includes('config/ts-base.json'));
  assert.deepEqual(checkNestMetadata(f.input).errors, []);
});

test('reports hidden specs even inside a nested directory named dist', t => {
  const f = fixture(t);
  f.write('src/modules/dist/hidden.int-spec.ts', 'export {};');
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.errors, []);
  assert.ok(result.violations.some(item => item.ruleId === 'NEST_TEST_DISCOVERY' && item.relatedPath === 'src/modules/dist/hidden.int-spec.ts'));
});

test('requires aliases to preserve fallback order and detects specific mock shadow', t => {
  const f = fixture(t);
  f.write('tsconfig.json', { compilerOptions: { baseUrl: '.', paths: { '@modules/*': ['src/modules/*', 'src/legacy/*'] } }, include: ['src/**/*.ts'] });
  f.state.configs[0].moduleNameMapper = [['^@modules/store$', path.join(f.root, 'src/mock.ts')],
    ['^@modules/(.*)$', [path.join(f.root, 'src/legacy/$1'), path.join(f.root, 'src/modules/$1')]]]; f.save();
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.filter(item => item.ruleId === 'NEST_JEST_ALIAS_PARITY').length, 2);
});

test('accepts more-specific TypeScript aliases before broader aliases', t => {
  const f = fixture(t);
  f.write('tsconfig.json', { compilerOptions: { baseUrl: '.', paths: { '@modules/special/*': ['src/special/*'], '@modules/*': ['src/modules/*'] } }, include: ['src/**/*.ts'] });
  f.state.configs[0].moduleNameMapper.unshift(['^@modules/special/(.*)$', path.join(f.root, 'src/special/$1')]); f.save();
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('unknown regex precedence and dynamic configuration dependencies are unavailable', t => {
  const f = fixture(t);
  f.state.configs[0].moduleNameMapper.unshift(['.*', '<rootDir>/src/mock.ts']); f.save();
  assert.ok(checkNestMetadata(f.input).errors.some(item => item.message.includes('precedence')));
  f.write('jest.config.cjs', 'const name=process.env.CONFIG; module.exports=require(name);');
  assert.ok(discoverNestMetadataInputs(f.input).errors.some(item => item.message.includes('Dynamic configuration')));
});

test('config or source mutation during discovery invalidates the result', t => {
  const f = fixture(t); f.state.mutate = 'src/modules/store.ts'; f.save();
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.checkedRuleIds, []);
  assert.equal(result.inputs.stable, false);
  assert.ok(result.errors.some(item => item.message.includes('changed during measurement')));
});

test('a starting source root junction cannot hide unbound external tests', t => {
  const f = fixture(t), external = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-source-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, 'hidden.spec.ts'), 'export {};');
  fs.symlinkSync(external, path.join(f.root, 'apps'), 'junction');
  assert.ok(discoverNestMetadataInputs(f.input).errors.some(item => item.message.includes('regular directory')));
  fs.rmSync(external, { recursive: true, force: true });
  assert.ok(discoverNestMetadataInputs(f.input).errors.some(item => item.message.includes('regular directory')));
});

test('import-equals and installed preset files join preflight inputs', t => {
  const f = fixture(t);
  f.write('jest.config.ts', 'import config = require("./config/base.cjs"); export default config;');
  f.write('config/base.cjs', 'module.exports = { preset: "fixture-preset" };');
  f.write('node_modules/fixture-preset/package.json', { name: 'fixture-preset', version: '1.0.0', main: 'index.js' });
  f.write('node_modules/fixture-preset/index.js', 'module.exports = {};');
  f.write('node_modules/fixture-preset/jest-preset.js', 'module.exports = {};');
  const result = discoverNestMetadataInputs(f.input);
  assert.deepEqual(result.errors, []);
  assert.ok(result.files.includes('config/base.cjs'));
  assert.ok(result.toolFiles.some(file => file.endsWith('jest-preset.js')));
});

test('changed normalized runner config or discovery results cannot settle', t => {
  const f = fixture(t); f.state.changeConfig = true; f.save();
  assert.ok(checkNestMetadata(f.input).errors.some(item => item.message.includes('configuration changed')));
  delete f.state.changeConfig; f.state.changeList = true; f.save(); fs.rmSync(path.join(f.root, '.listed'));
  assert.ok(checkNestMetadata(f.input).errors.some(item => item.message.includes('discovery changed')));
});

test('a preset implementation changing during listing invalidates its package binding', t => {
  const f = fixture(t);
  f.write('jest.config.cjs', 'module.exports = { preset: "fixture-preset" };');
  f.write('node_modules/fixture-preset/package.json', { name: 'fixture-preset', version: '1.0.0', main: 'index.js' });
  f.write('node_modules/fixture-preset/index.js', 'module.exports = {};');
  f.write('node_modules/fixture-preset/jest-preset.js', 'module.exports = {};');
  f.state.mutate = 'node_modules/fixture-preset/jest-preset.js'; f.save();
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.checkedRuleIds, []);
  assert.ok(result.errors.some(item => item.message.includes('changed during measurement')));
});

test('multiple Jest lanes must all map to unique TypeScript projects', t => {
  const f = fixture(t);
  f.state.configs[0].displayName = { name: 'unit' };
  f.state.configs.push({ ...f.state.configs[0], displayName: { name: 'integration' } }); f.save();
  f.write('package.json', { starci: { codePatterns: { nest: { testProjects: [{ config: 'jest.config.cjs', tsconfig: 'tsconfig.json', selectProjects: ['unit'] }] } } } });
  const result = checkNestMetadata(f.input);
  assert.deepEqual(result.checkedRuleIds, []);
  assert.ok(result.errors.some(item => item.message.includes('no TypeScript binding')));
});

test('a declared TS project cannot mask a different ts-jest transform project', t => {
  const f = fixture(t);
  f.state.configs[0].transform = [['^.+\\.ts$', path.join(f.root, 'node_modules/ts-jest/dist/index.js'), { tsconfig: 'tsconfig.other.json' }]];
  f.save();
  assert.ok(checkNestMetadata(f.input).violations.some(item => item.message.includes('used by ts-jest')));
  f.state.configs[0].transform[0][2].tsconfig = { compilerOptions: { paths: {} } }; f.save();
  assert.ok(checkNestMetadata(f.input).errors.some(item => item.message.includes('Inline or disabled')));
});

test('invalid input, missing runner, failed CLI and escaped discovery cannot pass', t => {
  const f = fixture(t);
  assert.ok(checkNestMetadata({ ...f.input, files: [] }).errors.length);
  assert.ok(checkNestMetadata({ ...f.input, files: ['../outside.json'] }).errors.length);
  assert.ok(checkNestMetadata({ ...f.input, ruleIds: ['UNKNOWN'] }).errors.length);
  f.state.exit = 1; f.save(); assert.ok(checkNestMetadata(f.input).errors.length);
  delete f.state.exit; f.state.tests = [path.resolve(f.root, '../outside.spec.ts')]; f.save();
  assert.ok(checkNestMetadata(f.input).errors.length);
  fs.renameSync(path.join(f.root, 'node_modules/jest/package.json'), path.join(f.root, 'node_modules/jest/package-away.json'));
  assert.ok(checkNestMetadata(f.input).errors.length);
});
