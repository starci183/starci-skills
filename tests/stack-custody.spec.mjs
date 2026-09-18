import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const source=new URL('../examples/todo-app-backend/scripts/',import.meta.url);
const pwshProbe=spawnSync('pwsh',['-NoProfile','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8'});
const hasPowerShell7=pwshProbe.status===0&&Number(String(pwshProbe.stdout??'').trim())>=7;
const needsPowerShell7=hasPowerShell7?false:'PowerShell 7 (pwsh) is unavailable; static script contract tests still run';
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-custody-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.mkdirSync(path.join(root,'.stacks','dev'),{recursive:true});fs.mkdirSync(path.join(root,'.stacks','vps'),{recursive:true});
  for(const name of ['prepare.ps1','cleanup-runtime.ps1'])fs.copyFileSync(new URL(name,source),path.join(root,'scripts',name));
  for(const env of ['dev','vps'])fs.writeFileSync(path.join(root,'.stacks',env,'compose.yaml'),'services: {}\n');
  const tools=path.join(root,'tools');fs.mkdirSync(tools);fs.writeFileSync(path.join(tools,'docker.cmd'),'@echo off\r\nif "%MOCK_RUNNING%"=="1" echo container-id\r\nexit /b 0\r\n');
  const env={...process.env,PATH:`${tools};${process.env.PATH}`};return {root,env,key:path.join(root,'..',`${path.basename(root)}.agekey`)};
}
const run=(script,args,options)=>spawnSync('pwsh',['-NoProfile','-File',script,...args],{encoding:'utf8',...options});

test('custody scripts declare private staging, ancestor checks, and dev-only materialization',()=>{
  const sh=fs.readFileSync(new URL('prepare.sh',source),'utf8'),ps=fs.readFileSync(new URL('prepare.ps1',source),'utf8');
  assert.match(sh,/umask 077/);assert.match(sh,/check_path/);assert.match(sh,/\.tiny-stateful-custody/);assert.match(sh,/vps preparation requires --cipher-only/);assert.match(sh,/pass --initialize only for a confirmed fresh environment/);
  assert.match(ps,/#requires -Version 7\.0/);assert.match(ps,/Assert-NoReparseAncestor/);assert.match(ps,/\.tiny-stateful-custody/);assert.match(ps,/vps requires -CipherOnly/);assert.doesNotMatch(ps,/icacls \$KeyDir/);
});

test('prepare refuses implicit initialization and initialized ciphertext loss before Docker',{skip:needsPowerShell7},t=>{
  const f=fixture(t),script=path.join(f.root,'scripts','prepare.ps1');let result=run(script,['dev','-KeyFile',f.key],{env:f.env});assert.notEqual(result.status,0);assert.match(result.stderr,/pass -Initialize/);
  fs.writeFileSync(path.join(f.root,'.stacks','dev','.initialized'),'');result=run(script,['dev','-KeyFile',f.key,'-Initialize'],{env:f.env});assert.notEqual(result.status,0);assert.match(result.stderr,/missing ciphertext/);
  result=run(script,['vps','-KeyFile',f.key],{env:f.env});assert.notEqual(result.status,0);assert.match(result.stderr,/requires -CipherOnly/);
});

test('cleanup refuses a running selected project and removes only owned dev plaintext after stop',{skip:needsPowerShell7},t=>{
  const f=fixture(t),script=path.join(f.root,'scripts','cleanup-runtime.ps1'),dir=path.join(f.root,'.stacks','dev'),plain=path.join(dir,'secrets.yaml'),cipher=path.join(dir,'secrets.yaml.enc'),marker=path.join(dir,'.initialized');
  fs.writeFileSync(plain,'synthetic');fs.writeFileSync(cipher,'cipher');fs.writeFileSync(marker,'');let result=run(script,['dev'],{env:{...f.env,MOCK_RUNNING:'1'}});assert.notEqual(result.status,0);assert.equal(fs.existsSync(plain),true);
  result=run(script,['dev'],{env:{...f.env,MOCK_RUNNING:'0'}});assert.equal(result.status,0,result.stderr);assert.equal(fs.existsSync(plain),false);assert.equal(fs.existsSync(cipher),true);assert.equal(fs.existsSync(marker),true);
});

test('cleanup scripts are scoped to the selected dev secret and require stopped-project proof',()=>{
  const sh=fs.readFileSync(new URL('cleanup-runtime.sh',source),'utf8'),ps=fs.readFileSync(new URL('cleanup-runtime.ps1',source),'utf8');
  for(const text of [sh,ps]){assert.match(text,/tiny-stateful-dev/);assert.match(text,/ps -q/);assert.doesNotMatch(text,/prune|--volumes|Recurse/);}
});
