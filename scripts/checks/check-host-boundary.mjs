// check-host-boundary.mjs — CONTRIBUTING.md rule 5, executable.
//
// Host calls go through scripts/api/orca/. Two ways that breaks, both red here:
//   code   — a .mjs outside scripts/api/orca/ imports the raw runner (ORCA,
//            orcaRun, orcaCall) from the wrapper lib instead of calling a
//            wrapper, or (tests/ and packages/ only) spawns orca. A spawn of orca
//            in runtime code is scripts/checks/check-layers.mjs's finding.
//   prose  — agent-facing text tells an agent to run `orca <verb>`, to run a
//            node path that is not a scripts/api/orca/<verb>.mjs wrapper, or to
//            load/read modules/host/orca/*.
//
// modules/host/orca/** is the contract itself and skills/{orca-cli,
// orchestration,computer-use} are the owner's own chat tools, so both quote
// orca commands on purpose and are not agent-facing prose.
//
// scripts/checks/host-boundary.allow lists `path:line  # reason` exemptions for
// lines a lane that owns the file has not rewritten yet.
import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {walkFiles} from './common.mjs';
import {spawnCalls} from '../lib/spawn-calls.mjs';
import {readRules} from './check-layers.mjs';

const WRAPPER_DIR='scripts/api/orca';
const ALLOW_FILE='scripts/checks/host-boundary.allow';
// This check names the patterns it bans.
const ALLOW_SELF='scripts/checks/check-host-boundary.mjs';

// Agent-facing prose: what a kernel, op, chat or supervisor agent is told to do.
const PROSE_ROOTS=['CONTEXT.md','modules/kernel','modules/ops','modules/supervisor',
  'skills/define-goal','skills/start-kernel','skills/workflow-chat','init'];
const PROSE_EXT=new Set(['.md','.yaml','.yml','.txt']);
const CODE_ROOTS=['engine','scripts','modules','bin','init','tests','packages'];

const rel=(root,file)=>path.relative(root,file).replaceAll('\\','/');

function walk(dir,keep,out=[]){
  out.push(...walkFiles(dir,{filter:(_,full)=>keep(full),exclude:name=>name==='node_modules'||name.startsWith('.'),ignoreReadErrors:true}));
  return out;
}

/** The first word of every command the Orca API inventory publishes. */
function orcaVerbs(root){
  try{
    const api=parseYaml(fs.readFileSync(path.join(root,'modules','host','orca','api.yaml'),'utf8'));
    const verbs=new Set((api?.publicCommands??[]).map(c=>String(c).split(/\s+/)[0]).filter(Boolean));
    return verbs.size?verbs:null;
  }catch{return null;}
}

export function readAllowList(root){
  const file=path.join(root,ALLOW_FILE);
  const allow=new Map();
  if(!fs.existsSync(file))return allow;
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const [entry,...rest]=line.split('#');
    const key=entry.trim();
    if(key)allow.set(key,rest.join('#').trim()||'no reason given');
  }
  return allow;
}

// `orca <verb>` in command position: line start, a code fence, a backtick, a
// quote, a shell prompt or a pipe/chain operator. 'the kernel never runs the
// orca call itself' is prose about orca, not a command, and its next word is
// not a published verb either.
const COMMAND_POSITION=/(?:^|[`'"($]|\|\||&&|;|\|)\s*orca\s+([a-z][a-z-]*)/;
const NODE_PATH=/node\s+(\S*orca\S*)/g;
const LOADS_HOST=/\b(load|loads|loading|read|reads|reading)\b[^.\n]{0,100}modules\/host\/orca/i;
// (c) agent-launch: every agent launch is orchestration worker-start (modules/kernel/contract-changes/
// launch-through-worker-start.yaml). A terminal the runtime creates itself is the bypass: the terminalCreate wrapper,
// the calls.yaml `terminal-create` call, a `terminal create` argv or an `orca terminal create` command string. Only
// code is read, comment lines skipped; a plain shell that is not an agent needs a reviewed host-boundary.allow entry.
const LAUNCH_ROOTS=['engine','scripts','bin','init','modules','packages'];
const TERMINAL_LAUNCH=[
  [/\bterminalCreate\b/,'the terminalCreate wrapper'],
  [/['"`]terminal-create['"`]/,"the calls.yaml 'terminal-create' call"],
  [/['"`]terminal['"`]\s*,\s*['"`]create['"`]/,"a ['terminal','create'] argv"],
  [/['"`][^'"`\n]*\borca(?:\.exe)?\s+terminal\s+create\b/,'an `orca terminal create` command'],
];
// (d) agent-cli-spawn: an agent never runs as a child process of a runtime script - the PreToolUse hook cannot see it
// and Orca cannot supervise it (modules/kernel/contract-changes/draw-critic-worker-start.yaml). Read structurally with
// the TypeScript AST: a call whose callee is bound to node:child_process (spawn, spawnSync, exec, execSync, execFile,
// execFileSync, fork) and whose command - a literal, a const resolving to one, either branch of a conditional, or the
// first program word of a shell string / a cmd|sh|powershell argv - names an agent CLI (or its .cmd/.exe shim).
// Prose, comments and messages that mention `claude -p` are not calls; git, node and npm spawns pass.
export const AGENT_CLI_SPAWN='AGENT_CLI_SPAWN';
export const AGENT_CLIS=Object.freeze(['codex','claude','cursor-agent','devin','gemini','opencode']);
const AGENT_SPAWN_ROOTS=['scripts','engine','modules','bin'];
const AGENT_SPAWN_EXT=/\.(?:mjs|cjs|js|ts)$/;
/** The agent-CLI spawns in one source text: [{line, callee, program}]. Pure. */
export function agentCliSpawns(text,file='x.mjs'){
  return spawnCalls(text,file).calls.flatMap(call=>{
    const program=call.programs.find(p=>AGENT_CLIS.includes(p));
    return program?[{line:call.line,callee:call.callee,program}]:[];
  });
}

const COMMENT_LINE=/^\s*(?:\/\/|\/?\*|#)/;
const IMPORTS_RUNNER=/import\s*\{[^}]*\b(?:ORCA|orcaRun|orcaCall)\b[^}]*\}\s*from\s*['"][^'"]*orca\/lib\.mjs['"]/;

/** Every host-boundary violation in `root`, allow-list applied. */
export function findHostBoundaryViolations({root=skillRoot}={}){
  const verbs=orcaVerbs(root);
  const allow=readAllowList(root);
  const found=[];
  const flag=(file,lineNo,rule,detail,code=null)=>{
    const key=`${rel(root,file)}:${lineNo}`;
    if(allow.has(key))return;
    found.push({where:key,rule,...(code?{code}:{}),detail});
  };

  // (a) code: one place builds orca's argv. Who may spawn orca in runtime code is check-layers.mjs's rule (its scan
  // roots); the roots it does not scan (tests/, packages/) are read here with the same AST reading.
  const layerScan=readRules(root).rules.scan??[];
  for(const dir of CODE_ROOTS){
    for(const file of walk(path.join(root,dir),f=>f.endsWith('.mjs'))){
      const relative=rel(root,file);
      if(relative.startsWith(`${WRAPPER_DIR}/`))continue;
      const text=fs.readFileSync(file,'utf8');
      if(!layerScan.some(d=>relative.startsWith(`${d}/`)))
        for(const call of spawnCalls(text,file).calls)
          if(call.programs.includes('orca'))flag(file,call.line,'spawns-orca',`spawns orca outside ${WRAPPER_DIR}/ — call the verb's wrapper`);
      const lines=text.split(/\r?\n/);
      lines.forEach((line,i)=>{
        if(IMPORTS_RUNNER.test(line))
          flag(file,i+1,'imports-runner',`imports the Orca runner outside ${WRAPPER_DIR}/ — call the verb's wrapper`);
      });
    }
  }

  // (c) agent-launch: no runtime code creates an agent terminal - the wrappers under scripts/api/orca/ included.
  for(const dir of LAUNCH_ROOTS){
    for(const file of walk(path.join(root,dir),f=>f.endsWith('.mjs'))){
      if(rel(root,file)===ALLOW_SELF)continue;
      fs.readFileSync(file,'utf8').split(/\r?\n/).forEach((line,i)=>{
        if(COMMENT_LINE.test(line))return;
        const hit=TERMINAL_LAUNCH.find(([re])=>re.test(line));
        if(hit)flag(file,i+1,'agent-launch',`creates a terminal (${hit[1]}) — every agent launch is ${WRAPPER_DIR}/worker-start.mjs; a plain non-agent shell needs a reviewed ${ALLOW_FILE} entry`);
      });
    }
  }

  // (d) agent-cli-spawn: no runtime script runs an agent CLI as its child process.
  for(const dir of AGENT_SPAWN_ROOTS){
    for(const file of walk(path.join(root,dir),f=>AGENT_SPAWN_EXT.test(f))){
      for(const hit of agentCliSpawns(fs.readFileSync(file,'utf8'),file))
        flag(file,hit.line,'agent-cli-spawn',`${AGENT_CLI_SPAWN}: ${hit.callee}() runs the agent CLI ${hit.program} as a child process — launch it through ${WRAPPER_DIR}/worker-start.mjs (scripts/agent/lib.mjs startAgent) and supervise it with worker-show / worker-stop / worker-release`,AGENT_CLI_SPAWN);
    }
  }

  // (b) prose: no agent is told to run orca or to read the host contract.
  for(const entry of PROSE_ROOTS){
    const target=path.join(root,entry);
    if(!fs.existsSync(target))continue;
    const files=fs.statSync(target).isDirectory()
      ?walk(target,f=>PROSE_EXT.has(path.extname(f)))
      :[target];
    for(const file of files){
      const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
      lines.forEach((line,i)=>{
        const command=line.match(COMMAND_POSITION);
        if(command&&(!verbs||verbs.has(command[1])))
          flag(file,i+1,'orca-command',`tells the reader to run \`orca ${command[1]}\` — name ${WRAPPER_DIR}/<verb>.mjs instead`);
        for(const m of line.matchAll(NODE_PATH)){
          if(!/(?:^|\/)scripts\/api\/orca\/[a-z][a-z-]*\.mjs$/.test(m[1].replace(/^[^a-zA-Z]*/,'')))
            flag(file,i+1,'node-orca-path',`names \`node ${m[1]}\`, which is not a ${WRAPPER_DIR}/<verb>.mjs wrapper`);
        }
        if(LOADS_HOST.test(line))
          flag(file,i+1,'reads-host-contract','tells the reader to load modules/host/orca/ — the host contract is data for scripts/api/orca/lib.mjs, not reading for an agent');
      });
    }
  }
  return {ok:found.length===0,violations:found,allowed:[...allow].map(([where,reason])=>({where,reason}))};
}

export function hostBoundaryMain(argv=[]){
  if(argv.includes('--help')||argv.includes('-h'))return {exitCode:0,report:{schema:'starci/host-boundary-check-help@1',help:`Usage: node scripts/checks/check-host-boundary.mjs [--root <dir>]\n\nFails when a .mjs outside ${WRAPPER_DIR}/ spawns orca or imports its runner, when runtime code (${AGENT_SPAWN_ROOTS.join(', ')}) spawns an agent CLI (${AGENT_CLIS.join(', ')}) as a child process (${AGENT_CLI_SPAWN}), or when agent-facing prose (${PROSE_ROOTS.join(', ')}) tells an agent to run an orca command, to run a node path that is not a ${WRAPPER_DIR}/<verb>.mjs wrapper, or to load modules/host/orca/. ${ALLOW_FILE} lists path:line exemptions with a reason. Exit 0 is clean, 1 lists the violations.`}};
  const rootIndex=argv.indexOf('--root');
  const root=rootIndex>=0?argv[rootIndex+1]:skillRoot;
  const result=findHostBoundaryViolations({root});
  return {exitCode:result.ok?0:1,report:{schema:'starci/host-boundary-check-report@1',...result}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=hostBoundaryMain(process.argv.slice(2));
  process.stdout.write(result.report.help?`${result.report.help}\n`:`${JSON.stringify(result.report,null,2)}\n`);
  process.exitCode=result.exitCode;
}
