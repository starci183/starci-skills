import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { checkGrammarGuards, GRAMMAR_GUARD_RULES } from '../scripts/checks/code-patterns/grammar-guards.mjs';
import { writeStamp } from '../packages/grammar/scripts/build-stamp.mjs';

const require = createRequire(import.meta.url);
const typescriptRoot = path.dirname(require.resolve('typescript/package.json'));
const goodModule = `
export const COMMON_UI_RULE_IDS=['RULE-A','RULE-B','RULE-C'];
export const PRESENTATION_STATES=['neutral','pending','unavailable'];
export function defineGrammarRuleConformance(definition){
  const inherited=new Set(definition.inheritedCommonRules),evidence=new Set(Object.keys(definition.familyEvidence));
  const missing=COMMON_UI_RULE_IDS.filter(rule=>!inherited.has(rule)&&!evidence.has(rule));
  const unknown=[...inherited,...evidence].filter(rule=>!COMMON_UI_RULE_IDS.includes(rule));
  if(missing.length||unknown.length)throw new TypeError('invalid conformance');
  return Object.freeze({...definition});
}
export function assertPresentationState(value){if(!PRESENTATION_STATES.includes(value))throw new TypeError('invalid state')}
`;

function grammarPackage(moduleSource = goodModule, entryConditions = { import: './dist/common.js' }, packageFiles = ['dist']) {
  return {
    package: { name: '@starci/grammar', version: '1.2.3', type: 'module', files: packageFiles, exports: { './common': entryConditions } },
    moduleSource,
  };
}

function fixture(t, { source = 'installed', moduleSource = goodModule, mismatch = false,
  entryConditions = { import: './dist/common.js' }, packageFiles = ['dist'] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-guards-'));
  const write = (relative, value) => {
    const target = path.join(root, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value)); return target;
  };
  const contract = { schema: 'starci/grammar-guard-contract@1', package: '@starci/grammar', entry: './common',
    source: source === 'installed' ? { kind: 'installed' } : { kind: 'repository', root: source === 'standalone' ? '.' : 'packages/grammar' },
    vectorProfile: 'starci/grammar-guards-v1' };
  const targetPackage = { private: true, ...(source === 'standalone' ? grammarPackage(moduleSource, entryConditions, packageFiles).package : {}), starci: { codePatterns: { next: { grammarGuards: contract } } } };
  write('package.json', targetPackage); write('package-lock.json', { lockfileVersion: 3 });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(typescriptRoot, path.join(root, 'node_modules/typescript'), 'junction');
  let provider;
  if (source === 'standalone') {
    provider = root; write('dist/common.js', moduleSource);
  } else if (source === 'repository') {
    provider = path.join(root, 'packages/grammar');
    write('packages/grammar/package.json', grammarPackage(moduleSource, entryConditions, packageFiles).package); write('packages/grammar/dist/common.js', moduleSource);
    fs.mkdirSync(path.join(root, 'node_modules/@starci'), { recursive: true });
    if (mismatch) {
      write('other/grammar/package.json', grammarPackage(moduleSource, entryConditions, packageFiles).package); write('other/grammar/dist/common.js', moduleSource);
      fs.symlinkSync(path.join(root, 'other/grammar'), path.join(root, 'node_modules/@starci/grammar'), 'junction');
    } else fs.symlinkSync(provider, path.join(root, 'node_modules/@starci/grammar'), 'junction');
  } else {
    provider = path.join(root, 'node_modules/@starci/grammar');
    write('node_modules/@starci/grammar/package.json', grammarPackage(moduleSource, entryConditions, packageFiles).package); write('node_modules/@starci/grammar/dist/common.js', moduleSource);
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = source === 'repository' ? ['package.json', 'packages/grammar/package.json'] : ['package.json'];
  const selectionLink = source === 'repository' ? path.join(root, 'node_modules/@starci/grammar') : null;
  return { root, provider, selectionLink, files, write, input: { root, files, contextFiles: [...files, 'package-lock.json'], ruleIds: GRAMMAR_GUARD_RULES } };
}

test('installed public Grammar exports pass every bounded rule and presentation vector', t => {
  const f = fixture(t), result = checkGrammarGuards(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, [...GRAMMAR_GUARD_RULES]);
  assert.equal(result.execution.package.selection, 'installed-import');
  assert.equal(result.execution.permissions.filesystemRead, 'bound-package-inventories');
  assert.equal(result.execution.permissions.filesystemWrite, 'denied');
  assert.equal(result.execution.permissions.network, process.allowedNodeEnvironmentFlags.has('--allow-net') ? 'denied' : 'not-controlled-by-this-node-version');
  assert.deepEqual(result.execution.vectors, { requiredRules: 3, presentationStates: 3, invalidPresentationValues: 6 });
});

test('repository workspace and standalone provider bind the same public export behavior', async t => {
  await t.test('workspace consumer', inner => {
    const f = fixture(inner, { source: 'repository' }), result = checkGrammarGuards(f.input);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
    assert.equal(result.execution.package.selection, 'consumer-import');
  });
  await t.test('standalone provider', inner => {
    const f = fixture(inner, { source: 'standalone' }), result = checkGrammarGuards(f.input);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
    assert.equal(result.execution.package.selection, 'standalone-import');
  });
});

test('a repository Grammar whose dist is not the build of its source is refused before it is probed', t => {
  const f = fixture(t, { source: 'repository' });
  f.write('packages/grammar/src/common/index.ts', 'export const COMMON_UI_RULE_IDS = [] as const\n');
  const stale = checkGrammarGuards(f.input);
  assert.deepEqual(stale.checkedRuleIds, []); assert.equal(stale.execution, null);
  assert.ok(stale.errors.some(item => /dist at .* is unstamped: .*Fix: run npm run build in packages\/grammar\.$/.test(item.message)), JSON.stringify(stale.errors));
  writeStamp(f.provider);
  const fresh = checkGrammarGuards(f.input);
  assert.deepEqual(fresh.errors, []); assert.deepEqual(fresh.checkedRuleIds, [...GRAMMAR_GUARD_RULES]);
  f.write('packages/grammar/src/common/index.ts', 'export const COMMON_UI_RULE_IDS = ["RULE-A"] as const\n');
  const edited = checkGrammarGuards(f.input);
  assert.ok(edited.errors.some(item => item.message.includes('is stale') && item.message.endsWith('Fix: run npm run build in packages/grammar.')));
});

test('standalone package resolution follows Node export-condition precedence and default exports', async t => {
  await t.test('node condition wins over import', inner => {
    const permissive = goodModule.replace("if(missing.length||unknown.length)throw new TypeError('invalid conformance');", '');
    const f = fixture(inner, { source: 'standalone', entryConditions: { node: './dist/wrong.js', import: './dist/common.js' } });
    f.write('dist/wrong.js', permissive);
    const result = checkGrammarGuards(f.input);
    assert.deepEqual(result.errors, []); assert.ok(result.violations.length > 0);
    assert.ok(result.execution.package.entry.endsWith('/dist/wrong.js'));
  });
  await t.test('default-only export', inner => {
    const f = fixture(inner, { source: 'standalone', entryConditions: { default: './dist/common.js' } });
    const result = checkGrammarGuards(f.input);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  });
});

test('permissive guards, the wrong error class and rejected valid values are findings', async t => {
  const cases = [
    ['permissive', goodModule.replace("if(missing.length||unknown.length)throw new TypeError('invalid conformance');", '')
      .replace("if(!PRESENTATION_STATES.includes(value))throw new TypeError('invalid state')", '')],
    ['wrong error', goodModule.replaceAll('new TypeError(', 'new Error(')],
    ['reject valid', goodModule.replace("if(missing.length||unknown.length)throw new TypeError('invalid conformance');", "throw new TypeError('always');")],
  ];
  for (const [name, moduleSource] of cases) await t.test(name, inner => {
    const f = fixture(inner, { moduleSource }), result = checkGrammarGuards(f.input);
    assert.deepEqual(result.errors, []); assert.ok(result.violations.length > 0); assert.deepEqual(result.checkedRuleIds, [...GRAMMAR_GUARD_RULES]);
  });
});

test('the public package probe cannot write files during module initialization', t => {
  const moduleSource = `
import fs from 'node:fs';
fs.writeFileSync(new URL('./forbidden-write.txt',import.meta.url),'not allowed');
${goodModule}`;
  const f = fixture(t, { moduleSource }), result = checkGrammarGuards(f.input);
  assert.ok(result.errors.some(item => item.message.includes('exports or vocabulary are unavailable')));
  assert.deepEqual(result.checkedRuleIds, []);
  assert.equal(fs.existsSync(path.join(f.provider, 'dist/forbidden-write.txt')), false);
});

test('missing exports and a consumer resolving a different repository package are unavailable', async t => {
  await t.test('missing public guard export', inner => {
    const f = fixture(inner, { moduleSource: goodModule.replace('export function assertPresentationState', 'function assertPresentationState') });
    const result = checkGrammarGuards(f.input); assert.ok(result.errors.length); assert.deepEqual(result.checkedRuleIds, []);
  });
  await t.test('stale selected workspace package', inner => {
    const f = fixture(inner, { source: 'repository', mismatch: true }), result = checkGrammarGuards(f.input);
    assert.ok(result.errors.some(item => item.message.includes('stale or different'))); assert.deepEqual(result.checkedRuleIds, []);
  });
});

test('a static public-entry helper outside the declared package inventory is unavailable', t => {
  const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from '../runtime/helper.js';`;
  const f = fixture(t, { moduleSource, packageFiles: ['dist/common.js'] });
  f.write('node_modules/@starci/grammar/runtime/helper.js', goodModule);
  const result = checkGrammarGuards(f.input);
  assert.ok(result.errors.some(item => item.message.includes('outside the bound package inventory')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('npm files negations narrow a bounded inventory but never name one', async t => {
  const published = ['dist', '!dist/stories', '!dist/__test__', '!dist/**/*.stories.*', '!dist/**/*.spec.*', '!dist/**/*.test.*', 'README.md', 'LICENSE'];
  await t.test('bounded positives with the published 0.5.0 glob negations pass', async inner => {
    for (const source of ['installed', 'repository']) await inner.test(source, leaf => {
      const f = fixture(leaf, { source, packageFiles: published });
      if (source === 'repository') {
        f.write('packages/grammar/dist/button.stories.js', 'export default {};'); f.write('packages/grammar/dist/nested/a.spec.js', 'export {};');
      }
      const result = checkGrammarGuards(f.input);
      assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
      assert.deepEqual(result.checkedRuleIds, GRAMMAR_GUARD_RULES);
    });
  });
  await t.test('unbounded or escaping positives are still refused, negations included', async inner => {
    for (const packageFiles of [['dist/**'], ['dist/*.js', '!dist/**/*.spec.*'], ['{dist,src}'], ['../dist'], ['!!dist/**/*.spec.*', 'dist'], ['dist', '!../x/**'], ['dist', '!']]) {
      await inner.test(JSON.stringify(packageFiles), leaf => {
        const result = checkGrammarGuards(fixture(leaf, { packageFiles }).input);
        assert.ok(result.errors.some(item => item.message.includes('explicit bounded package inventory')), JSON.stringify(result.errors));
        assert.deepEqual(result.checkedRuleIds, []);
      });
    }
  });
  await t.test('a negation alone never counts as inventory', inner => {
    const result = checkGrammarGuards(fixture(inner, { packageFiles: ['!dist/**/*.spec.*', '!dist/stories'] }).input);
    assert.ok(result.errors.some(item => item.message.includes('negations only narrow it')), JSON.stringify(result.errors));
    assert.deepEqual(result.checkedRuleIds, []);
  });
  await t.test('a public-entry dependency the negations drop from the published package is unavailable', inner => {
    const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from './stories/helper.js';`;
    const f = fixture(inner, { source: 'repository', moduleSource, packageFiles: ['dist', '!dist/stories'] });
    f.write('packages/grammar/dist/stories/helper.js', goodModule);
    const result = checkGrammarGuards(f.input);
    assert.ok(result.errors.some(item => item.message.includes('excluded from the published package inventory: dist/stories/helper.js')), JSON.stringify(result.errors));
    assert.deepEqual(result.checkedRuleIds, []);
  });
});

test('external imports and behavior reads are covered by canonical dependency custody', async t => {
  await t.test('a locked external package is byte-bound before and after the probe', inner => {
    const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from '@external/helper';`;
    const f = fixture(inner, { moduleSource });
    f.write('package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/@external/helper': { version: '1.0.0' } } });
    f.write('node_modules/@external/helper/package.json', { name: '@external/helper', version: '1.0.0', type: 'module', exports: './index.js' });
    const helper = f.write('node_modules/@external/helper/index.js', goodModule);
    const clean = checkGrammarGuards(f.input);
    assert.deepEqual(clean.errors, []); assert.deepEqual(clean.violations, []);
    assert.deepEqual(clean.execution.package.externalPackages, [{ name: '@external/helper', version: '1.0.0', lockKey: 'node_modules/@external/helper' }]);
    let mutated = false;
    const spawn = (command, args, options) => {
      const result = spawnSync(command, args, options);
      if (!mutated && args.some(value => value.includes('starci/grammar-guard-probe@1'))) { fs.appendFileSync(helper, '\n// changed'); mutated = true; }
      return result;
    };
    const changed = checkGrammarGuards(f.input, { spawn });
    assert.ok(changed.errors.some(item => item.message.includes('changed during the behavior probe')));
    assert.deepEqual(changed.checkedRuleIds, []);
  });
  await t.test('a linked locked package is readable and every resolved edge is replayed after the probe', inner => {
    const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from '@external/helper';`;
    const f = fixture(inner, { moduleSource });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-selection-'));
    inner.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    for (const name of ['before', 'after']) {
      const directory = path.join(outside, name); fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: '@external/helper', version: '1.0.0', type: 'module', exports: './index.js' }));
      fs.writeFileSync(path.join(directory, 'index.js'), `${goodModule}\n// ${name}`);
    }
    const link = path.join(f.root, 'node_modules/@external/helper'); fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(path.join(outside, 'before'), link, 'junction');
    f.write('package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/@external/helper': { version: '1.0.0' } } });
    const clean = checkGrammarGuards(f.input); assert.deepEqual(clean.errors, []); assert.deepEqual(clean.violations, []);
    let redirected = false;
    const spawn = (command, args, options) => {
      const result = spawnSync(command, args, options);
      if (!redirected && args.some(value => value.includes('starci/grammar-guard-probe@1'))) {
        fs.unlinkSync(link); fs.symlinkSync(path.join(outside, 'after'), link, 'junction'); redirected = true;
      }
      return result;
    };
    const changed = checkGrammarGuards(f.input, { spawn });
    assert.equal(redirected, true); assert.ok(changed.errors.some(item => item.message.includes('selection changed during the behavior probe')));
    assert.deepEqual(changed.checkedRuleIds, []);
  });
  await t.test('a bare package absent from the target lock cannot provide the guard API', inner => {
    const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from '@external/helper';`;
    const f = fixture(inner, { moduleSource });
    f.write('node_modules/@external/helper/package.json', { name: '@external/helper', version: '1.0.0', type: 'module', exports: './index.js' });
    f.write('node_modules/@external/helper/index.js', goodModule);
    const result = checkGrammarGuards(f.input);
    assert.ok(result.errors.some(item => item.message.includes('@external/helper') && item.message.includes('package-lock')), JSON.stringify(result));
    assert.deepEqual(result.checkedRuleIds, []);
  });
  await t.test('an absolute file import is never treated as a package dependency', inner => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-absolute-'));
    inner.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const helper = path.join(outside, 'helper.mjs'); fs.writeFileSync(helper, goodModule);
    const moduleSource = `export {COMMON_UI_RULE_IDS,PRESENTATION_STATES,defineGrammarRuleConformance,assertPresentationState} from ${JSON.stringify(pathToFileURL(helper).href)};`;
    const result = checkGrammarGuards(fixture(inner, { moduleSource }).input);
    assert.ok(result.errors.some(item => item.message.includes('unsupported absolute or data dependency')));
    assert.deepEqual(result.checkedRuleIds, []);
  });
  await t.test('node:fs cannot supply guard behavior from an unbound file', inner => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-read-'));
    inner.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const vocabulary = path.join(outside, 'vocabulary.json');
    fs.writeFileSync(vocabulary, JSON.stringify({ rules: ['RULE-A', 'RULE-B', 'RULE-C'], states: ['neutral', 'pending', 'unavailable'] }));
    const moduleSource = `
import fs from 'node:fs';
const value=JSON.parse(fs.readFileSync(${JSON.stringify(vocabulary)},'utf8'));
export const COMMON_UI_RULE_IDS=value.rules;
export const PRESENTATION_STATES=value.states;
export function defineGrammarRuleConformance(definition){
  const inherited=new Set(definition.inheritedCommonRules),evidence=new Set(Object.keys(definition.familyEvidence));
  const missing=COMMON_UI_RULE_IDS.filter(rule=>!inherited.has(rule)&&!evidence.has(rule));
  const unknown=[...inherited,...evidence].filter(rule=>!COMMON_UI_RULE_IDS.includes(rule));
  if(missing.length||unknown.length)throw new TypeError('invalid conformance'); return Object.freeze({...definition});
}
export function assertPresentationState(value){if(!PRESENTATION_STATES.includes(value))throw new TypeError('invalid state')}
`;
    const result = checkGrammarGuards(fixture(inner, { moduleSource }).input);
    assert.ok(result.errors.some(item => item.message.includes('exports or vocabulary are unavailable')));
    assert.deepEqual(result.checkedRuleIds, []);
  });
});

test('timeout, input mutation, selection changes and an interior package link fail closed', async t => {
  await t.test('timeout', inner => {
    const f = fixture(inner);
    const spawn = (command, args, options) => args.some(value => value.includes('starci/grammar-guard-probe@1'))
      ? { status: null, signal: 'SIGTERM', stdout: '', stderr: '', error: Object.assign(Error('timed out'), { code: 'ETIMEDOUT' }) }
      : spawnSync(command, args, options);
    const result = checkGrammarGuards(f.input, { spawn }); assert.ok(result.errors.some(item => item.message.includes('did not complete')));
  });
  await t.test('package changes during execution', inner => {
    const f = fixture(inner); let mutated = false;
    const spawn = (command, args, options) => {
      const result = spawnSync(command, args, options);
      if (!mutated && args.some(value => value.includes('starci/grammar-guard-probe@1'))) { fs.appendFileSync(path.join(f.provider, 'dist/common.js'), '\n// changed'); mutated = true; }
      return result;
    };
    const result = checkGrammarGuards(f.input, { spawn }); assert.ok(result.errors.some(item => item.message.includes('changed during')));
  });
  await t.test('consumer package selection changes during execution', inner => {
    const f = fixture(inner, { source: 'repository' }), other = path.join(f.root, 'other/grammar');
    f.write('other/grammar/package.json', grammarPackage().package); f.write('other/grammar/dist/common.js', goodModule);
    let redirected = false;
    const spawn = (command, args, options) => {
      const result = spawnSync(command, args, options);
      if (!redirected && args.some(value => value.includes('starci/grammar-guard-probe@1'))) {
        fs.unlinkSync(f.selectionLink); fs.symlinkSync(other, f.selectionLink, 'junction'); redirected = true;
      }
      return result;
    };
    const result = checkGrammarGuards(f.input, { spawn });
    assert.ok(result.errors.some(item => item.message.includes('stale or different') || item.message.includes('selection changed')));
    assert.deepEqual(result.checkedRuleIds, []);
  });
  await t.test('interior redirection', inner => {
    const f = fixture(inner), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-outside-'));
    inner.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    fs.symlinkSync(outside, path.join(f.provider, 'dist/linked'), 'junction');
    const result = checkGrammarGuards(f.input); assert.ok(result.errors.some(item => item.message.includes('interior link')));
  });
});

test('malformed contracts and unbound repository manifests cannot claim coverage', t => {
  const f = fixture(t, { source: 'repository' });
  assert.ok(checkGrammarGuards({ ...f.input, files: ['package.json'], contextFiles: ['package.json'] }).errors.some(item => item.message.includes('outside the bound')));
  fs.unlinkSync(path.join(f.root, 'package-lock.json'));
  assert.ok(checkGrammarGuards(f.input).errors.some(item => item.message.includes('dependency lock')));
  f.write('package-lock.json', { lockfileVersion: 3 });
  f.write('package.json', { private: true, starci: { codePatterns: { next: { grammarGuards: { schema: 'wrong' } } } } });
  assert.ok(checkGrammarGuards(f.input).errors.length);
  assert.ok(checkGrammarGuards({ ...f.input, ruleIds: ['UNKNOWN'] }).errors.length);
});
