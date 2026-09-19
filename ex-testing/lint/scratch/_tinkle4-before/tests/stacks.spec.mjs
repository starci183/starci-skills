import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {checkApplicationStacks} from '../checks/stacks.mjs';

const RUNBOOK=(extra=[])=>[
  '# runbook','','| command | what it does |','|---|---|',
  '| prepare | decrypt secrets |','| doctor | validate config |','| up | start the stack |',
  '| status | show status |','| logs | tail logs |','| down | stop the stack |',
  '| verification | curl health |',...extra,''
].join('\n');

const manifestFor=()=>({schema:'starci/application-stacks',
  components:{api:{role:'service',image:'example/api',compose:'infra/compose/api.yaml'},
    db:{role:'stateful',image:'postgres:16',compose:'infra/compose/db.yaml'},
    mail:{role:'gateway',required:false}},
  environments:{dev:{status:'supported',runtime:'docker-compose',composeFiles:['infra/compose/compose.yaml'],
    components:{api:{port:3001},db:{port:5432}},runbook:'README.md',
    secrets:[{name:'db-password',where:'secrets/db-password',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}]},
  vps:{status:'supported',runtime:'docker-swarm',composeFiles:['infra/stack.yaml'],
    components:{api:{replicas:2},db:{}},runbook:'README.md',
    secrets:[{name:'app-token',where:'secrets/app-token',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}]}},
  k8s:{status:'deferred',reason:'not in the current delivery target'}});

function fixture(t,environment='dev'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const env of ['dev','vps']){
    fs.mkdirSync(path.join(root,'.starcistacks',env,'infra','compose'),{recursive:true});
    fs.mkdirSync(path.join(root,'.starcistacks',env,'secrets'),{recursive:true});
    fs.writeFileSync(path.join(root,'.starcistacks',env,'README.md'),RUNBOOK());
  }
  fs.writeFileSync(path.join(root,'.starcistacks','dev','infra','compose','compose.yaml'),'services: {}\n');
  fs.writeFileSync(path.join(root,'.starcistacks','vps','infra','stack.yaml'),'services: {}\n');
  fs.writeFileSync(path.join(root,'.starcistacks','dev','secrets','db-password.enc'),'data: ENC[AES256_GCM,data:cipher,iv:a,tag:b,type:str]\nsops:\n  age: []\n');
  fs.writeFileSync(path.join(root,'.starcistacks','vps','secrets','app-token.enc'),'data: ENC[AES256_GCM,data:cipher,iv:a,tag:b,type:str]\nsops:\n  age: []\n');
  const manifest=manifestFor(),modelFile=path.join(root,'rendered.json');
  const model=environment==='dev'?{services:{api:{},db:{}}}:{services:{api:{image:'example/api@sha256:fixture',deploy:{replicas:2}},db:{image:'postgres:16'}}};
  const write=()=>{fs.writeFileSync(path.join(root,'.starcistacks','application-stacks.yaml'),stringifyYaml(manifest));fs.writeFileSync(modelFile,JSON.stringify(model));};write();
  return {root,manifest,model,modelFile,write,check:()=>checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile})};
}

test('accepts an exact static dev inventory and states its non-live limits',t=>{
  const f=fixture(t),result=f.check();assert.equal(result.ok,true,result.errors.map(x=>`${x.code}:${x.path}`).join(','));assert.match(result.limitations.join(' '),/Docker was not invoked/);
});

test('accepts a static vps inventory using the swarm runtime',t=>{
  const f=fixture(t,'vps'),result=f.check();assert.equal(result.ok,true,result.errors.map(x=>`${x.code}:${x.path}`).join(','));
});

test('rejects a legacy @1 schema id with a named finding instead of a bare mismatch',t=>{
  const f=fixture(t);f.manifest.schema='starci/application-stacks@1';f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('STACKS_SCHEMA_LEGACY_ID'),codes.join(','));assert.equal(codes.includes('schema-invalid'),false);
});

test('rejects an unrecognized schema id',t=>{
  const f=fixture(t);f.manifest.schema='starci/other';f.write();assert.ok(f.check().errors.some(x=>x.code==='schema-invalid'));
});

test('rejects unsafe or symlinked compose paths and undeclared compose files',t=>{
  const f=fixture(t),outside=path.join(path.dirname(f.root),'outside-compose.yaml');fs.writeFileSync(outside,'services: {}\n');
  f.manifest.environments.dev.composeFiles=['../outside-compose.yaml'];f.write();assert.ok(f.check().errors.some(x=>x.code==='compose-path-unsafe'));
  f.manifest.environments.dev.composeFiles=['infra/compose/link.yaml'];
  try{fs.symlinkSync(outside,path.join(f.root,'.starcistacks','dev','infra','compose','link.yaml'));}catch{return;}f.write();
  assert.ok(f.check().errors.some(x=>x.code==='compose-path-unsafe'));
});

test('reports a compose-shaped file under infra that composeFiles never declares or includes',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','infra','compose','extra.yaml'),'services: {orphan: {}}\n');f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('STACKS_UNDECLARED_COMPOSE'),codes.join(','));
});

test('does not flag a non-compose YAML file such as a Prometheus scrape config',t=>{
  const f=fixture(t);
  fs.mkdirSync(path.join(f.root,'.starcistacks','dev','infra','compose','prometheus'),{recursive:true});
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','infra','compose','prometheus','prometheus.yml'),'global:\n  scrape_interval: 15s\n');f.write();
  assert.equal(f.check().errors.some(x=>x.code==='STACKS_UNDECLARED_COMPOSE'),false);
});

test('follows an include chain so every included fragment counts as declared',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','infra','compose','compose.yaml'),'include:\n  - db.yaml\n');
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','infra','compose','db.yaml'),'services:\n  db: {}\n');f.write();
  assert.equal(f.check().errors.some(x=>x.code==='STACKS_UNDECLARED_COMPOSE'),false);
});

test('reports plaintext sensitive environment keys without returning their values',t=>{
  const f=fixture(t),secretValue='must-never-appear';f.model.services.api.environment={API_TOKEN:secretValue};f.write();const result=f.check();
  assert.ok(result.errors.some(x=>x.code==='plaintext-sensitive-environment'));assert.equal(JSON.stringify(result).includes(secretValue),false);
});

test('allows a _FILE pointer for a sensitive key and rejects unresolved Compose placeholders',t=>{
  const f=fixture(t);f.model.services.api.environment={DB_PASSWORD_FILE:'/run/secrets/db-password'};f.model.services.api.image='app:${TAG}';f.write();
  const codes=f.check().errors.map(x=>x.code);assert.equal(codes.includes('plaintext-sensitive-environment'),false);assert.ok(codes.includes('compose-placeholder-unresolved'));
});

test('does not let Kubernetes become an implicit supported environment without a k8s directory',t=>{
  const f=fixture(t);f.manifest.k8s={status:'supported',reason:'later'};f.write();
  assert.ok(f.check().errors.some(x=>x.code==='k8s-directory-missing'));
});

test('rejects a tracked k8s directory while status stays deferred',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.root,'.starcistacks','k8s'),{recursive:true});f.write();
  assert.ok(f.check().errors.some(x=>x.code==='k8s-directory-unexpected'));
});

test('flags a directory under .starcistacks that no environment admits and scratch left in the canonical tree',t=>{
  const f=fixture(t);
  fs.mkdirSync(path.join(f.root,'.starcistacks','staging'),{recursive:true});
  fs.mkdirSync(path.join(f.root,'.starcistacks','tmp'),{recursive:true});f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('STACKS_UNDECLARED_ENVIRONMENT'),codes.join(','));assert.ok(codes.includes('STACKS_SCRATCH_IN_CANONICAL'),codes.join(','));
});

test('requires a directory for every declared environment',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.root,'.starcistacks','vps'),{recursive:true,force:true});f.write();
  assert.ok(f.check().errors.some(x=>x.code==='environment-directory-missing'));
});

test('rejects an unknown component id bound inside an environment',t=>{
  const f=fixture(t);f.manifest.environments.dev.components.ghost={};f.write();
  assert.ok(f.check().errors.some(x=>x.code==='binding-component-unknown'));
});

test('does not require every catalog component to be bound in every environment',t=>{
  const f=fixture(t,'vps');delete f.manifest.environments.vps.components.db;
  f.model.services={api:{image:'example/api@sha256:fixture',deploy:{replicas:2}}};f.write();
  assert.equal(f.check().ok,true,f.check().errors.map(x=>x.code).join(','));
});

test('requires the runbook file to exist and document every one of the seven commands',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.root,'.starcistacks','dev','README.md'));f.write();
  assert.ok(f.check().errors.some(x=>x.code==='runbook-path-invalid'));
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','README.md'),'# runbook\nno table here\n');f.write();
  const codes=f.check().errors.map(x=>x.code);for(const command of ['prepare','doctor','up','status','logs','down','verification'])
    assert.ok(codes.includes('runbook-command-missing'),`${command}: ${codes.join(',')}`);
});

test('requires exact secret custody: a recognizable SOPS envelope and unique names',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.root,'.starcistacks','dev','secrets','db-password.enc'));f.write();
  assert.ok(f.check().errors.some(x=>x.code==='encrypted-ref-invalid'));
  fs.writeFileSync(path.join(f.root,'.starcistacks','dev','secrets','db-password.enc'),'plaintext renamed as encrypted');
  f.manifest.environments.dev.secrets.push({...f.manifest.environments.dev.secrets[0]});f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('secret-duplicate'));assert.ok(codes.includes('encrypted-ref-invalid'));
});

test('requires secret recipient and key custody policy text',t=>{
  const f=fixture(t);delete f.manifest.environments.dev.secrets[0].recipientPolicy;f.write();
  assert.ok(f.check().errors.some(x=>x.code==='secret-policy-missing'));
});

test('rejects a secret plaintext path through a symlink ancestor without reading plaintext',t=>{
  const f=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-secret-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const link=path.join(f.root,'.starcistacks','dev','linked');try{fs.symlinkSync(outside,link,'junction');}catch{return;}
  f.manifest.environments.dev.secrets[0].where='linked/secret';f.write();
  assert.ok(f.check().errors.some(x=>x.code==='materialized-path-invalid'));
});

test('flags a tracked decrypted secret member as a leak using git ls-files, and stays silent when git cannot be asked',t=>{
  const f=fixture(t);
  const plain=path.join(f.root,'.starcistacks','dev','secrets','db-password');fs.writeFileSync(plain,'placeholder');f.write();
  const init=spawnSync('git',['init','-q'],{cwd:f.root});
  if(init.status!==0)return; // git unavailable in this environment; the checker must not crash or assume tracked.
  spawnSync('git',['add','.starcistacks'],{cwd:f.root});
  spawnSync('git',['-c','user.email=t@example.com','-c','user.name=t','commit','-q','-m','fixture'],{cwd:f.root});
  assert.ok(f.check().errors.some(x=>x.code==='STACKS_PLAINTEXT_SECRET'),f.check().errors.map(x=>x.code).join(','));
});

test('rejects a rendered service name that no component declares',t=>{
  const f=fixture(t);f.model.services.ghost={};f.write();
  assert.ok(f.check().errors.some(x=>x.code==='compose-service-unclassified'));
});

test('requires a nonempty image and no build section for a managed Swarm service',t=>{
  const f=fixture(t,'vps');f.model.services.api.image='';f.model.services.api.build={context:'.'};f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('swarm-image-missing'));assert.ok(codes.includes('swarm-build-unrendered'));
});

test('malformed null component catalog fails checking without crashing',t=>{
  const f=fixture(t);f.manifest.components=null;f.write();assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
});

test('rejects primitive, oversized, and unknown manifest shapes without throwing',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'.starcistacks','application-stacks.yaml'),'null\n');assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
  fs.writeFileSync(path.join(f.root,'.starcistacks','application-stacks.yaml'),'x'.repeat(4*1024*1024+1));assert.ok(f.check().errors.some(x=>x.code==='input-too-large'));
  f.write();f.manifest.unrecognized=true;f.write();assert.ok(f.check().errors.some(x=>x.code==='schema-shape-invalid'&&x.message==='unknown field'));
});

test('executes from a relocated installed payload using only its compiled schema JSON',async t=>{
  const f=fixture(t),payload=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stack-runtime-'));t.after(()=>fs.rmSync(payload,{recursive:true,force:true}));
  const dist=path.join(payload,'.dist');fs.mkdirSync(path.join(dist,'checks'),{recursive:true});fs.mkdirSync(path.join(dist,'core'),{recursive:true});fs.mkdirSync(path.join(dist,'schemas'),{recursive:true});
  fs.copyFileSync(new URL('../checks/stacks.mjs',import.meta.url),path.join(dist,'checks','stacks.mjs'));fs.copyFileSync(new URL('../core/yaml.mjs',import.meta.url),path.join(dist,'core','yaml.mjs'));
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/application-stacks.schema.yaml',import.meta.url),'utf8'));fs.writeFileSync(path.join(dist,'schemas','application-stacks.schema.json'),JSON.stringify(schema));
  assert.equal(fs.existsSync(path.join(dist,'schemas','application-stacks.schema.yaml')),false);
  const {pathToFileURL}=await import('node:url');
  const relocated=await import(`${pathToFileURL(path.join(payload,'.dist','checks','stacks.mjs')).href}?relocated=${Date.now()}`);
  const result=relocated.checkApplicationStacks({repoRoot:f.root,environment:'dev',deploymentModelFile:f.modelFile});assert.equal(result.ok,true,result.errors.map(x=>x.code).join(','));
});

test('the stacks CLI runs the same check and never echoes secret material on malformed input',t=>{
  const f=fixture(t),sentinel='synthetic-secret-never-echo';
  fs.writeFileSync(f.modelFile,'{"token":"'+sentinel+'",BROKEN');
  const before=fs.readFileSync(f.modelFile);
  const run=spawnSync(process.execPath,[fileURLToPath(new URL('../cli/main.mjs',import.meta.url)),'stacks','check',f.root,'--environment','dev','--deployment-model',f.modelFile],{encoding:'utf8',windowsHide:true});
  assert.equal(run.status,1);assert.equal(JSON.parse(run.stdout).ok,false);assert.equal((run.stdout+run.stderr).includes(sentinel),false);assert.deepEqual(fs.readFileSync(f.modelFile),before);
});

test('a legacy .stacks-only tree without .starcistacks fires STACKS_LEGACY_DIRECTORY instead of crashing or being accepted silently',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-legacy-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'.stacks','dev'),{recursive:true});
  fs.writeFileSync(path.join(root,'.stacks','application-stacks.yaml'),stringifyYaml(manifestFor()));
  const modelFile=path.join(root,'rendered.json');fs.writeFileSync(modelFile,JSON.stringify({}));
  assert.doesNotThrow(()=>checkApplicationStacks({repoRoot:root,environment:'dev',deploymentModelFile:modelFile}));
  const result=checkApplicationStacks({repoRoot:root,environment:'dev',deploymentModelFile:modelFile});
  assert.equal(result.ok,false);
  const finding=result.errors.find(x=>x.code==='STACKS_LEGACY_DIRECTORY');
  assert.ok(finding,result.errors.map(x=>x.code).join(','));
  assert.match(finding.message,/renamed.*\.starcistacks/);
});

test('a .starcistacks tree never fires STACKS_LEGACY_DIRECTORY, including when a leftover .stacks directory also exists',t=>{
  const f=fixture(t);
  assert.equal(f.check().errors.some(x=>x.code==='STACKS_LEGACY_DIRECTORY'),false);
  fs.mkdirSync(path.join(f.root,'.stacks'),{recursive:true});
  assert.equal(f.check().errors.some(x=>x.code==='STACKS_LEGACY_DIRECTORY'),false);
});
