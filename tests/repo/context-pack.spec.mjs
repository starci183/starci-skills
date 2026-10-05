import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import { buildContext, renderPromptReads } from '../../scripts/context/pack.mjs';
import { declaredReadTokens, resolveReadReference } from '../../scripts/context/read-refs.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { EXAMPLE_CATALOG_FILE } from '../../scripts/lib/example-refs.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const PACK=path.join(ROOT,'scripts','context','pack.mjs');
// Context assembly is a function, not the op agent's discretion —
// `pack.mjs --op <id> --json` returns
// {mandatory:[{path,why}], ownedFiles, truncated, missing} so the dispatch
// prompt can enumerate the real read list instead of 'read CONTEXT.md'.
const run=(...args)=>spawnSync(process.execPath,[PACK,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const norm=p=>String(p).replaceAll('\\','/');
const mandatoryPaths=body=>(body?.context?.mandatory??body?.mandatory??[]).map(e=>norm(typeof e==='string'?e:e?.path));

test('--op code.refactor --json emits the mandatory reads in load order',t=>{
  const r=run('--op','code.refactor','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  const paths=mandatoryPaths(body);
  assert.ok(paths.length>0,'context.mandatory is empty — the op would choose its own context again');
  assert.ok(paths.some(p=>/CONTEXT\.md$/i.test(p)),`mandatory reads must start at CONTEXT.md, got: ${paths.join(', ')}`);
  assert.ok(paths.some(p=>/ops\/code\.refactor\.yaml$/.test(p)),`mandatory reads must carry the op brief, got: ${paths.join(', ')}`);
  assert.ok(paths.some(p=>/verdict-contract\.yaml$/.test(p)),`mandatory reads must carry the verdict contract, got: ${paths.join(', ')}`);
});

test('missing --state degrades: exit 0, mandatory reads still resolve',t=>{
  const fx=fs.mkdtempSync(path.join(os.tmpdir(),'starci-pack-'));
  t.after(()=>fs.rmSync(fx,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  // A --state dir that was never created is the cold-checkout case — no .starciwork yet.
  // (--repo is the runtime root, not the target repo — leave it defaulted.)
  for(const args of [
    ['--op','code.refactor','--json'],
    ['--op','code.refactor','--state',path.join(fx,'absent','.starciwork'),'--json'],
  ]){
    const r=run(...args);
    assert.equal(r.status,0,`pack ${args.join(' ')} must not fail on missing state: ${r.stderr}`);
    const body=out(r);
    assert.ok(body&&mandatoryPaths(body).length>0,'mandatory reads must resolve even with no workflow state');
  }
});

test('selected READ refs bind canonical roots and hashes, expand braces, and preserve instance refs', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-context-roots-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sourceRoot = path.join(dir, 'source'), appRoot = path.join(dir, 'app'), stateDir = path.join(appRoot, '.starciwork');
  const write = (root, file, content = file) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  for (const file of ['CONTEXT.md', 'modules/ops/ops/sample.op.yaml', 'modules/ops/_common.yaml', 'modules/kernel/verdict-contract.yaml', 'modules/kernel/dispatch.yaml', 'knowledge/a.yaml', 'knowledge/b.yaml']) write(sourceRoot, file);
  write(sourceRoot, 'modules/ops/_common.yaml', 'shared: {}');
  write(appRoot, '.starcistacks/application-stacks.yaml');
  const doc = { id: 'sample.op', reads: [{ id: 'common', path: 'params.mode' }], policy: { executionModes: {
    one: { reads: [{ id: 'source', path: 'knowledge/{a,b}.yaml' }, { id: 'app', path: '.starcistacks/application-stacks.yaml' }], writes: [], proofs: [], blockers: [] },
    other: { reads: [{ id: 'sibling', path: 'knowledge/absent.yaml' }] },
  } } };
  const context = buildContext({ op: 'sample.op', skillRoot: sourceRoot, appRoot, stateDir, params: { mode: 'one' }, briefDoc: doc, ownedPaths: [] });
  assert.deepEqual(context.requiredMissing, []);
  assert.equal(context.mandatory.some((row) => row.path === 'knowledge/absent.yaml'), false);
  const source = context.mandatory.find((row) => row.path === 'knowledge/a.yaml');
  assert.equal(source.absolute, path.join(sourceRoot, 'knowledge/a.yaml'));
  assert.equal(source.rootKind, 'source'); assert.equal(source.sha256, sha256(fs.readFileSync(source.absolute)));
  const app = context.mandatory.find((row) => row.path === '.starcistacks/application-stacks.yaml');
  assert.equal(app.root, appRoot); assert.equal(app.rootKind, 'app');
  assert.equal(context.missing.includes('params.mode'), false);
  assert.match(renderPromptReads(context).join('\n'), /source.*knowledge/);
});

test('READ expansion no longer silently drops matches after fifty and reports real truncation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-context-glob-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'knowledge'));
  for (let i = 0; i < 501; i += 1) fs.writeFileSync(path.join(root, 'knowledge', `${i}.yaml`), 'schema: sample@1');
  const many = resolveReadReference('knowledge/*.yaml', { sourceRoot: root });
  assert.equal(many.resolved.length, 500); assert.equal(many.truncated, true);
  assert.deepEqual(resolveReadReference('knowledge/missing.yaml', { sourceRoot: root }).missing, ['knowledge/missing.yaml']);
  assert.equal(resolveReadReference('../escape.yaml', { sourceRoot: root }).kind, 'invalid');
  assert.equal(resolveReadReference('{knowledge,../escape}/*.yaml', { sourceRoot: root }).kind, 'invalid');
  assert.equal(resolveReadReference('N/index.yaml', { sourceRoot: root }).kind, 'instance');
  assert.equal(resolveReadReference('.starciwork/features/<feature>/index.yaml', { sourceRoot: root }).kind, 'template');
});

test('literal brace READs require every file and linked prefixes cannot leave a root', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-read-link-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'source'), outside = path.join(dir, 'outside');
  fs.mkdirSync(path.join(root, 'knowledge'), { recursive: true }); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(root, 'knowledge/a.yaml'), 'canonical: true'); fs.writeFileSync(path.join(outside, 'private.yaml'), 'outside: true');
  const partial = resolveReadReference('knowledge/{a,b}.yaml', { sourceRoot: root });
  assert.equal(partial.resolved.length, 1); assert.deepEqual(partial.missing, ['knowledge/b.yaml']);
  fs.symlinkSync(outside, path.join(root, 'knowledge/link'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const token of ['knowledge/link/*.yaml', 'knowledge/link/private.yaml', 'knowledge/link']) {
    const refused = resolveReadReference(token, { sourceRoot: root });
    assert.equal(refused.kind, 'invalid'); assert.equal(refused.error, 'READ_LINKED'); assert.deepEqual(refused.resolved, []);
  }
});

test('a declared catalog files its actual source/compiler/test union under canonical Source with exact hashes', (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-context-reference-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sourceRoot = path.join(dir, 'source'), appRoot = path.join(dir, 'target');
  const write = (relative, content = relative) => { const file = path.join(sourceRoot, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  const catalog = EXAMPLE_CATALOG_FILE, prefix = `${path.dirname(catalog)}/private-app`;
  const row = { id: 'private-reference', path: 'private-app', lane: 'backend', title: 'Private reference', summary: 'The actual source and owning programs.',
    relatedRules: ['R89'], files: ['be/src/service.ts', 'be/contracts/events.json'], entrypoint: 'be/src/service.ts', projects: ['be/tsconfig.json'], tests: ['be/owner.spec.ts'] };
  const union = [...row.files, ...row.projects, ...row.tests].map((file) => `${prefix}/${file}`);
  for (const file of ['CONTEXT.md', 'modules/ops/ops/sample.op.yaml', 'modules/kernel/verdict-contract.yaml', 'modules/kernel/dispatch.yaml',
    'docs/architecture.md', 'docs/code-pattern-enforcement.md', ...union]) write(file);
  write('modules/ops/_common.yaml', 'shared: {}');
  write('modules/schemas/code-example-catalog.schema.yaml', fs.readFileSync(path.join(ROOT, 'modules/schemas/code-example-catalog.schema.yaml')));
  write(`${prefix}/hfs.json`, JSON.stringify({ kind: 'app' }));
  const saveCatalog = () => write(catalog, JSON.stringify({ schema: 'starci/code-example-catalog@1', title: 'Private references', purpose: 'Test declared READ expansion.', examples: [row] }));
  saveCatalog();
  const doc = { id: 'sample.op', reads: [{ id: 'standard', path: `docs/architecture.md + docs/code-pattern-enforcement.md + ${catalog}` }], writes: [], proofs: [], blockers: [] };
  const build = () => buildContext({ op: doc.id, skillRoot: sourceRoot, appRoot, briefDoc: doc, ownedPaths: [] });
  const context = build(); assert.deepEqual(context.requiredMissing, []);
  const expected = ['docs/architecture.md', 'docs/code-pattern-enforcement.md', catalog, ...union];
  for (const file of expected) {
    const entries = context.mandatory.filter((entry) => entry.path === file);
    assert.equal(entries.length, 1, `deduplication of ${file}`);
    assert.equal(entries[0].rootKind, 'source'); assert.equal(entries[0].absolute, path.join(sourceRoot, file));
    assert.equal(entries[0].sha256, sha256(fs.readFileSync(entries[0].absolute)));
  }
  assert.deepEqual(context.declaredReads[0].resolved, expected);
  assert.deepEqual(context.mandatory.filter((entry) => entry.why?.startsWith('brief read [standard]')).map((entry) => entry.path), expected);
  doc.reads.unshift({ id: 'source', path: union.join(' + ') });
  const earlier = build();
  for (const relative of union) {
    const filed = earlier.mandatory.filter((entry) => entry.path === relative);
    assert.equal(filed.length, 1, 'an earlier explicit source/compiler/test READ still reuses one hash');
    assert.ok(filed[0].why.split('\n').some((why) => why.startsWith('brief read [standard]')), 'dedup retains the later catalog provenance');
  }
  fs.unlinkSync(path.join(sourceRoot, union[0])); assert.ok(build().requiredMissing.includes(catalog), 'a missing indexed source refuses the declared catalog READ');
  write(union[0]); row.files.push('../outside.ts'); saveCatalog(); assert.ok(build().requiredMissing.includes(catalog), 'catalog path escape refuses');
  row.files.pop(); saveCatalog();
  write(catalog, JSON.stringify({ schema: 'starci/code-example-catalog@1', title: 'Private references', purpose: 'Duplicate identity.', examples: [row, row] }));
  assert.ok(build().requiredMissing.includes(catalog), 'duplicate IDs refuse rather than selecting one definition');
});

test('declared READ tokens preserve brace alternation and selectors while splitting plus and newline references', () => {
  assert.deepEqual(declaredReadTokens(null), []);
  assert.deepEqual(declaredReadTokens(' knowledge/{a,b}.yaml fields + docs/architecture.md\r\n\n params.mode + '),
    ['knowledge/{a,b}.yaml fields', 'docs/architecture.md', 'params.mode']);
  assert.deepEqual(declaredReadTokens('knowledge/a.yaml\rknowledge/b.yaml'), ['knowledge/a.yaml\rknowledge/b.yaml'],
    'the READ delimiter contract does not split a lone CR');
});
