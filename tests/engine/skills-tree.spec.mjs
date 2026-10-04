import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {parseYaml} from '../../engine/yaml.mjs';

// Native host discovery reads one public entry and each provider's explicit-selection metadata.
const root=path.resolve(import.meta.dirname,'..', '..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
const skillDirs=fs.readdirSync(path.join(root,'skills'),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,'skills',entry.name,'SKILL.md'))).map(entry=>entry.name);
const frontmatter=text=>{const match=text.match(/^---\n([\s\S]*?)\n---\n/);assert.ok(match,'a skill starts with YAML frontmatter');return parseYaml(match[1]);};

test('one shipped public skill declares native explicit-selection policies and the payload owner',()=>{
  assert.deepEqual(skillDirs, ['starci']);
  for(const name of skillDirs){
    const meta=frontmatter(read(`skills/${name}/SKILL.md`));
    // The Agent Skills specification requires the name to match the directory a host discovers it in.
    assert.equal(meta.name,name);
    assert.ok(typeof meta.description==='string'&&meta.description.trim().length>40,`${name} has a discovery description`);
  }
  // A skill that is not in the npm payload never reaches an installed host, so the folder is declared once in
  // package.json (the installer derives its payload from it).
  const files=JSON.parse(read('package.json')).files;
  assert.ok(files.some(entry=>entry==='skills'||entry==='skills/'),'package.json files[] ships skills/');
  assert.ok(files.some(entry=>entry==='.starci'||entry==='.starci/'),'package.json files[] ships internal host prompts');
  const meta = frontmatter(read('skills/starci/SKILL.md'));
  assert.equal(meta['disable-model-invocation'], true, 'Claude requires explicit user selection');
  assert.deepEqual(meta.triggers, ['user'], 'Devin CLI permits only its user trigger');
  const policy = parseYaml(read('skills/starci/agents/openai.yaml'));
  assert.equal(policy.policy.allow_implicit_invocation, false, 'Codex disables automatic selection');
});

test('all routed procedures exist without public discovery frontmatter',()=>{
  const entry = read('skills/starci/SKILL.md');
  const references = [...entry.matchAll(/`(references\/[^`]+\.md)`/g)].map(match => match[1]);
  assert.ok(references.length > 0);
  for (const relative of references) assert.equal(read(`skills/starci/${relative}`).startsWith('---\n'), false, relative);
  const host = fs.readdirSync(path.join(root, '.starci/host')).filter(name => name.endsWith('.md')).sort();
  assert.deepEqual(host, ['maintenance.md', 'startup.md']);
  for (const name of host) assert.equal(read(`.starci/host/${name}`).startsWith('---\n'), false, name);
});

test('one bootstrap locates the runtime for supported host projections',()=>{
  // One shipped bootstrap template: init/AGENTS.md. CLAUDE.md/DEVIN.md are install-time copies emitted only
  // when the host opts in, so no second template lives in the source tree.
  assert.ok(read('init/AGENTS.md').includes('CONTEXT.md'),'the bootstrap routes to the entry');
  assert.equal(fs.existsSync(path.join(root,'init','CLAUDE.md')),false,'the installer copies AGENTS.md at install time; no second template ships');
  assert.equal(fs.existsSync(path.join(root,'init','DEVIN.md')),false);
});
