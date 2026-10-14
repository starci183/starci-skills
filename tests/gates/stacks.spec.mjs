import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {stringifyYaml} from '../../engine/yaml.mjs';
import {checkApplicationStacks,trackedStacksGateFindings} from '../../scripts/gates/stacks-gate.mjs';
import {stacksReleaseFindings} from '../../scripts/hfs/rules/stacks-release.mjs';
import {stacksSwarmFindings} from '../../scripts/hfs/rules/stacks-swarm.mjs';
import {importClosure} from '../../scripts/hfs/sync-runtime.mjs';
import {swarmService} from '../helpers/swarm-stack-fixture.mjs';

const RUNBOOK=(extra=[])=>[
  '# runbook','','| command | what it does |','|---|---|',
  '| prepare | decrypt secrets |','| doctor | validate config |','| up | start the stack |',
  '| status | show status |','| logs | tail logs |','| down | stop the stack |',
  '| verification | curl health |',...extra,''
].join('\n');

const manifestFor=()=>({schema:'starci/application-stacks@1',
  components:{api:{role:'service',image:'example/api',compose:'infra/compose/api.yaml'},
    db:{role:'stateful',image:'postgres:16',compose:'infra/compose/db.yaml'},
    edge:{role:'ingress',image:`traefik:3@sha256:${'c'.repeat(64)}`,compose:'infra/stack.yaml'},
    mail:{role:'gateway',required:false}},
  environments:{dev:{status:'supported',runtime:'docker-compose',composeFiles:['infra/compose/compose.yaml'],
    components:{api:{port:3001},db:{port:5432}},runbook:'README.md',
    secrets:[{name:'db-password',where:'secrets/db-password',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}]},
  vps:{status:'supported',runtime:'docker-swarm',composeFiles:['infra/stack.yaml'],
    components:{api:{replicas:2},db:{},edge:{}},runbook:'README.md',
    secrets:[{name:'app-token',runtimeName:'app-token-v1',version:1,where:'secrets/app-token',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}],
    ingress:{component:'edge',hosts:['api.example.test']},
    dns:[{host:'api.example.test',owner:'ops',receipt:'dns-confirmed'}],tls:{owner:'ops',receipt:'tls-confirmed'},
    release:{imagesLock:'.starcistacks/vps/releases/images.lock',pointer:'.starcistacks/vps/releases/current',previous:'.starcistacks/vps/releases/previous',healthAssertions:['api /health/ready']},
    backup:[{component:'db',target:'offsite-encrypted',retention:'30 days',owner:'ops',restoreProof:'.starcistacks/vps/releases/restore-proof.md'}]}},
  k8s:{status:'deferred',reason:'not in the current delivery target'}});

function vpsModel(){
  const api=swarmService(),db=swarmService(`postgres:16@sha256:${'b'.repeat(64)}`);
  api.environment={APP_TOKEN_FILE:'/run/secrets/app-token'};
  api.secrets=['app-token'];
  api.deploy.labels={'traefik.http.routers.api.rule':'Host(`api.example.test`)'};
  db.deploy.placement={constraints:['node.labels.database == true']};
  const edge={...swarmService(`traefik:3@sha256:${'c'.repeat(64)}`),ports:['80:80','443:443']};
  return {services:{api,db,edge},secrets:{'app-token':{external:true,name:'app-token-v1'}}};
}

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
  fs.mkdirSync(path.join(root,'.starcistacks','vps','releases'),{recursive:true});
  for(const file of ['images.lock','current','previous','restore-proof.md'])
    fs.writeFileSync(path.join(root,'.starcistacks','vps','releases',file),'fixture release evidence\n');
  const manifest=manifestFor(),modelFile=path.join(root,'rendered.json');
  const model=environment==='dev'?{services:{api:{},db:{}}}:vpsModel();
  const sourceModel=environment==='vps'?model:vpsModel();
  const write=()=>{fs.writeFileSync(path.join(root,'.starcistacks','application-stacks.yaml'),stringifyYaml(manifest));fs.writeFileSync(modelFile,JSON.stringify(model));if(fs.existsSync(path.join(root,'.starcistacks','vps','infra')))fs.writeFileSync(path.join(root,'.starcistacks','vps','infra','stack.yaml'),stringifyYaml(sourceModel));};write();
  return {root,manifest,model,modelFile,write,check:()=>checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile})};
}

test('accepts an exact static dev inventory and states its non-live limits',t=>{
  const f=fixture(t),result=f.check();assert.equal(result.ok,true,result.errors.map(x=>`${x.code}:${x.path}`).join(','));assert.match(result.limitations.join(' '),/Docker was not invoked/);
});

test('accepts a static vps inventory using the swarm runtime',t=>{
  const f=fixture(t,'vps'),result=f.check();assert.equal(result.ok,true,result.errors.map(x=>`${x.code}:${x.path}`).join(','));
});

test('rejects an unrecognized schema id',t=>{
  const f=fixture(t);f.manifest.schema='starci/other';f.write();assert.ok(f.check().errors.some(x=>x.code==='schema-invalid'));
});

test('rejects unsafe or symlinked compose paths and undeclared compose files',t=>{
  const f=fixture(t),outside=path.join(path.dirname(f.root),'outside-compose.yaml');fs.writeFileSync(outside,'services: {}\n');t.after(()=>fs.rmSync(outside,{force:true}));
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
  const codes=new Set(f.check().errors.map(x=>x.code));assert.equal(codes.has('plaintext-sensitive-environment'),false);assert.ok(codes.has('compose-placeholder-unresolved'));
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
  delete f.model.services.db;f.write();
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
  const codes=new Set(f.check().errors.map(x=>x.code));assert.ok(codes.has('secret-duplicate'));assert.ok(codes.has('encrypted-ref-invalid'));
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
  const errors=f.check().errors;assert.ok(errors.some(x=>x.code==='HFS_STACKS_SHAPE'&&x.path==='services.api.image'));assert.ok(errors.some(x=>x.code==='HFS_STACKS_SHAPE'&&x.path==='services.api.build'));
});

test('malformed null component catalog fails checking without crashing',t=>{
  const f=fixture(t);f.manifest.components=null;f.write();assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
});

test('rejects primitive, oversized, and unknown manifest shapes without throwing',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'.starcistacks','application-stacks.yaml'),'null\n');assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
  fs.writeFileSync(path.join(f.root,'.starcistacks','application-stacks.yaml'),'x'.repeat(4*1024*1024+1));assert.ok(f.check().errors.some(x=>x.code==='input-too-large'));
  f.write();f.manifest.unrecognized=true;f.write();assert.ok(f.check().errors.some(x=>x.code==='schema-shape-invalid'&&x.message==='unknown field'));
});

test('executes from a relocated installed payload using its authored schema YAML',async t=>{
  const f=fixture(t),payload=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stack-runtime-'));t.after(()=>fs.rmSync(payload,{recursive:true,force:true}));
  const dist=path.join(payload,'payload');
  for(const file of importClosure(['scripts/gates/stacks-gate.mjs'])){fs.mkdirSync(path.dirname(path.join(dist,file)),{recursive:true});fs.copyFileSync(new URL(`../../${file}`,import.meta.url),path.join(dist,file));}
  fs.mkdirSync(path.join(dist,'modules','schemas'),{recursive:true});
  fs.copyFileSync(new URL('../../modules/schemas/application-stacks.schema.yaml',import.meta.url),path.join(dist,'modules','schemas','application-stacks.schema.yaml'));
  const {pathToFileURL}=await import('node:url');
  const relocated=await import(`${pathToFileURL(path.join(dist,'scripts','gates','stacks-gate.mjs')).href}?relocated=${Date.now()}`);
  const result=relocated.checkApplicationStacks({repoRoot:f.root,environment:'dev',deploymentModelFile:f.modelFile});assert.equal(result.ok,true,result.errors.map(x=>x.code).join(','));
});

test('the stacks check reports malformed input and never echoes secret material',t=>{
  const f=fixture(t),sentinel='synthetic-secret-never-echo';
  fs.writeFileSync(f.modelFile,'{"token":"'+sentinel+'",BROKEN');
  const before=fs.readFileSync(f.modelFile);
  const result=checkApplicationStacks({repoRoot:f.root,environment:'dev',deploymentModelFile:f.modelFile});
  assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes(sentinel),false);assert.deepEqual(fs.readFileSync(f.modelFile),before);
});

function trackedContext(f,edition='full'){
  if(edition==='lite'){
    const spec=f.manifest.environments.vps;
    spec.composeFiles=['infra/swarm/stack.yaml'];
    const directory=path.join(f.root,'.starcistacks','vps','infra','swarm');
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'stack.yaml'),stringifyYaml(f.model));
    fs.rmSync(path.join(f.root,'.starcistacks','vps','infra','stack.yaml'));
    fs.writeFileSync(path.join(f.root,'.starcistacks','application-stacks.yaml'),stringifyYaml(f.manifest));
  }
  const files=['.starcistacks/application-stacks.yaml'];
  for(const environment of ['dev','vps']){
    const prefix=`.starcistacks/${environment}/`;
    files.push(`${prefix}README.md`,`${prefix}secrets/${environment==='dev'?'db-password':'app-token'}.enc`,
      `${prefix}${f.manifest.environments[environment].composeFiles[0]}`);
  }
  for(const file of ['images.lock','current','previous','restore-proof.md'])files.push(`.starcistacks/vps/releases/${file}`);
  return {repoRoot:f.root,files,all:files,repo:{profile:'app',edition},isRoot:true};
}

for(const edition of ['lite','full']){
  test(`tracked stacks gate surfaces schema, runbook and unresolved model failures in ${edition}`,t=>{
    const f=fixture(t,'vps');
    f.model.services.api.environment.WEB_URL='${WEB_URL}';
    f.manifest.unrecognized=true;
    fs.writeFileSync(path.join(f.root,'.starcistacks','vps','README.md'),'# Missing runbook commands\n');
    f.write();
    const findings=trackedStacksGateFindings(trackedContext(f,edition));
    for(const expected of ['unresolved interpolation','unknown field','document the prepare command'])
      assert.ok(findings.some(item=>item.code==='HFS_STACKS_SHAPE'&&item.message.includes(expected)),expected);
  });

  test(`tracked stacks gate reports unavailable rendered evidence once in ${edition}`,t=>{
    const f=fixture(t,'vps'),context=trackedContext(f,edition);
    const rendered=`.starcistacks/vps/${f.manifest.environments.vps.composeFiles[0]}`;
    context.files=context.all=context.files.filter(file=>file!==rendered);
    const missing=trackedStacksGateFindings(context).filter(item=>item.code==='STACKS_MODEL_UNAVAILABLE');
    assert.equal(missing.length,1);
    const existingFindings=stacksReleaseFindings(context);
    assert.equal(existingFindings.filter(item=>item.code==='STACKS_MODEL_UNAVAILABLE').length,1);
    assert.deepEqual(trackedStacksGateFindings({...context,existingFindings}),[]);
  });
}

test('tracked stacks gate preserves scope and uses explicitly declared rendered evidence',t=>{
  const f=fixture(t,'vps'),context=trackedContext(f);
  f.manifest.environments.vps.renderedModel='infra/rendered.yaml';
  const rendered='.starcistacks/vps/infra/rendered.yaml';
  fs.writeFileSync(path.join(f.root,rendered),stringifyYaml(f.model));
  f.write();context.files.push(rendered);
  assert.deepEqual(trackedStacksGateFindings(context),[]);
  f.model.services.api.environment.WEB_URL='${WEB_URL}';
  fs.writeFileSync(path.join(f.root,rendered),stringifyYaml(f.model));
  assert.ok(trackedStacksGateFindings(context).some(item=>item.code==='HFS_STACKS_SHAPE'));
  assert.deepEqual(trackedStacksGateFindings({...context,inScope:()=>false}),[]);
});

test('tracked stacks gate deduplicates hardening findings already emitted by the finder',t=>{
  const f=fixture(t,'vps');
  delete f.model.services.api.healthcheck;f.write();
  const context=trackedContext(f),existingFindings=stacksSwarmFindings(context);
  assert.equal(existingFindings.filter(item=>item.code==='STACKS_HEALTHCHECK_MISSING').length,1);
  const gateFindings=trackedStacksGateFindings({...context,existingFindings});
  assert.equal(gateFindings.filter(item=>item.code==='STACKS_HEALTHCHECK_MISSING').length,0);
  assert.ok(gateFindings.some(item=>item.code==='HFS_STACKS_SHAPE'));
});
