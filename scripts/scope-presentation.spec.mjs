import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderScope, previewScope } from './scope-presentation.mjs';
import { architectureErrors } from './scope-architecture.mjs';
import { scopeErrors, scopeHash } from './mission-scope.mjs';

function architecturalMission() {
  const ref = 'source:reviewed-contract-and-storage';
  const node = (id, kind, role, status = 'discovered') => ({id,kind,label:id,owner:`${id} owner`,role,status,evidence:status === 'discovered' ? [ref] : []});
  const edge = (from, to, status = 'discovered') => ({from,to,label:`${from} calls ${to}`,status,evidence:status === 'discovered' ? [ref] : []});
  const delivery = JSON.parse(readFileSync(new URL('../resources/delivery.json', import.meta.url)));
  return {version:1,goal:'Preserve history across a resumed conversation', discovery:{
    version:1,stage:'handoff', repositories:[{role:'app',project:'fixture',repository:'/repo/app',routeRef:'declared:app',head:'a'.repeat(40)}],
    impacts:[{id:'conversation',role:'app',routes:['/conversation'],code:['conversation boundary'],behavior:'Recover history',tags:['documentation'],evidence:[ref]}],
    destinations:[{role:'app',kind:'artifact',target:'reviewed scope'}],unresolved:[],
    lanes:Object.fromEntries(Object.keys(delivery.lanes).map(id => [id,{status:'not-applicable',reason:'Presentation contract fixture'}])),
    architecture:{nodes:[node('screen','ui','app'),node('entry','api','app'),node('engine','service','app'),node('history','data','app'),node('provider','external',null,'proposed')],
      edges:[edge('screen','entry'),edge('entry','engine'),edge('engine','history'),edge('engine','provider','proposed')]}
  }};
}

test('scope preview exposes actual routes and code, escapes cell content and separates plans from proof', () => {
  const mission = { version: 2, goal: 'Owner | creates\ninstance', discovery: {
    repositories: [{ role: 'be', repository: '/repo/service' }],
    impacts: [{ role: 'be', routes: ['/a/b', '/a/b/[id]'], code: ['installation service'] }],
    lanes: { backend: { status: 'planned', owner: 'be', dependsOn: ['business'] } },
  } };
  const result = renderScope(mission);
  assert.match(result, /Owner &#124; creates instance/);
  assert.match(result, /\/a\/b\/\[id\]/);
  assert.match(result, /\/repo\/service.*installation service/);
  assert.match(result, /planned, not executed or verified/);
  assert.match(result, /Not established/);
  assert.ok(result.indexOf('Biz/Goal') < result.indexOf('Impact: routes'));
});

test('corrected scope emits only changed rows and forecast without modifying previous mission', () => {
  const previous = { version: 1, goal: 'First', target: 'unchanged' };
  const bytes = JSON.stringify(previous);
  const result = renderScope({ ...previous, version: 2, goal: 'Corrected' }, previous);
  assert.match(result, /Corrected/);
  assert.match(result, /Workflow forecast/);
  assert.doesNotMatch(result, /\| Target \|/);
  assert.equal(JSON.stringify(previous), bytes);
});

test('preview is read only and refuses absent mission instead of inventing scope', () => {
  const session = mkdtempSync(path.join(os.tmpdir(), 'scope-preview-'));
  try {
    const file = path.join(session, 'state.json');
    const bytes = JSON.stringify({ mission: { version: 1, goal: 'Read only' } });
    writeFileSync(file, bytes);
    assert.match(previewScope(session), /Read only/);
    assert.equal(readFileSync(file, 'utf8'), bytes);
    writeFileSync(file, '{}');
    assert.throws(() => previewScope(session), /MISSION_MISSING/);
  } finally { rmSync(session, { recursive: true, force: true }); }
});

test('initial confirmation CLI renders typed architecture, owners and evidence without modifying the draft', () => {
  const mission = architecturalMission();
  assert.deepEqual(scopeErrors(mission), []);
  const session = mkdtempSync(path.join(os.tmpdir(), 'scope-architecture-'));
  try {
    const bytes = JSON.stringify({mission});
    writeFileSync(path.join(session,'state.json'), bytes);
    const cli = () => execFileSync(process.execPath,[fileURLToPath(new URL('./session-open.mjs',import.meta.url)),'preview',session],{encoding:'utf8'});
    const rendered = cli();
    for (const kind of ['UI','API','Service','Data','External dependency']) assert.ok(rendered.includes(`${kind}:`));
    assert.match(rendered,/```mermaid\nflowchart LR/);
    assert.match(rendered,/n0 -->.*n1/);
    assert.match(rendered,/n2 -.->.*Proposed.*n4/);
    assert.match(rendered,/Owner: history owner/);
    assert.match(rendered,/1\. source:reviewed-contract-and-storage/);
    assert.match(rendered,/not implementation proof/);
    assert.equal(readFileSync(path.join(session,'state.json'),'utf8'),bytes);
    mission.language='vi';
    writeFileSync(path.join(session,'state.json'),JSON.stringify({mission}));
    assert.match(cli(),/Kiến trúc.*Chủ sở hữu/s);
  } finally { rmSync(session,{recursive:true,force:true}); }
});

test('material architecture feedback changes the sealed scope hash and redraws without rewriting the original', () => {
  const original = architecturalMission(); const bytes = JSON.stringify(original);
  const changed = structuredClone(original);
  changed.discovery.architecture.nodes[3].owner='application history service';
  changed.discovery.architecture.edges[2].status='proposed';
  assert.notEqual(scopeHash(original),scopeHash(changed));
  changed.version++;
  const rendered=renderScope(changed,original);
  assert.match(rendered,/application history service/);
  assert.doesNotMatch(rendered,/Owner: history owner/);
  assert.match(rendered,/n2 -.->.*n3/);
  assert.match(rendered,/Workflow forecast/);
  assert.notEqual(scopeHash(original),scopeHash(changed));
  assert.equal(JSON.stringify(original),bytes);
  changed.language='vi';
  assert.match(renderScope(changed),/Kiến trúc.*Chủ sở hữu/s);
});

test('architecture refuses forged graph references and unsupported discovery claims at the scope gate', () => {
  for (const mutate of [
    g=>g.nodes.push({...g.nodes[0]}), g=>g.edges[0].to='missing',
    g=>g.nodes[0].role='foreign', g=>g.nodes[0].owner=null,
    g=>g.nodes[0].evidence=[], g=>g.edges[0].evidence=['unreviewed:claim'],
    g=>g.nodes[0].status='verified', g=>g.nodes[0].id='x] --> attacker',
  ]) {
    const mission=architecturalMission(); mutate(mission.discovery.architecture);
    assert.ok(scopeErrors(mission).length);
    assert.throws(()=>renderScope(mission),/architecture/);
  }
});

test('missing graph stays unresolved and hostile labels cannot introduce Mermaid instructions', () => {
  const absent=renderScope({version:1,goal:'Undiscovered'});
  assert.match(absent,/Architecture: unresolved/);
  assert.doesNotMatch(absent,/```mermaid/);
  assert.doesNotMatch(absent,/-->|-\.->/);
  const mission=architecturalMission();
  mission.discovery.architecture.nodes[0].label='screen"]\nclick n0 "https://attacker.invalid"\n```<script>';
  assert.deepEqual(architectureErrors(mission.discovery),[]);
  const rendered=renderScope(mission);
  assert.doesNotMatch(rendered,/\nclick |<script>|\n```<script>/);
  assert.match(rendered,/#34;#93; click n0/);
});
