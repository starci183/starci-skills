import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SECRET_ENV_FILE,CREDENTIAL_FILE_MAX_BYTES,readSecretBytes,connectorSecret,credentialPresent,readDotenv,secretEnv,sopsIdentityEnv} from '../../engine/secrets.mjs';
import {connectorEnv,connectorsConfig,validateConfig} from '../../engine/config.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {isolatedSopsEnv,withGeneratedAgeIdentity,runSelectedSops} from '../../scripts/api/sops/lib.mjs';
import {runProgram} from '../../scripts/api/process/run-program.mjs';
import {resolveRealTool} from '../../scripts/api/process/resolve-real-tool.mjs';
import {decrypt} from '../../scripts/api/sops/decrypt.mjs';
import {seal} from '../../scripts/api/sops/seal.mjs';
import {execEnv} from '../../scripts/api/sops/exec-env.mjs';
import {execWithCustody} from '../../scripts/gates/custody-exec.mjs';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-shared-secrets-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
};

test('shared dotenv parsing preserves quoted values and never evaluates shell text',t=>{
  const root=fixture(t),file=path.join(root,SECRET_ENV_FILE);
  fs.writeFileSync(file,'# local values\nexport KEY="a b"\nSINGLE=\'literal\'\nRAW=$(never-run)\nEMPTY=\nnot an assignment\n');
  assert.deepEqual(readDotenv(file),{KEY:'a b',SINGLE:'literal',RAW:'$(never-run)',EMPTY:''});
});

test('credential availability rejects conventional template literals without classifying provider validity',()=>{
  for(const value of [undefined,null,42,'','  ','CHANGE_ME','replace_me','PLACEHOLDER','TODO','<token>','YOUR_TOKEN'])assert.equal(credentialPresent(value),false);
  for(const value of ['fake-test-value','a-real-looking-but-unverified-token','TODO-is-part-of-a-value'])assert.equal(credentialPresent(value),true);
});

test('actual environment wins including blank values and neither mapping is mutated',t=>{
  const root=fixture(t),env={TOKEN:'',OTHER:'actual'};
  fs.writeFileSync(path.join(root,SECRET_ENV_FILE),'TOKEN=file-value\nOTHER=file-other\nFROM_FILE=yes\n');
  const before=structuredClone(env),out=secretEnv(root,env);
  assert.deepEqual(out,{TOKEN:'',OTHER:'actual',FROM_FILE:'yes'});
  assert.deepEqual(env,before);
  assert.notEqual(out,env);
  out.OTHER='changed';
  assert.equal(env.OTHER,'actual');
});

test('missing local file leaves supplied environment usable without an implicit cwd root',t=>{
  const root=fixture(t),env={SELECTED:'present'};
  assert.deepEqual(secretEnv(root,env),env);
  for(const value of [undefined,null,'','relative'])assert.throws(()=>secretEnv(value,env),/absolute verified runtime root/);
  for(const value of [null,[],true])assert.throws(()=>secretEnv(root,value),/environment mapping/);
});

test('a directory or link cannot be used as the shared credential file or root',t=>{
  const root=fixture(t),file=path.join(root,SECRET_ENV_FILE);
  fs.mkdirSync(file);
  assert.throws(()=>secretEnv(root,{}),/regular file/);
  fs.rmdirSync(file);
  const target=path.join(root,'target');fs.mkdirSync(target);
  fs.symlinkSync(target,file,'junction');
  assert.throws(()=>secretEnv(root,{}),/regular file/);
  const linkedRoot=path.join(root,'linked-root');fs.symlinkSync(target,linkedRoot,'junction');
  assert.throws(()=>secretEnv(linkedRoot,{}),/regular directory/);
});

test('explicit direct blanks suppress supported custody pointer fallback',t=>{
  const root=fixture(t),pointer=path.join(root,'token');fs.writeFileSync(pointer,'pointer-value\n');
  assert.equal(connectorSecret('TOKEN',{TOKEN_FILE:pointer}),'pointer-value');
  assert.equal(connectorSecret('TOKEN',{TOKEN:'direct-value',TOKEN_FILE:pointer}),'direct-value');
  for(const value of ['', '   ',undefined,null])assert.equal(connectorSecret('TOKEN',{TOKEN:value,TOKEN_FILE:pointer}),null);
  assert.equal(connectorSecret('TOKEN',{TOKEN_FILE:path.join(root,'missing')}),null);
  assert.equal(connectorSecret('token',{token:'not a configured uppercase name'}),null);
});

test('connector adapter reads only the explicit shared root and normalization never reloads a file',t=>{
  const root=fixture(t);
  fs.writeFileSync(path.join(root,SECRET_ENV_FILE),'TELEGRAM_BOT_TOKEN=local-value\n');
  const config=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8'));
  config.connectors.telegram={...config.connectors.telegram,enabled:true,chatId:123};
  assert.equal(connectorsConfig(config,{},root).telegram.botTokenPresent,false);
  const env=connectorEnv(config,{},root);
  assert.equal(connectorsConfig(config,env,root).telegram.botTokenPresent,true);
  assert.equal(connectorsConfig(config,connectorEnv(config,{TELEGRAM_BOT_TOKEN:''},root),root).telegram.botTokenPresent,false);
  assert.throws(()=>connectorEnv(config,{}),/absolute verified runtime root/);
  assert.throws(()=>validateConfig({...config,connectors:{...config.connectors,secretsFile:'another.env'}}),/unknown key secretsFile/);
});

test('oversized credential files and nonregular custody pointers refuse before returning a value',t=>{
  const root=fixture(t),file=path.join(root,SECRET_ENV_FILE);
  const fd=fs.openSync(file,'w');fs.ftruncateSync(fd,CREDENTIAL_FILE_MAX_BYTES+1);fs.closeSync(fd);
  assert.throws(()=>secretEnv(root,{}),/byte budget/);
  assert.equal(connectorSecret('TOKEN',{TOKEN_FILE:file}),null);
  assert.equal(connectorSecret('TOKEN',{TOKEN_FILE:root}),null);
});

test('age selection uses explicit original FILE, preserves input, and infers no home identity',t=>{
  const root=fixture(t),file=path.join(root,'original.identity');fs.writeFileSync(file,'FAKE-ORIGINAL-IDENTITY');
  const env={SOPS_AGE_KEY_FILE:file,FIXTURE_CANARY:'canonical'},snapshot=structuredClone(env);
  const selected=sopsIdentityEnv(env,{required:true});
  assert.equal(selected.mode,'file');assert.equal(selected.error,null);
  assert.deepEqual(selected.env,env);assert.notEqual(selected.env,env);assert.deepEqual(env,snapshot);
  assert.equal(sopsIdentityEnv({}, {identity:file,required:true}).env.SOPS_AGE_KEY_FILE,file);
  assert.equal(sopsIdentityEnv({}, {required:true}).error.identityRefusal,'identity-not-supplied');
  assert.equal(sopsIdentityEnv({}).mode,'public-recipient','public-recipient encryption requires no new private identity');
  assert.equal(sopsIdentityEnv({SOPS_AGE_KEY_FILE:'relative.identity'},{required:true}).error.identityRefusal,'identity-file-location-unqualified');
  assert.equal(sopsIdentityEnv({SOPS_AGE_KEY_FILE:path.join(root,'missing')},{required:true}).error.identityRefusal,'identity-file-unavailable');
  assert.equal(sopsIdentityEnv({SOPS_AGE_KEY_FILE:root},{required:true}).error.identityRefusal,'identity-file-unavailable');
  const other=path.join(root,'other.identity');fs.writeFileSync(other,'FAKE-OTHER-IDENTITY');
  assert.equal(sopsIdentityEnv(env,{identity:other}).error.identityRefusal,'conflicting-files');
  assert.equal(fs.readFileSync(file,'utf8'),'FAKE-ORIGINAL-IDENTITY');
});

test('canonical inline is recognized but held, and explicit blank cannot resurrect a FILE selection',t=>{
  const root=fixture(t),file=path.join(root,'original.identity');fs.writeFileSync(file,'FAKE-ORIGINAL-IDENTITY');
  fs.writeFileSync(path.join(root,SECRET_ENV_FILE),'SOPS_AGE_KEY=AGE-SECRET-KEY-FAKE-CANONICAL\nOTHER=unrelated-fixture\n');
  const actual={SOPS_AGE_KEY_FILE:file},snapshot=structuredClone(actual);
  const env=secretEnv(root,actual),selected=sopsIdentityEnv(env,{identity:path.join(root,'obsolete-missing')});
  assert.equal(selected.error.name,'SopsIdentityRefusal');
  assert.equal(selected.error.identityRefusal,'inline-context-unqualified');assert.equal(selected.env,null);
  assert.ok(!selected.error.message.includes(env.SOPS_AGE_KEY));assert.deepEqual(actual,snapshot);
  for(const value of ['', '   ',undefined,null,42,'CHANGE_ME']){
    const supplied={...actual,SOPS_AGE_KEY:value},before=structuredClone(supplied);
    const result=sopsIdentityEnv(secretEnv(root,supplied),{identity:file,required:true});
    assert.equal(result.error.identityRefusal,'disabled-inline');assert.equal(result.env,null);assert.deepEqual(supplied,before);
  }
  for(const value of ['', '   ',undefined,null,42])assert.equal(sopsIdentityEnv({SOPS_AGE_KEY_FILE:value},{identity:file}).error.identityRefusal,'disabled-file');
  for(const env of [null,[],true])assert.equal(sopsIdentityEnv(env).error.identityRefusal,'invalid-environment');
});

test('SOPS adapters preserve typed inline and blank refusal before launching a fake child',t=>{
  const root=fixture(t),marker=path.join(root,'child-called'),probe=path.join(root,'probe.mjs');
  fs.writeFileSync(probe,"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(marker)+",'called');");
  const file=path.join(root,'original.identity');fs.writeFileSync(file,'FAKE-ORIGINAL-IDENTITY');
  for(const [value,reason] of [['AGE-SECRET-KEY-FAKE','inline-context-unqualified'],['','disabled-inline'],[undefined,'disabled-inline']]){
    const env={SOPS_AGE_KEY:value,SOPS_AGE_KEY_FILE:file},snapshot=structuredClone(env);
    const results=[decrypt(process.execPath,[probe],{env}),seal(process.execPath,{inputType:'json',plaintext:'{}',recipients:['age1fake'],filenameOverride:'fixture.json'},{env})];
    for(const result of results){assert.equal(result.status,null);assert.equal(result.error.identityRefusal,reason);assert.equal(result.stdout,'');assert.equal(result.stderr,'');}
    assert.throws(()=>execEnv(path.join(root,'fixture.json.enc'),{env,sops:process.execPath}),error=>error.identityRefusal===reason);
    assert.ok(!fs.existsSync(marker));assert.deepEqual(env,snapshot);
  }
});

test('selected SOPS child context removes every source alias while preserving parent and unrelated transport values',()=>{
  const env={SOPS_AGE_KEY:'fixture-selected',sops_age_key:'ambient-alias',SOPS_AGE_KEY_FILE:'ambient-file',sops_age_key_cmd:'never-run',SOPS_AGE_SSH_PRIVATE_KEY_FILE:'ambient-ssh',SOPS_AGE_SSH_PRIVATE_KEY_CMD:'never-run-ssh',SOPS_KEYSERVICE:'tcp://never-run',SOPS_ENABLE_LOCAL_KEYSERVICE:'false',SOPS_KMS_ARN:'never-contact',SOPS_AGE_RECIPIENTS:'wrong',SOPS_CONFIG:'fixture-existing-config',HOME:'ambient-home',Home:'alias-home',USERPROFILE:'ambient-profile',AppData:'ambient-roaming',APPDATA:'alias-roaming',XDG_CONFIG_HOME:'ambient-config',PATH:'fixture-path',LOCALAPPDATA:'fixture-local',FIXTURE_CANARY:'preserved'};
  const before=structuredClone(env),child=isolatedSopsEnv(env);
  assert.deepEqual(env,before);assert.notEqual(child,env);
  assert.deepEqual(child,{HOME:'',USERPROFILE:'',APPDATA:'',XDG_CONFIG_HOME:'',SOPS_AGE_KEY:'fixture-selected',SOPS_CONFIG:'fixture-existing-config',PATH:'fixture-path',LOCALAPPDATA:'fixture-local',FIXTURE_CANARY:'preserved'});
  assert.ok(!Object.hasOwn(isolatedSopsEnv(env,null),'SOPS_AGE_KEY'),'derivation receives private stdin, not an extra env identity');
  for(const value of ['',null,undefined])assert.equal(sopsIdentityEnv({sops_age_key:value,SOPS_AGE_KEY_FILE:'unavailable'},{platform:'win32'}).error.identityRefusal,'disabled-inline');
  assert.equal(sopsIdentityEnv({SOPS_AGE_KEY:'one',sops_age_key:'two'},{platform:'win32'}).error.identityRefusal,'ambiguous-environment');
});

test('the existing bounded secret reader preserves raw bytes for the native stdin owner',t=>{
  const root=fixture(t),file=path.join(root,'owned-input'),original=Buffer.from([0,255,195,40,13,10]);
  fs.writeFileSync(file,original);
  const bytes=readSecretBytes(file);assert.deepEqual(bytes,original);bytes.fill(0);
  assert.deepEqual(fs.readFileSync(file),original,'caller buffer cleanup does not change the input');
});

test('selected native admission refuses extensionless scripts before any fake child can run',t=>{
  const root=fixture(t),input=path.join(root,'fixture.json.enc'),tool=path.join(root,process.platform==='win32'?'sops.exe':'sops'),marker=path.join(root,'child-called');
  fs.writeFileSync(input,'{}');
  fs.writeFileSync(tool,`#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)},'called');\n`,{mode:0o700});
  const synthetic=['AGE','SECRET','KEY','1'].join('-')+'A'.repeat(58);
  const env={SOPS_AGE_KEY:synthetic,PATH:root},snapshot=structuredClone(env);
  const result=decrypt(tool,['decrypt','--input-type','json','--output-type','json',input],{env,invocation:{runProgram,resolveRealTool}});
  assert.equal(result.error.identityRefusal,'native-tool-unavailable');assert.equal(result.status,null);
  assert.equal(result.stdout,'');assert.equal(result.stderr,'');assert.ok(!fs.existsSync(marker));assert.deepEqual(env,snapshot);
  assert.throws(()=>execEnv(input,{env,sops:tool}),error=>error.identityRefusal==='inline-context-unqualified');
  assert.throws(()=>execEnv(input,{env,sops:tool,invocation:{runProgram,resolveRealTool}}),error=>error.identityRefusal==='native-tool-unavailable');
  let substituted=0;
  const invocation={runProgram:()=>{substituted++;throw new Error('not the owned process port');},resolveRealTool:()=>{substituted++;return tool;}};
  assert.throws(()=>execWithCustody(input,'never-run',{env,sops:tool,invocation}),error=>error.identityRefusal==='native-tool-unavailable');
  assert.equal(substituted,0);assert.ok(!fs.existsSync(marker));assert.deepEqual(env,snapshot);
});

test('custody command never starts its child when inline selection is disabled or invalid',t=>{
  const root=fixture(t),marker=path.join(root,'protected-child-called'),probe=path.join(root,'protected-child.mjs');
  fs.writeFileSync(probe,"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(marker)+",'called');");
  const original=path.join(root,'original.identity');fs.writeFileSync(original,'FAKE-ORIGINAL-IDENTITY');
  const command=`"${process.execPath}" "${probe}"`,input=path.join(root,'fixture.json.enc');
  for(const value of ['', '   ',undefined,null,42,'CHANGE_ME']){
    const env={SOPS_AGE_KEY:value,SOPS_AGE_KEY_FILE:original},snapshot=structuredClone(env);
    assert.throws(()=>execWithCustody(input,command,{env,sops:process.execPath}),error=>error.identityRefusal==='disabled-inline');
    assert.ok(!fs.existsSync(marker));assert.deepEqual(env,snapshot);
  }
  for(const env of [null,[],true])assert.throws(()=>execWithCustody(input,command,{env,sops:process.execPath}),error=>error.identityRefusal==='invalid-environment');
  assert.ok(!fs.existsSync(marker));assert.equal(fs.readFileSync(original,'utf8'),'FAKE-ORIGINAL-IDENTITY');
});

// Profile fixtures admit the running Node image as native bytes but never launch AGE or SOPS.
const ageProfileFixture=(t,selected=false)=>{
  const root=fixture(t),identity=['AGE','SECRET','KEY','1'].join('-')+'A'.repeat(58),recipient='age1'+'q'.repeat(58);
  const env={SOPS_AGE_KEY_FILE:'fixture-unused-file',SOPS_AGE_KEY_CMD:'fixture-unused-command',SOPS_KEYSERVICE:'fixture-unused-service',
    HOME:'fixture-home',USERPROFILE:'fixture-profile',APPDATA:'fixture-roaming',XDG_CONFIG_HOME:'fixture-config',FIXTURE_CANARY:'preserved',
    ...(selected?{SOPS_AGE_KEY:identity}:{})};
  const before=structuredClone(env),calls=[],buffers=[];
  const record=(file,args,options)=>{
    assert.equal(file,process.execPath);
    assert.ok(args.every(arg=>typeof arg==='string'&&!arg.includes('AGE-SECRET-KEY-')),'identity never enters argv');
    assert.equal(options.shell,false);assert.equal(options.encoding,'buffer');assert.equal(options.windowsHide,true);
    assert.deepEqual(options.stdio,['pipe','pipe','pipe']);assert.equal(options.timeout,20000);assert.equal(options.maxBuffer,CREDENTIAL_FILE_MAX_BYTES);
    assert.equal(options.cwd,root);assert.equal(options.env.FIXTURE_CANARY,'preserved');
    for(const name of ['HOME','USERPROFILE','APPDATA','XDG_CONFIG_HOME'])assert.equal(options.env[name],'');
    for(const name of ['SOPS_AGE_KEY_FILE','SOPS_AGE_KEY_CMD','SOPS_KEYSERVICE'])assert.ok(!Object.hasOwn(options.env,name));
    calls.push({args:[...args],input:options.input,env:options.env});
    if(Buffer.isBuffer(options.input))buffers.push(options.input);
  };
  const capture=stdout=>{
    const result={status:0,signal:null,error:null,stdout:Buffer.from(stdout),stderr:Buffer.from('fixture-only diagnostic\n')};
    buffers.push(result.stdout,result.stderr);return result;
  };
  const check=()=>{
    assert.deepEqual(env,before);
    assert.ok(buffers.length>0&&buffers.every(buffer=>buffer.every(value=>value===0)),'owned capture/input buffers are cleared');
    assert.ok(calls.every(call=>!Object.hasOwn(call.env,'SOPS_AGE_KEY')),'selected child identity is removed after use');
  };
  const auditAbsent=()=>{
    try{fs.lstatSync(path.resolve(root,'/etc/sops/audit.yaml'));}
    catch(error){if(error.code==='ENOENT')return true;}
    t.skip('fixed audit context is not observed absent; fixture reads no body and performs no repair');return false;
  };
  return {root,identity,recipient,env,calls,buffers,record,capture,check,auditAbsent};
};

for(const version of ['1.2.1','1.3.1'])test('initial standard AGE profile '+version+' generates once with default argv and clears owned buffers',t=>{
  const f=ageProfileFixture(t);let consumed=0,leaseChecks=0;
  const result=withGeneratedAgeIdentity({env:f.env,cwd:f.root,assertLease:()=>{leaseChecks++;return true;},
    invocation:{resolveRealTool:(program,{env})=>{assert.equal(program,'age-keygen');assert.equal(env,f.env);return process.execPath;},
      runProgram:(file,args,options)=>{
        f.record(file,args,options);assert.ok(!Object.hasOwn(options.env,'SOPS_AGE_KEY'));
        if(args.length===1&&args[0]==='--version')return f.capture('v'+version+'\n');
        if(args.length===0)return f.capture('# created: 2026-10-06T00:00:00Z\n# public key: '+f.recipient+'\n'+f.identity+'\n');
        assert.deepEqual(args,['-y']);assert.equal(options.input.toString('utf8'),f.identity);return f.capture(f.recipient+'\n');
      }},
    consume:(identity,recipient)=>{consumed++;assert.equal(identity.toString('utf8'),f.identity);assert.equal(recipient,f.recipient);
      f.buffers.push(identity);return {ok:true,effectState:'complete',created:true,durability:'file-fsync-namespace-unqualified'};}});
  assert.equal(result.ok,true);assert.equal(result.captureState,'generated');assert.equal(result.effectState,'complete');assert.equal(result.publicRecipient,f.recipient);
  assert.equal(consumed,1);assert.ok(leaseChecks>=3);assert.deepEqual(f.calls.map(call=>call.args),[['--version'],[],['-y']]);f.check();
});

test('initial unsupported AGE version refuses before generation or publication',t=>{
  const f=ageProfileFixture(t);let consumed=0;
  const result=withGeneratedAgeIdentity({env:f.env,cwd:f.root,assertLease:()=>true,
    invocation:{resolveRealTool:()=>process.execPath,runProgram:(file,args,options)=>{f.record(file,args,options);assert.deepEqual(args,['--version']);return f.capture('v1.4.0\n');}},
    consume:()=>{consumed++;return {ok:true,effectState:'complete',created:true,durability:'file-fsync-namespace-unqualified'};}});
  assert.equal(result.ok,false);assert.equal(result.reason,'unsupported-tool-profile');assert.equal(result.captureState,'none');assert.equal(result.effectState,'none');
  assert.equal(consumed,0);assert.deepEqual(f.calls.map(call=>call.args),[['--version']]);f.check();
});

test('initial admitted version holds generated PQ-shaped identity without adding PQ argv or publishing',t=>{
  const f=ageProfileFixture(t);let consumed=0;
  const result=withGeneratedAgeIdentity({env:f.env,cwd:f.root,assertLease:()=>true,
    invocation:{resolveRealTool:()=>process.execPath,runProgram:(file,args,options)=>{
      f.record(file,args,options);
      if(args.length===1&&args[0]==='--version')return f.capture('v1.3.1\n');
      assert.deepEqual(args,[]);return f.capture('# created: 2026-10-06T00:00:00Z\n# public key: age1pq1'+'q'.repeat(58)+'\nAGE-SECRET-KEY-PQ-1'+'A'.repeat(58)+'\n');
    }},
    consume:()=>{consumed++;return {ok:true,effectState:'complete',created:true,durability:'file-fsync-namespace-unqualified'};}});
  assert.equal(result.ok,false);assert.equal(result.reason,'capture-incomplete');assert.equal(result.captureState,'unknown');assert.equal(result.effectState,'unknown');
  assert.equal(consumed,0);assert.deepEqual(f.calls.map(call=>call.args),[['--version'],[]]);f.check();
});

for(const [version,accepted] of [['1.3.1',true],['1.4.0',false]])test('selected AGE profile '+version+' '+(accepted?'reaches derivation then holds invalid recipient shape before action':'refuses before derivation and action'),t=>{
  const f=ageProfileFixture(t,true);if(!f.auditAbsent())return;
  const input=path.join(f.root,'profile-fixture.json.enc');fs.writeFileSync(input,'{}');let protectedActions=0;
  const result=runSelectedSops(process.execPath,{operation:'decrypt',args:['decrypt','--input-type','json','--output-type','json',input]},
    {selection:sopsIdentityEnv(f.env),env:f.env,cwd:f.root,maxBuffer:CREDENTIAL_FILE_MAX_BYTES,
      invocation:{resolveRealTool:program=>{assert.equal(program,'age-keygen');return process.execPath;},
        runProgram:(file,args,options)=>{
          f.record(file,args,options);
          if(args[0]==='--disable-version-check')return f.capture('sops 3.13.3\n');
          if(args[0]==='--version')return f.capture('v'+version+'\n');
          if(args[0]==='-y'){assert.equal(options.input.toString('utf8'),f.identity);assert.ok(!Object.hasOwn(options.env,'SOPS_AGE_KEY'));return f.capture('fixture-invalid-recipient\n');}
          protectedActions++;assert.fail('profile fixture must not reach a protected crypto action');
        }}});
  assert.equal(result.status,null);assert.equal(result.stdout,'');assert.equal(protectedActions,0);
  if(accepted){
    assert.equal(result.error.identityRefusal,'recipient-unproven');
    assert.deepEqual(f.calls.map(call=>call.args),[['--disable-version-check','--version'],['--version'],['-y']]);
  }else{
    assert.equal(result.error.identityRefusal,'unsupported-tool-profile');
    assert.deepEqual(f.calls.map(call=>call.args),[['--disable-version-check','--version'],['--version']]);
  }
  f.check();
});
