import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

// The companion skills under `skills/` are discovered by the host beside the entry, so their only contract
// is the frontmatter a host reads and the routing line in CONTEXT.md that sends a Codex chat to them.
const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
const skillDirs=fs.readdirSync(path.join(root,'skills'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
const frontmatter=text=>{const match=text.match(/^---\n([\s\S]*?)\n---\n/);assert.ok(match,'a skill starts with YAML frontmatter');return parseYaml(match[1]);};

test('every shipped skill declares its directory name and a description, and the package ships the folder',()=>{
  for(const name of ['define-goal','start-kernel','computer-use','orca-cli','orchestration','restart','workflow-chat','run-assisted-uat'])
    assert.ok(skillDirs.includes(name),`skills/${name} is part of the locked tree`);
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
});

test('the workflow-chat skill supervises the kernel through api.mjs and names no dead runtime paths',()=>{
  const skill=read('skills/workflow-chat/SKILL.md');
  assert.match(skill,/scripts\/kernel\/api\.mjs|bin\/starci\.mjs api\b/,'the chat drives the kernel through api.mjs, not a removed launcher');
  for(const dead of ['hosts/','cli/main.mjs','workflows/','kernel/store.mjs','launch.mjs','workflow-goal','workflow-run','workflow-approve'])
    assert.equal(skill.includes(dead),false,`workflow-chat must not name the dead surface ${dead}`);
});

test('the workflow-chat skill is product-agnostic, forbids writing the store and is routed from the entry',()=>{
  const skill=read('skills/workflow-chat/SKILL.md');
  assert.equal(/starci-academy|nivo|miamia|tayson|[A-Z]:\\/i.test(skill),false,'no repository names or machine paths');
  assert.ok(/## Never[\s\S]*runtime\.sqlite/.test(skill),'the Never section covers writing the ledger');
  assert.ok(/## Never[\s\S]*second workflow/.test(skill),'the Never section covers a second workflow');
  assert.ok(/inbox/.test(skill)&&/kernel terminal|api\.mjs/.test(skill),'a live kernel is driven through inbox rows and its terminal');
  assert.ok(/Never approve/.test(skill),'approval is the owner\'s');
  assert.ok(/`managed-agent` or `tool-unavailable`/.test(skill)&&/Orca host/.test(skill),'the api dispatch refusals the host cannot serve are relayed to the Orca host');
  const entry=read('CONTEXT.md');
  assert.ok(entry.includes('skills/workflow-chat'),'the entry routes a chat to the skill');
  // One shipped bootstrap template: init/AGENTS.md. CLAUDE.md/DEVIN.md are install-time copies emitted only
  // when the host opts in, so no second template lives in the source tree.
  assert.ok(read('init/AGENTS.md').includes('CONTEXT.md'),'the bootstrap routes to the entry');
  assert.equal(fs.existsSync(path.join(root,'init','CLAUDE.md')),false,'the installer copies AGENTS.md at install time; no second template ships');
});
