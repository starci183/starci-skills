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
  assert.equal(fs.existsSync(path.join(root, '.starci')), false, 'the host-data namespace holds no release source');
  for (const name of ['host-startup.md']) assert.equal(read(`skills/starci/references/${name}`).startsWith('---\n'), false, name);
});

test('one bootstrap locates the runtime for supported host projections',()=>{
  // One shipped bootstrap template: init/AGENTS.md. CLAUDE.md/DEVIN.md are install-time copies emitted only
  // when the host opts in, so no second template lives in the source tree.
  assert.ok(read('init/AGENTS.md').includes('CONTEXT.md'),'the bootstrap routes to the entry');
  assert.equal(fs.existsSync(path.join(root,'init','CLAUDE.md')),false,'the installer copies AGENTS.md at install time; no second template ships');
  assert.equal(fs.existsSync(path.join(root,'init','DEVIN.md')),false);
});

test('the entry runs the read-only host status on every invocation and heals only no-quota services', () => {
  const entry = read('skills/starci/SKILL.md');
  const status = entry.slice(entry.indexOf('## Host status on every invocation'), entry.indexOf('Load only the reference needed'));
  assert.ok(status.length > 0, 'the entry has its per-invocation host status section ahead of the routing table');
  const up = parseYaml(read('modules/cli/commands/reconciler/up.yaml'));
  const declared = new Set([...up.flags.map(flag => `--${flag.name}`), ...(up.json === 'flag' ? ['--json'] : [])]);
  const cited = [...new Set([entry, read('skills/starci/references/host-startup.md'), read('skills/starci/references/workflow-chat.md')]
    .flatMap(text => [...text.matchAll(/starci reconciler up((?: --[a-z-]+)*)/g)].flatMap(match => match[1].split(' ').filter(Boolean))))];
  assert.ok(cited.includes('--check') && cited.includes('--brief') && cited.includes('--services'), 'the skill cites the status and the heal');
  for (const flag of cited) assert.ok(declared.has(flag), `${flag} is a flag of starci reconciler up`);
  assert.match(status, /starci reconciler up --check --brief/);
  assert.match(status, /starci reconciler up --services/);
  assert.match(status, /Never start an agent seat from an action\s+other than start/);
  for (const seatStart of ['starci workflow start', 'starci supervisor start']) assert.ok(status.includes(seatStart), `${seatStart} is the named way a seat starts`);
});
