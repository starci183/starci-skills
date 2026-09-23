import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  GRAMMAR_DIST_FIX,assertGrammarDistFresh,cssTokenDeclarations,grammarDistMain,grammarDistRefusal,grammarDistStatus,grammarPackageOf
} from '../scripts/checks/grammar-dist.mjs';
import {STAMP_FILE,sourceDigest,sourceInputs} from '../packages/grammar/scripts/build-stamp.mjs';
import {OLD_DANGER,SRC_CSS,grammarFixture} from './fixtures/grammar-dist.mjs';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FIX_LINE=`Fix: ${GRAMMAR_DIST_FIX}.`;
const refused=(status,state)=>{
  assert.equal(status.state,state,status.detail);
  assert.equal(status.ok,false);
  assert.equal(status.fix,'run npm run build in packages/grammar');
};

test('a dist built and stamped from the current source is fresh',t=>{
  const g=grammarFixture(t);
  const status=grammarDistStatus(g.root);
  assert.equal(status.state,'fresh',status.detail);
  assert.equal(status.ok,true);
  assert.equal(status.tokens.compared,3);
  assert.equal(assertGrammarDistFresh(g.root).state,'fresh');
  const cli=grammarDistMain(['--root',g.root]);
  assert.equal(cli.exitCode,0);
  assert.match(cli.text,/^grammar dist: fresh/);
});

test('the source digest ignores stories, specs and tests but covers the build inputs',t=>{
  const g=grammarFixture(t);
  const inputs=sourceInputs(g.root);
  assert.deepEqual(inputs,['scripts/copy-css.mjs','src/core/index.ts','src/core/styles.css','tsconfig.build.json']);
  const before=sourceDigest(g.root);
  g.write('src/core/index.spec.ts','// a spec edit is not a build input\n');
  g.write('src/stories/Button.stories.tsx','// neither is a story\n');
  assert.equal(sourceDigest(g.root),before);
  g.write('src/core/index.ts','export const family = "core"\r\n');
  assert.equal(sourceDigest(g.root),before,'a CRLF checkout of the same source has the same digest');
  const manifest=JSON.parse(g.read('package.json'));
  g.write('package.json',JSON.stringify({...manifest,files:['dist','src']}));
  assert.notEqual(sourceDigest(g.root),before,'package.json files decide what ships');
  g.write('package.json',JSON.stringify(manifest));
  g.write('scripts/copy-css.mjs','// copies differently now\n');
  assert.notEqual(sourceDigest(g.root),before);
});

test('a source change after the build makes the dist stale and names the token drift',t=>{
  const g=grammarFixture(t);
  g.write('src/core/styles.css',SRC_CSS.replace('oklch(50.13% 0.1783 28.70)','oklch(52% 0.19 28.7)'));
  const status=grammarDistStatus(g.root);
  refused(status,'stale');
  assert.match(status.detail,/--starci-core-danger src=oklch\(52% 0\.19 28\.7\) dist=oklch\(50\.13% 0\.1783 28\.70\)/);
  assert.throws(()=>assertGrammarDistFresh(g.root),error=>error.message.endsWith(FIX_LINE));
  const cli=grammarDistMain(['--root',g.root]);
  assert.equal(cli.exitCode,1);
  assert.ok(cli.text.includes(FIX_LINE));
});

test('a stale 0.4.x build without a stamp is refused, with the old danger token in evidence',t=>{
  const g=grammarFixture(t,{stamp:false});
  g.write('dist/core/styles.css',SRC_CSS.replace('oklch(50.13% 0.1783 28.70)',OLD_DANGER));
  const status=grammarDistStatus(g.root);
  refused(status,'unstamped');
  assert.equal(status.tokens.differences[0].token,'--starci-core-danger');
  assert.equal(status.tokens.differences[0].dist,OLD_DANGER);
});

test('a version bump without a rebuild is stale',t=>{
  const g=grammarFixture(t);
  g.write('package.json',g.read('package.json').replace('"0.5.0"','"0.5.1"'));
  const status=grammarDistStatus(g.root);
  refused(status,'stale');
  assert.match(status.detail,/built as version 0\.5\.0 but package\.json is 0\.5\.1/);
});

test('a missing dist is refused',t=>{
  const g=grammarFixture(t,{build:false});
  refused(grammarDistStatus(g.root),'missing');
  const cli=grammarDistMain(['--root',g.root]);
  assert.equal(cli.exitCode,1);
  assert.ok(cli.text.includes(`is missing`)&&cli.text.includes(FIX_LINE));
});

test('a hand-edited dist token is tampered even though the stamp still matches the source',t=>{
  const g=grammarFixture(t);
  g.write('dist/core/styles.css',SRC_CSS.replace('oklch(50.13% 0.1783 28.70)',OLD_DANGER));
  const status=grammarDistStatus(g.root);
  refused(status,'tampered');
  assert.match(status.detail,/--starci-core-danger/);
  assert.equal(status.tokens.differenceCount,1);
});

test('a hand-edited dist module is tampered through the dist digest',t=>{
  const g=grammarFixture(t);
  g.write('dist/core/index.js','export const family = "patched"\n');
  const status=grammarDistStatus(g.root);
  refused(status,'tampered');
  assert.match(status.detail,/dist files changed after the build/);
});

test('an unreadable stamp is refused like a missing one',t=>{
  const g=grammarFixture(t);
  g.write(`dist/${STAMP_FILE}`,'{not json');
  refused(grammarDistStatus(g.root),'unstamped');
});

test('a registry install carries no source: unverifiable is allowed, but its own stamp still binds',t=>{
  const legacy=grammarFixture(t,{withSource:false,stamp:false,label:'registry-legacy'});
  const old=grammarDistStatus(legacy.root);
  assert.equal(old.state,'unverifiable');
  assert.equal(old.ok,true);
  const stamped=grammarFixture(t,{withSource:false,label:'registry-stamped'});
  assert.equal(grammarDistStatus(stamped.root).state,'unverifiable');
  stamped.write('dist/core/styles.css',SRC_CSS.replace('oklch(50.13% 0.1783 28.70)',OLD_DANGER));
  refused(grammarDistStatus(stamped.root),'tampered');
});

test('a file: consumer link resolves to the grammar package and its dist is judged there',t=>{
  const g=grammarFixture(t);
  const consumer=fs.mkdtempSync(path.join(path.dirname(g.root),'starci-consumer-'));
  t.after(()=>fs.rmSync(consumer,{recursive:true,force:true}));
  fs.writeFileSync(path.join(consumer,'package.json'),'{"name":"consumer","dependencies":{"@starci/grammar":"file:../grammar"}}');
  fs.mkdirSync(path.join(consumer,'node_modules','@starci'),{recursive:true});
  fs.symlinkSync(g.root,path.join(consumer,'node_modules','@starci','grammar'),'junction');
  const css=path.join(consumer,'node_modules','@starci','grammar','dist','core','styles.css');
  const owner=grammarPackageOf(css);
  assert.equal(owner.root,fs.realpathSync(g.root));
  assert.equal(owner.inDist,true);
  assert.equal(grammarDistRefusal(css),null);
  assert.equal(grammarPackageOf(path.join(g.root,'src','core','styles.css')).inDist,false);
  assert.equal(grammarDistRefusal(path.join(consumer,'package.json')),null,'a file outside any grammar package is not a grammar dist');
  g.write('src/core/index.ts','export const family = "core-next"\n');
  const refusal=grammarDistRefusal(css);
  assert.equal(refusal.state,'stale');
  assert.ok(refusal.message.endsWith(FIX_LINE));
});

test('token declarations ignore comments and collapse whitespace',()=>{
  assert.deepEqual(cssTokenDeclarations('/* --x: 1 */ :root{ --a:  1px  2px ; --b: var(--a) }'),
    [{name:'--a',value:'1px 2px'},{name:'--b',value:'var(--a)'}]);
});

test('npm run check runs the grammar dist check',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(repoRoot,'package.json'),'utf8'));
  assert.match(manifest.scripts.check,/node scripts\/checks\/grammar-dist\.mjs/);
  const grammar=JSON.parse(fs.readFileSync(path.join(repoRoot,'packages','grammar','package.json'),'utf8'));
  assert.match(grammar.scripts.build,/node scripts\/build-stamp\.mjs$/,'the build ends by stamping dist');
});

test('the CLI exits non-zero with the exact fix message on a stale dist',t=>{
  const g=grammarFixture(t,{stamp:false});
  const run=spawnSync(process.execPath,[path.join(repoRoot,'scripts','checks','grammar-dist.mjs'),'--root',g.root],{encoding:'utf8'});
  assert.equal(run.status,1);
  assert.ok(run.stderr.includes('run npm run build in packages/grammar'),run.stderr);
});
