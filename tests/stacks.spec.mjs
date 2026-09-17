import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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

function dualProfileFixture(t,selected='docker-apps'){
  const f=fixture(t,'dev'),sourceRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stack-source-'));t.after(()=>fs.rmSync(sourceRoot,{recursive:true,force:true}));
  fs.mkdirSync(path.join(sourceRoot,'apps','api','src'),{recursive:true});
  fs.writeFileSync(path.join(sourceRoot,'package.json'),JSON.stringify({private:true}));
  fs.writeFileSync(path.join(sourceRoot,'apps','api','package.json'),JSON.stringify({private:true,scripts:{dev:'node src/main.mjs'}}));
  fs.writeFileSync(path.join(sourceRoot,'apps','api','Dockerfile'),'FROM scratch\n');
  fs.writeFileSync(path.join(sourceRoot,'apps','api','src','main.mjs'),'export {}\n');
  fs.mkdirSync(path.join(f.root,'.stacks','dev','runtime'),{recursive:true});fs.writeFileSync(path.join(f.root,'.stacks','dev','runtime','api.env'),'# generated private env fixture\n');
  const revision='a'.repeat(40),dbImage=`postgres@sha256:${'b'.repeat(64)}`;
  f.manifest.sources=[{id:'backend',repositoryRole:'backend',rootRef:'BACKEND_SOURCE_ROOT',revision}];
  f.manifest.environments.dev.components.api={ownership:'managed',failureDomain:'selected-dev-profile'};
  f.manifest.environments.dev.profiles={
    'docker-apps':{exclusiveGroup:'dev-app-runtime',components:{
      api:{mode:'docker-service',service:'api',source:'backend',sourceRoot:'apps/api',build:{context:'.',dockerfile:'apps/api/Dockerfile',inputs:['package.json','apps/api']},readiness:{scheme:'http',host:'127.0.0.1',port:3068,path:'/health'},ports:[{name:'http',host:3068,container:3068}],connections:[{component:'db',variable:'DATABASE_HOST',host:'db',port:5432}]},
      db:{mode:'docker-service',service:'db',image:dbImage,ports:[{name:'postgres',host:5432,container:5432}],storage:[{volume:'db-data',custody:'application-owner encrypted backup',backupRef:'dev-backup/postgres'}]},
      mail:{mode:'external',owner:'developer',failureDomain:'provider-account',endpointRef:'MAIL_URL'},
    }},
    'native-apps':{exclusiveGroup:'dev-app-runtime',components:{
      api:{mode:'host-process',source:'backend',sourceRoot:'apps/api',command:'dev',envFile:'.stacks/dev/runtime/api.env',readiness:{scheme:'http',host:'127.0.0.1',port:3068,path:'/health'},ports:[{name:'http',host:3068}],connections:[{component:'db',variable:'DATABASE_HOST',host:'127.0.0.1',port:5432}]},
      db:{mode:'docker-service',service:'db',image:dbImage,ports:[{name:'postgres',host:5432,container:5432}],storage:[{volume:'db-data',custody:'application-owner encrypted backup',backupRef:'dev-backup/postgres'}]},
      mail:{mode:'external',owner:'developer',failureDomain:'provider-account',endpointRef:'MAIL_URL'},
    }},
  };
  const db={image:dbImage,ports:['5432:5432'],volumes:['db-data:/var/lib/postgresql/data'],environment:{DB_PASSWORD_FILE:'/run/secrets/db-password'},secrets:['db-password']};
  for(const key of Object.keys(f.model))delete f.model[key];
  Object.assign(f.model,{'x-starci-profile':selected,'x-starci-sources':{backend:{root:sourceRoot,revision}},services:{db},volumes:{'db-data':{}},secrets:{'db-password':{file:path.join(f.root,'.stacks','dev','db-password.txt')}}});
  if(selected==='docker-apps')f.model.services.api={build:{context:sourceRoot,dockerfile:'apps/api/Dockerfile'},ports:['3068:3068'],environment:{},secrets:[]};
  f.write();
  return {...f,sourceRoot,revision,dbImage};
}

function addRemoteApi(f,{publicApi=false}={}){
  const token='controlplane-api-token',enc='.stacks/dev/controlplane-api-token.enc',plain='.stacks/dev/runtime/controlplane-api-token';
  fs.mkdirSync(path.join(f.root,'.stacks','deployments'),{recursive:true});fs.mkdirSync(path.join(f.root,'contracts'),{recursive:true});fs.mkdirSync(path.join(f.root,'scripts'),{recursive:true});
  fs.writeFileSync(path.join(f.root,'.stacks','deployments','controlplane.json'),JSON.stringify({component:'controlplane',placement:'external-application-workload'}));
  fs.writeFileSync(path.join(f.root,'contracts','controlplane.openapi.yaml'),'openapi: 3.1.0\ninfo: {title: Fixture, version: 1.0.0}\n');
  fs.writeFileSync(path.join(f.root,'scripts','verify-controlplane.mjs'),'export {}\n');
  f.manifest.components.push({id:'controlplane',role:'backend',required:true});
  f.manifest.environments.dev.components.controlplane={ownership:'external',owner:'controlplane-application-owner',failureDomain:'remote-application-deployment',endpointRef:'CONTROLPLANE_API_URL'};
  f.manifest.environments.vps.components.controlplane={ownership:'external',owner:'controlplane-application-owner',failureDomain:'remote-application-deployment',endpointRef:'CONTROLPLANE_API_URL'};
  const remoteApi={deploymentRef:'.stacks/deployments/controlplane.json',contractRef:'contracts/controlplane.openapi.yaml',readiness:{scheme:'https',path:'/health/ready',verificationRef:'scripts/verify-controlplane.mjs'},callers:[{component:'api',timeoutMs:15000,...(publicApi?{publicAuthRationale:'published anonymous status API'}:{authRef:token})}]};
  for(const profile of Object.values(f.manifest.environments.dev.profiles))profile.components.controlplane={mode:'external',owner:'controlplane-application-owner',failureDomain:'remote-application-deployment',endpointRef:'CONTROLPLANE_API_URL',remoteApi:structuredClone(remoteApi)};
  if(!publicApi){
    fs.writeFileSync(path.join(f.root,...enc.split('/')),'data: ENC[AES256_GCM,data:cipher,iv:a,tag:b,type:str]\nsops:\n  age: []\n');
    f.manifest.environments.dev.secrets.push({name:token,source:'provider-issued',sourceOwner:'controlplane-application-owner',encryptedRef:enc,materializedPath:plain,recipientPolicy:'policy:owner-age',keyCustody:'custody:owner-password-manager'});
    f.model.secrets[token]={file:path.join(f.root,...plain.split('/'))};
    if(f.model['x-starci-profile']==='docker-apps'){
      f.model.services.api.secrets.push(token);f.model.services.api.environment.CONTROLPLANE_TOKEN_FILE=`/run/secrets/${token}`;f.model.services.api.environment.CONTROLPLANE_API_URL='https://redacted.invalid';
    }
  }
  f.write();return remoteApi;
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
  const f=fixture(t),payload=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stack-runtime-'));t.after(()=>fs.rmSync(payload,{recursive:true,force:true}));
  const dist=path.join(payload,'.dist');fs.mkdirSync(path.join(dist,'checks'),{recursive:true});fs.mkdirSync(path.join(dist,'core'),{recursive:true});fs.mkdirSync(path.join(dist,'schemas'),{recursive:true});
  fs.copyFileSync(new URL('../checks/stacks.mjs',import.meta.url),path.join(dist,'checks','stacks.mjs'));fs.copyFileSync(new URL('../core/yaml.mjs',import.meta.url),path.join(dist,'core','yaml.mjs'));
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/application-stacks.schema.yaml',import.meta.url),'utf8'));fs.writeFileSync(path.join(dist,'schemas','application-stacks.schema.json'),JSON.stringify(schema));
  assert.equal(fs.existsSync(path.join(dist,'schemas','application-stacks.schema.yaml')),false);
  const relocated=await import(`${pathToFileURL(path.join(payload,'.dist','checks','stacks.mjs')).href}?relocated=${Date.now()}`);
  const result=relocated.checkApplicationStacks({repoRoot:f.root,environment:'dev',deploymentModelFile:f.modelFile});assert.equal(result.ok,true,result.errors.map(x=>x.code).join(','));
});

test('binds every sensitive file pointer to the secret target granted to that service',t=>{
  const f=fixture(t);f.model.services.api.environment.DB_PASSWORD_FILE='/tmp/unrelated';f.write();let result=f.check();assert.ok(result.errors.some(x=>x.code==='service-secret-file-mismatch'));
  f.model.services.api.secrets=[{source:'db-password',target:'database-credential'}];f.model.services.api.environment.DB_PASSWORD_FILE='/run/secrets/database-credential';f.write();result=f.check();assert.equal(result.errors.some(x=>x.code==='service-secret-file-mismatch'),false,result.errors.map(x=>x.code).join(','));
  f.model.services.api.environment.DB_PASSWORD_FILE='/run/secrets/not-granted';f.write();assert.ok(f.check().errors.some(x=>x.code==='service-secret-file-mismatch'));
});

test('checks Docker-app and host-native dev profiles against one immutable split-repo source binding',t=>{
  const docker=dualProfileFixture(t,'docker-apps'),dockerResult=docker.check();
  assert.equal(dockerResult.ok,true,JSON.stringify(dockerResult.errors,null,2));assert.equal(dockerResult.profile,'docker-apps');
  const native=dualProfileFixture(t,'native-apps');
  fs.writeFileSync(path.join(native.root,'.stacks','dev','runtime','api.env'),'PRIVATE_SENTINEL=never-echo-this\n');
  const nativeResult=native.check();assert.equal(nativeResult.ok,true,JSON.stringify(nativeResult.errors,null,2));assert.equal(nativeResult.profile,'native-apps');
  assert.equal(JSON.stringify(nativeResult).includes('PRIVATE_SENTINEL'),false,'checker never reads or returns native env contents');
  for(const fixture of [docker,native]){
    const run=spawnSync(process.execPath,[fileURLToPath(new URL('../cli/main.mjs',import.meta.url)),'stacks','check',fixture.root,'--environment','dev','--deployment-model',fixture.modelFile],{encoding:'utf8',windowsHide:true});
    assert.equal(run.status,0,run.stderr||run.stdout);assert.equal(JSON.parse(run.stdout).profile,fixture.model['x-starci-profile']);
  }
});

test('fails source drift, invalid host/container endpoint graphs, and same-profile port conflicts',t=>{
  const f=dualProfileFixture(t,'native-apps');
  f.model['x-starci-sources'].backend.revision='c'.repeat(40);
  f.manifest.environments.dev.profiles['native-apps'].components.api.connections[0].host='db';
  f.manifest.environments.dev.profiles['native-apps'].components.api.ports.push({name:'collision',host:5432});f.write();
  const codes=f.check().errors.map(item=>item.code);
  for(const code of ['source-revision-mismatch','native-connection-invalid','schema-policy-invalid','profile-port-conflict'])assert.ok(codes.includes(code),`${code}: ${codes.join(',')}`);
});

test('rejects mutable dependency images, anonymous state, and rendered build-context drift before runtime effects',t=>{
  const f=dualProfileFixture(t,'docker-apps');
  f.manifest.environments.dev.profiles['docker-apps'].components.db.image='postgres:16';
  f.model.services.db.image='postgres:16';f.model.services.db.volumes.push('/var/lib/postgresql/other');
  f.model.services.db.ports=['55432:5432'];f.model.services.api.build.context=f.root;f.write();
  const codes=f.check().errors.map(item=>item.code);
  for(const code of ['profile-image-not-immutable','profile-port-mismatch','stateful-anonymous-volume','docker-build-context-mismatch'])assert.ok(codes.includes(code),`${code}: ${codes.join(',')}`);
});

test('validates closure for unselected profiles without claiming their runtime was checked',t=>{
  const f=dualProfileFixture(t,'docker-apps');delete f.manifest.environments.dev.profiles['native-apps'].components.mail;f.write();
  const result=f.check();assert.ok(result.errors.some(item=>item.code==='schema-policy-invalid'&&item.path.includes('native-apps.components.mail')));
});

test('selected native profile requires an existing private env file and one shared exclusive group',t=>{
  const f=dualProfileFixture(t,'native-apps');fs.rmSync(path.join(f.root,'.stacks','dev','runtime','api.env'));
  f.manifest.environments.dev.profiles['native-apps'].exclusiveGroup='different-runtime-group';f.write();
  const codes=f.check().errors.map(item=>item.code);
  assert.ok(codes.includes('native-env-unavailable'),codes.join(','));
  assert.ok(codes.includes('schema-policy-invalid'),codes.join(','));
});

test('native host connections use target host ports and docker-to-host routing fails closed',t=>{
  const f=dualProfileFixture(t,'native-apps'),source=f.sourceRoot;
  fs.mkdirSync(path.join(source,'apps','web','src'),{recursive:true});fs.writeFileSync(path.join(source,'apps','web','package.json'),JSON.stringify({private:true,scripts:{dev:'node src/main.mjs'}}));
  fs.writeFileSync(path.join(source,'apps','web','Dockerfile'),'FROM scratch\n');fs.writeFileSync(path.join(source,'apps','web','src','main.mjs'),'export {}\n');
  fs.writeFileSync(path.join(f.root,'.stacks','dev','runtime','web.env'),'# generated private env fixture\n');
  f.manifest.components.push({id:'web',role:'frontend',required:true});
  f.manifest.sources.push({id:'frontend',repositoryRole:'frontend',rootRef:'FRONTEND_SOURCE_ROOT',revision:f.revision});
  f.manifest.environments.dev.components.web={ownership:'managed',failureDomain:'selected-dev-profile'};
  f.manifest.environments.vps.components.web={ownership:'external',owner:'future-vps-release',failureDomain:'vps-release',endpointRef:'WEB_URL'};
  f.manifest.environments.dev.profiles['docker-apps'].components.web={mode:'docker-service',service:'web',source:'frontend',sourceRoot:'apps/web',build:{context:'.',dockerfile:'apps/web/Dockerfile',inputs:['package.json','apps/web']},readiness:{scheme:'http',host:'127.0.0.1',port:3067,path:'/health'},ports:[{name:'http',host:3067,container:3067}]};
  f.manifest.environments.dev.profiles['native-apps'].components.web={mode:'host-process',source:'frontend',sourceRoot:'apps/web',command:'dev',envFile:'.stacks/dev/runtime/web.env',readiness:{scheme:'http',host:'127.0.0.1',port:3067,path:'/health'},ports:[{name:'http',host:3067}],connections:[{component:'api',variable:'API_HOST',host:'wrong-host',port:9999}]};
  f.model['x-starci-sources'].frontend={root:source,revision:f.revision};f.write();
  let codes=f.check().errors.map(item=>item.code);assert.ok(codes.includes('native-connection-invalid'),codes.join(','));
  const web=f.manifest.environments.dev.profiles['native-apps'].components.web;
  Object.assign(web,{mode:'docker-service',service:'web',build:{context:'.',dockerfile:'apps/web/Dockerfile',inputs:['package.json','apps/web']}});
  f.model.services.web={build:{context:source,dockerfile:'apps/web/Dockerfile'},ports:['3067:3067']};f.write();
  codes=f.check().errors.map(item=>item.code);assert.ok(codes.includes('profile-connection-mode-unsupported'),codes.join(','));
});

test('custodied state volume cannot also be mounted by another selected-profile service',t=>{
  const f=dualProfileFixture(t,'docker-apps');f.model.services.api.volumes=['db-data:/copied-db'];f.write();
  assert.ok(f.check().errors.some(item=>item.code==='profile-volume-owner-mismatch'));
});

test('all named stateful volumes require custody and backup declarations',t=>{
  const f=dualProfileFixture(t,'docker-apps');f.model.volumes['untracked-data']={};f.model.services.db.volumes.push('untracked-data:/other-state');f.write();
  assert.ok(f.check().errors.some(item=>item.code==='stateful-volume-uncustodied'));
});

test('ports and readiness syntax fail closed and Docker applications expose a readiness contract',t=>{
  const f=dualProfileFixture(t,'docker-apps'),api=f.manifest.environments.dev.profiles['docker-apps'].components.api;
  api.ports[0].host=-1;api.ports[0].container=-1;api.readiness={scheme:'http',host:'127.0.0.1',port:-1,path:''};f.write();
  let codes=f.check().errors.map(item=>item.code);assert.ok(codes.includes('schema-policy-invalid'),codes.join(','));assert.ok(codes.includes('docker-readiness-missing'),codes.join(','));
  api.ports=[{name:'http',host:3068,container:3068}];delete api.readiness;f.model.services.api.ports=['3068:3068'];f.write();
  codes=f.check().errors.map(item=>item.code);assert.ok(codes.includes('docker-readiness-missing'),codes.join(','));
  f.model.services.api.healthcheck={test:['CMD','node','health.js']};f.write();
  assert.equal(f.check().errors.some(item=>item.code==='docker-readiness-missing'),false);
});

test('explicit remote application API binds caller policy, custody, and opaque repository evidence without a local duplicate',t=>{
  const f=dualProfileFixture(t,'native-apps');addRemoteApi(f);
  const result=f.check();assert.equal(result.ok,true,JSON.stringify(result.errors,null,2));
  assert.match(result.limitations.join(' '),/remote API contract.*opaque/i);
  assert.equal(JSON.stringify(result).includes('cipher'),false);
  const publicFixture=dualProfileFixture(t,'native-apps');addRemoteApi(publicFixture,{publicApi:true});
  assert.equal(publicFixture.check().ok,true,JSON.stringify(publicFixture.check().errors,null,2));
});

test('remote application API fails unresolved evidence, caller, auth, and local-service conflicts',t=>{
  const f=dualProfileFixture(t,'docker-apps');addRemoteApi(f);const selected=f.manifest.environments.dev.profiles['docker-apps'].components.controlplane,api=selected.remoteApi;
  f.model.services.api.secrets=[];delete f.model.services.api.environment.CONTROLPLANE_TOKEN_FILE;f.write();
  assert.ok(f.check().errors.some(item=>item.code==='remote-api-auth-not-granted'));
  f.model.services.api.secrets=['controlplane-api-token'];f.model.services.api.environment.CONTROLPLANE_TOKEN_FILE='/run/secrets/controlplane-api-token';
  delete f.model.services.api.environment.CONTROLPLANE_API_URL;f.write();assert.ok(f.check().errors.some(item=>item.code==='remote-api-endpoint-not-bound'));
  f.model.services.api.environment.CONTROLPLANE_API_URL='https://redacted.invalid';selected.owner='different-owner';api.readiness.path='//unexpected-host/ready';
  fs.rmSync(path.join(f.root,'contracts','controlplane.openapi.yaml'));
  api.callers[0].component='controlplane';api.callers[0].publicAuthRationale='conflicting public mode';selected.service='controlplane';
  f.model.services.controlplane={image:`example/controlplane@sha256:${'c'.repeat(64)}`};f.write();
  const codes=new Set(f.check().errors.map(item=>item.code));
  for(const code of ['remote-api-contract-ref-unavailable','remote-api-caller-invalid','remote-api-auth-invalid','remote-api-local-service-conflict','remote-api-authority-mismatch','remote-api-readiness-invalid'])assert.ok(codes.has(code),`${code}: ${[...codes].join(',')}`);
});
