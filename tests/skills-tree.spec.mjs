import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';

// The companion skills under `skills/` are discovered by the host beside the entry, so their only contract
// is the frontmatter a host reads and the routing line in SKILL.md that sends a Codex chat to them.
const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
const skillDirs=fs.readdirSync(path.join(root,'skills'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
const frontmatter=text=>{const match=text.match(/^---\n([\s\S]*?)\n---\n/);assert.ok(match,'a skill starts with YAML frontmatter');return parseYaml(match[1]);};

test('every companion skill declares its directory name and a description, and the package ships the folder',()=>{
  assert.ok(skillDirs.includes('workflow-chat'));
  for(const name of skillDirs){
    const meta=frontmatter(read(`skills/${name}/SKILL.md`));
    // The Agent Skills specification requires the name to match the directory a host discovers it in.
    assert.equal(meta.name,name);
    assert.ok(typeof meta.description==='string'&&meta.description.trim().length>40,`${name} has a discovery description`);
  }
  // A skill that is not in the npm payload never reaches an installed host, so the folder is declared once in
  // package.json (the installer derives its payload from it) and named in the layout index.
  assert.ok(JSON.parse(read('package.json')).files.includes('skills/'));
  assert.equal(typeof parseYaml(read('INDEX.yaml')).folders.skills,'string');
});

test('the workflow-chat skill names only launcher commands that exist and the flags the headless host takes',()=>{
  const skill=read('skills/workflow-chat/SKILL.md');
  const launcher=read('hosts/orca/launch.mjs');
  const list=name=>JSON.parse(launcher.match(new RegExp(`const ${name}=(\\[[^\\]]*\\])`))[1].replaceAll("'",'"'));
  const known=new Set([...list('KERNEL_COMMANDS'),...list('VIEW_COMMANDS')]);
  // Every backticked `workflow-<x>` the skill tells a chat to run must be a command the launcher dispatches,
  // because a chat cannot recover from a usage error the way an Orca monitor could read the sidebar.
  const named=new Set([...skill.matchAll(/`(workflow-[a-z-]+)(?:[ `])/g)].map(match=>match[1]));
  for(const command of ['workflow-goal','workflow-approve','workflow-run','workflow-status','workflow-stop'])assert.ok(named.has(command),`the skill names ${command}`);
  for(const command of named)assert.ok(known.has(command),`${command} is a launcher command`);
  for(const flag of ['--host-adapter headless','STARCI_HOST=headless','--accept-critique','--allow-dynamic','--lane','--scope','--host <skill root>'])assert.ok(skill.includes(flag),flag);
  for(const flag of ['--accept-critique','--allow-dynamic','--lane','--scope','--host'])assert.ok(launcher.includes(flag),`${flag} is a launcher flag`);
});

test('the workflow-chat skill is product-agnostic, forbids writing the store and is routed from the entry for both hosts',()=>{
  const skill=read('skills/workflow-chat/SKILL.md');
  assert.equal(/starci-academy|nivo|miamia|tayson|[A-Z]:\\/i.test(skill),false,'no repository names or machine paths');
  assert.ok(/## Never[\s\S]*state\.json/.test(skill),'the Never section covers state.json');
  assert.ok(/## Never[\s\S]*second workflow/.test(skill),'the Never section covers a second workflow');
  assert.ok(/stop\.flag/.test(skill)&&/inbox/.test(skill),'a live kernel is driven through the inbox and the stop flag');
  assert.ok(/Never approve/.test(skill),'approval is the owner\'s');
  assert.ok(/host-unsupported/.test(skill)&&/Orca host/.test(skill),'unsupported operations are relayed to the Orca host');
  const entry=read('SKILL.md');
  assert.ok(entry.includes('skills/workflow-chat/SKILL.md'),'the entry routes a chat to the skill');
  assert.ok(entry.includes('.dist/docs/workflow-chat.md'),'the entry links the owner-facing doc');
  assert.ok(fs.existsSync(path.join(root,'docs/workflow-chat.md')));
  // Codex reads the host AGENTS.md and Claude Code reads CLAUDE.md; both are the same bootstrap and both route
  // to SKILL.md, so the routing line above is what gives the two chats identical behaviour.
  for(const name of ['init/AGENTS.md','init/CLAUDE.md'])assert.ok(read(name).includes('.claude/SKILL.md'),`${name} routes to the entry`);
  assert.equal(read('init/AGENTS.md'),read('init/CLAUDE.md'));
});
