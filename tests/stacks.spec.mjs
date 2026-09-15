import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {checkApplicationStacks} from '../checks/stacks.mjs';

const manifestFor=root=>({schema:'starci/application-stacks@1',components:[
  {id:'api',role:'backend',required:true},{id:'db',role:'stateful',required:true},{id:'mail',role:'gateway',required:false}],
environments:{dev:{status:'supported',runtime:'docker-compose',composeFiles:['.stacks/dev/compose.yaml'],components:{
  api:{ownership:'managed',service:'api',failureDomain:'dev-compose'},db:{ownership:'managed',service:'db',failureDomain:'dev-compose'},
  mail:{ownership:'external',owner:'developer',failureDomain:'provider-account',endpointRef:'MAIL_URL'}},
  runbook:{prepare:'dev prepare',doctor:'dev doctor',up:'dev up',status:'dev status',logs:'dev logs',down:'dev down',verification:{coldStart:'verify cold',restart:'verify restart',persistence:'verify data'}},
  secrets:[{name:'db-password',source:'generated',generationAlgorithm:'CSPRNG',formatPolicy:'32-byte base64url',encryptedRef:'.stacks/dev/db-password.txt.enc',materializedPath:'.stacks/dev/db-password.txt',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}]},
vps:{status:'supported',runtime:'docker-swarm',composeFiles:['.stacks/vps/compose.yaml'],components:{api:{ownership:'managed',service:'api',failureDomain:'vps-compose'},db:{ownership:'external',owner:'database-provider',failureDomain:'provider-region',endpointRef:'DATABASE_URL'},mail:{ownership:'external',owner:'mail-provider',failureDomain:'provider-account',endpointRef:'MAIL_URL'}},
  runbook:{prepare:'vps prepare',doctor:'vps doctor',up:'vps up',status:'vps status',logs:'vps logs',down:'vps down',update:'vps update',rollback:'vps rollback',backup:'vps backup',restore:'vps restore',verification:{coldStart:'verify cold',restart:'verify restart',persistence:'verify data'}},platform:{ubuntu:'24.04 LTS',architectures:['amd64']},secrets:[{name:'app-token',source:'provider-issued',sourceOwner:'application owner',encryptedRef:'.stacks/vps/app-token.yaml.enc',runtimeName:'app-token-v1',version:'v1',recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'}]}},k8s:{status:'deferred',reason:'not in the current delivery target'}});

function fixture(t,environment='dev'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'.stacks','dev'),{recursive:true});fs.mkdirSync(path.join(root,'.stacks','vps'),{recursive:true});
  fs.writeFileSync(path.join(root,'.stacks','dev','compose.yaml'),'services: {}\n');fs.writeFileSync(path.join(root,'.stacks','vps','compose.yaml'),'services: {}\n');
  fs.writeFileSync(path.join(root,'.stacks','dev','db-password.txt.enc'),'data: ENC[AES256_GCM,data:cipher,iv:a,tag:b,type:str]\nsops:\n  age: []\n');
  fs.writeFileSync(path.join(root,'.stacks','vps','app-token.yaml.enc'),'data: ENC[AES256_GCM,data:cipher,iv:a,tag:b,type:str]\nsops:\n  age: []\n');
  const manifest=manifestFor(root),modelFile=path.join(root,'rendered.json'),materialized=path.join(root,'.stacks','dev','db-password.txt');
  const model=environment==='dev'?{services:{api:{environment:{DB_PASSWORD_FILE:'/run/secrets/db-password'},secrets:['db-password']},db:{}},secrets:{'db-password':{file:materialized}}}:{services:{api:{image:'example/api@sha256:fixture',environment:{APP_TOKEN_FILE:'/run/secrets/app_token'},secrets:[{source:'app-token',target:'app_token'}],deploy:{replicas:1},healthcheck:{test:['CMD','node','health.js']},networks:['app-overlay']}},networks:{'app-overlay':{driver:'overlay'}},secrets:{'app-token':{external:true,name:'app-token-v1'}}};
  const write=()=>{fs.writeFileSync(path.join(root,'.stacks','application-stacks.yaml'),stringifyYaml(manifest));fs.writeFileSync(modelFile,JSON.stringify(model));};write();
  return {root,manifest,model,modelFile,write,check:()=>checkApplicationStacks({repoRoot:root,environment,deploymentModelFile:modelFile})};
}

test('accepts an exact static dev inventory and states its non-live limits',t=>{
  const f=fixture(t),result=f.check();assert.equal(result.ok,true,result.errors.map(x=>x.code).join(','));assert.match(result.limitations.join(' '),/Docker was not invoked/);
});

test('fails missing component coverage and ambiguous external ownership',t=>{
  const f=fixture(t);delete f.manifest.environments.dev.components.db;delete f.manifest.environments.dev.components.mail.owner;delete f.manifest.environments.dev.components.mail.failureDomain;f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('component-unclassified'));assert.ok(codes.includes('external-authority-missing'));
});

test('rejects unsafe or symlinked repository assets',t=>{
  const f=fixture(t),outside=path.join(path.dirname(f.root),'outside-compose.yaml');fs.writeFileSync(outside,'services: {}\n');
  f.manifest.environments.dev.composeFiles=['../outside-compose.yaml'];f.write();assert.ok(f.check().errors.some(x=>x.code==='compose-path-unsafe'));
  f.manifest.environments.dev.composeFiles=['.stacks/dev/link.yaml'];try{fs.symlinkSync(outside,path.join(f.root,'.stacks','dev','link.yaml'));}catch{return;}f.write();assert.ok(f.check().errors.some(x=>x.code==='compose-path-unsafe'));
});

test('reports plaintext sensitive environment keys without returning their values',t=>{
  const f=fixture(t),secretValue='must-never-appear';f.model.services.api.environment.API_TOKEN=secretValue;f.write();const result=f.check();
  assert.ok(result.errors.some(x=>x.code==='plaintext-sensitive-environment'));assert.equal(JSON.stringify(result).includes(secretValue),false);
});

test('rejects encrypted files mounted directly and unresolved Compose placeholders',t=>{
  const f=fixture(t);f.model.secrets['db-password'].file=path.join(f.root,'.stacks','dev','db-password.txt.enc');f.model.services.api.image='app:${TAG}';f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('encrypted-secret-mounted'));assert.ok(codes.includes('compose-placeholder-unresolved'));
});

test('does not let Kubernetes become an implicit supported environment',t=>{
  const f=fixture(t);f.manifest.k8s={status:'supported',reason:'later'};f.write();assert.ok(f.check().errors.some(x=>x.code==='k8s-status-invalid'));
});

test('requires VPS operations and platform bounds while permitting an external database',t=>{
  const f=fixture(t,'vps');assert.equal(f.check().ok,true);fs.writeFileSync(f.modelFile,stringifyYaml(f.model));assert.equal(f.check().ok,true,'Docker Stack YAML is accepted');delete f.manifest.environments.vps.runbook.restore;delete f.manifest.environments.vps.platform;f.write();
  const codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('vps-command-missing'));assert.ok(codes.includes('vps-platform-missing'));
});

test('requires immutable external Swarm secret mapping and stable logical service grants',t=>{
  const f=fixture(t,'vps');f.model.secrets['app-token']={external:true,name:'wrong-runtime-name'};f.write();let codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('swarm-secret-invalid'));
  f.model.secrets['app-token']={external:true,name:'app-token-v1'};f.model.services.api.secrets=[{source:'app-token-v1',target:'app_token'}];f.write();codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('service-secret-grant-invalid'));
});

test('requires rendered Swarm deploy, health, and overlay obligations for managed services',t=>{
  const f=fixture(t,'vps');delete f.model.services.api.deploy;delete f.model.services.api.healthcheck;delete f.model.networks;f.write();const codes=f.check().errors.map(x=>x.code);
  assert.ok(codes.includes('swarm-deploy-policy-missing'));assert.ok(codes.includes('swarm-healthcheck-missing'));assert.ok(codes.includes('swarm-overlay-missing'));
});

test('rejects raw Swarm build dependencies, empty images, and disabled health checks',t=>{
  const f=fixture(t,'vps');f.model.services.api.image='';f.model.services.api.build={context:'.'};f.model.services.api.depends_on=['db'];f.model.services.api.healthcheck={disable:true};f.write();const codes=f.check().errors.map(x=>x.code);
  for(const code of ['swarm-image-missing','swarm-build-unrendered','swarm-dependency-unrendered','swarm-healthcheck-missing'])assert.ok(codes.includes(code),code);
});

test('malformed null inventory component fails VPS checking without crashing later component lookup',t=>{
  const f=fixture(t,'vps');f.manifest.components=[null,...f.manifest.components];f.write();assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
});

test('rejects primitive, oversized, and unknown manifest shapes without throwing',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'.stacks','application-stacks.yaml'),'null\n');assert.doesNotThrow(()=>f.check());assert.equal(f.check().ok,false);
  fs.writeFileSync(path.join(f.root,'.stacks','application-stacks.yaml'),'x'.repeat(4*1024*1024+1));assert.ok(f.check().errors.some(x=>x.code==='input-too-large'));
  f.write();f.manifest.unrecognized=true;f.write();assert.ok(f.check().errors.some(x=>x.code==='schema-shape-invalid'&&x.message==='unknown field'));
});

test('requires exact secret inventory, grants, and a recognizable SOPS envelope',t=>{
  const f=fixture(t);f.model.secrets.extra={file:path.join(f.root,'.stacks','dev','extra')};f.model.services.api.secrets.push('missing');f.write();let codes=f.check().errors.map(x=>x.code);
  assert.ok(codes.includes('compose-secret-unclassified'));assert.ok(codes.includes('service-secret-grant-invalid'));
  f.model.secrets={ 'db-password':{file:path.join(f.root,'.stacks','dev','db-password.txt')} };f.model.services.api.secrets=['db-password'];f.manifest.environments.dev.secrets.push({...f.manifest.environments.dev.secrets[0]});
  fs.writeFileSync(path.join(f.root,'.stacks','dev','db-password.txt.enc'),'plaintext renamed as encrypted');f.write();codes=f.check().errors.map(x=>x.code);assert.ok(codes.includes('secret-duplicate'));assert.ok(codes.includes('encrypted-ref-invalid'));
});

test('rejects a materialization path through a symlink ancestor without reading plaintext',t=>{
  const f=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-secret-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const link=path.join(f.root,'.stacks','dev','linked');try{fs.symlinkSync(outside,link,'junction');}catch{return;}f.manifest.environments.dev.secrets[0].materializedPath='.stacks/dev/linked/secret.txt';f.model.secrets['db-password'].file=path.join(link,'secret.txt');f.write();assert.ok(f.check().errors.some(x=>x.code==='materialized-path-invalid'));
});

test('allows escaped shell interpolation while rejecting unresolved host fields',t=>{
  const f=fixture(t);f.model.services.api.command=['sh','-c','echo $${RUNTIME_VALUE}'];f.write();assert.equal(f.check().errors.some(x=>x.code==='compose-placeholder-unresolved'),false);
  f.model.services.api.image='app:${TAG}';f.write();assert.ok(f.check().errors.some(x=>x.code==='compose-placeholder-unresolved'));
});

test('validates malformed nested fields in the unselected environment',t=>{
  const f=fixture(t,'dev');f.manifest.environments.vps.runbook.prepare={command:'bad'};f.manifest.environments.vps.platform.architectures=['riscv'];
  f.manifest.environments.vps.components.db=null;f.manifest.environments.vps.secrets=[{name:'issued',source:'provider-issued',encryptedRef:'.stacks/vps/issued.yaml.enc',materializedPath:'.stacks/vps/issued.yaml',recipientPolicy:'policy',keyCustody:'custody'}];f.write();
  const result=f.check();assert.equal(result.ok,false);assert.ok(result.errors.some(x=>x.code==='schema-shape-invalid'&&x.path.includes('/vps/runbook/prepare')));assert.ok(result.errors.some(x=>x.path.includes('/vps/platform/architectures/0')));assert.ok(result.errors.some(x=>x.path.includes('/vps/components/db')));assert.ok(result.errors.some(x=>x.code==='schema-policy-invalid'&&x.path.includes('secrets[0]')));
});

test('executes from a relocated installed payload using only its compiled schema JSON',async t=>{
  const f=fixture(t),payload=fs.mkdtempSync(path.join(process.cwd(),'tmp-stack-runtime-'));t.after(()=>fs.rmSync(payload,{recursive:true,force:true}));
  const dist=path.join(payload,'.dist');fs.mkdirSync(path.join(dist,'checks'),{recursive:true});fs.mkdirSync(path.join(dist,'core'),{recursive:true});fs.mkdirSync(path.join(dist,'schemas'),{recursive:true});
  fs.copyFileSync(new URL('../checks/stacks.mjs',import.meta.url),path.join(dist,'checks','stacks.mjs'));fs.copyFileSync(new URL('../core/yaml.mjs',import.meta.url),path.join(dist,'core','yaml.mjs'));
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/application-stacks.schema.yaml',import.meta.url),'utf8'));fs.writeFileSync(path.join(dist,'schemas','application-stacks.schema.json'),JSON.stringify(schema));
  assert.equal(fs.existsSync(path.join(dist,'schemas','application-stacks.schema.yaml')),false);
  const relocated=await import(`${new URL(`../${path.basename(payload)}/.dist/checks/stacks.mjs`,import.meta.url).href}?relocated=${Date.now()}`);
  const result=relocated.checkApplicationStacks({repoRoot:f.root,environment:'dev',deploymentModelFile:f.modelFile});assert.equal(result.ok,true,result.errors.map(x=>x.code).join(','));
});

test('binds every sensitive file pointer to the secret target granted to that service',t=>{
  const f=fixture(t);f.model.services.api.environment.DB_PASSWORD_FILE='/tmp/unrelated';f.write();let result=f.check();assert.ok(result.errors.some(x=>x.code==='service-secret-file-mismatch'));
  f.model.services.api.secrets=[{source:'db-password',target:'database-credential'}];f.model.services.api.environment.DB_PASSWORD_FILE='/run/secrets/database-credential';f.write();result=f.check();assert.equal(result.errors.some(x=>x.code==='service-secret-file-mismatch'),false,result.errors.map(x=>x.code).join(','));
  f.model.services.api.environment.DB_PASSWORD_FILE='/run/secrets/not-granted';f.write();assert.ok(f.check().errors.some(x=>x.code==='service-secret-file-mismatch'));
});
