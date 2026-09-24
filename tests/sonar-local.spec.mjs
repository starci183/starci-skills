import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  findDeclaration,projectTokenRef,readSonarDeclaration,resolveConfig,scannerCommand,scrub,sonarLocalMain,sourceHostStackDir,
} from '../scripts/checks/sonar-local.mjs';

// Fake values only: no real token is ever read by this spec.
const ADMIN='fake-admin-token-0001';
const ANALYSIS='fake-analysis-token-0002';
const MINTED='fake-minted-project-token-0003';

function temporary(t,label){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`starci-sonar-${label}-`));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
const write=(root,relative,body)=>{
  const file=path.join(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
  return file;
};

/** A fake SonarQube: records every request, answers the Web API calls the helper makes. */
async function fakeSonar(t,{gate='OK',up=true}={}){
  const state={projects:new Map(),requests:[],tokens:new Map([[ADMIN,'admin'],[ANALYSIS,'analysis']]),polls:0,gate};
  const server=http.createServer((req,res)=>{
    let body='';
    req.on('data',c=>{body+=c;});
    req.on('end',()=>{
      const url=new URL(req.url,'http://x');
      const auth=(req.headers.authorization??'').replace(/^Bearer /,'');
      state.requests.push({method:req.method,path:url.pathname,auth,query:Object.fromEntries(url.searchParams),form:Object.fromEntries(new URLSearchParams(body))});
      const send=(status,json)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(json));};
      if(url.pathname==='/api/system/status')return send(200,{status:up?'UP':'STARTING',version:'26.8.0.fake'});
      const role=state.tokens.get(auth);
      if(!role)return send(401,{errors:[{msg:'unauthorized'}]});
      switch(url.pathname){
        case '/api/authentication/validate':return send(200,{valid:true});
        case '/api/projects/search':{
          const key=url.searchParams.get('projects');
          return send(200,{components:state.projects.has(key)?[{key,name:state.projects.get(key)}]:[]});
        }
        case '/api/projects/create':{
          if(role!=='admin')return send(403,{});
          const form=new URLSearchParams(body);
          state.projects.set(form.get('project'),form.get('name'));
          return send(200,{project:{key:form.get('project')}});
        }
        case '/api/user_tokens/generate':{
          if(role!=='admin')return send(403,{});
          state.tokens.set(MINTED,'project');
          return send(200,{token:MINTED,name:new URLSearchParams(body).get('name')});
        }
        case '/api/user_tokens/revoke':return send(204,{});
        case '/api/ce/task':{
          state.polls+=1;
          return send(200,{task:state.polls<2?{status:'IN_PROGRESS'}:{status:'SUCCESS',analysisId:'AN-1'}});
        }
        case '/api/qualitygates/project_status':
          return send(200,{projectStatus:{status:state.gate,conditions:[{metricKey:'new_coverage',status:state.gate==='OK'?'OK':'ERROR',actualValue:'71.0',comparator:'LT',errorThreshold:'80'}]}});
        case '/api/issues/search':
          return send(200,{paging:{total:4},facets:[{property:'severities',values:[{val:'MAJOR',count:3},{val:'MINOR',count:1}]},{property:'types',values:[{val:'CODE_SMELL',count:4}]}]});
        case '/api/hotspots/search':return send(200,{paging:{total:1}});
        case '/api/measures/component':return send(200,{component:{measures:[{metric:'coverage',value:'71.0'},{metric:'ncloc',value:'120'}]}});
        default:return send(404,{});
      }
    });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  return {state,host:`http://127.0.0.1:${server.address().port}`};
}

/**
 * Fake custody: a stack directory whose admin token is a materialized sibling and whose analysis token
 * exists only as .enc, decrypted by a fake sops that also checks it was handed the master identity; a
 * fake stack-secret tool stores minted values as .enc members the fake sops can read back.
 */
function fakeCustody(root){
  const stack=path.join(root,'source','.stacks','dev');
  write(stack,'runtime/files/sonarqube-admin-token.key',`${ADMIN}\n`);
  write(stack,'runtime/files/sonarqube-analysis-token.txt.enc',`ENC:${ANALYSIS}`);
  const identity=write(root,'master.identity','AGE-SECRET-KEY-FAKE');
  const sops=write(root,'fake-sops.mjs',`import fs from 'node:fs';
if(process.env.SOPS_AGE_KEY_FILE!==${JSON.stringify(identity)}){process.stderr.write('wrong identity');process.exit(3);}
const file=process.argv.at(-1);
process.stdout.write(fs.readFileSync(file,'utf8').replace(/^ENC:/,''));`);
  const stackSecret=write(root,'fake-stack-secret.mjs',`import fs from 'node:fs';import path from 'node:path';
const [cmd,target,flag,from]=process.argv.slice(2);
if(cmd!=='set'||flag!=='--from-file')process.exit(4);
const file=path.join(process.cwd(),'.stacks',target+'.enc');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,'ENC:'+fs.readFileSync(from,'utf8'));`);
  return {stack,identity,sops,stackSecret};
}

function configFor(host,custody,extra={}){
  return {host,stack:custody.stack,identity:custody.identity,sops:custody.sops,stackSecret:custody.stackSecret,docker:'starci-no-such-docker',pollMs:5,...extra};
}

const assertNoSecret=(value,label)=>{
  const textValue=typeof value==='string'?value:JSON.stringify(value);
  for(const secret of [ADMIN,ANALYSIS,MINTED])assert.ok(!textValue.includes(secret),`${label} must not carry a token value`);
};

test('status reports server, custody and token validity - never a value', async t => {
  const root=temporary(t,'status');
  const {host}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['status'],{config:configFor(host,custody)});
  assert.equal(exitCode,0);
  assert.equal(report.outcome,'up');
  assert.equal(report.server.version,'26.8.0.fake');
  assert.deepEqual([report.custody.admin.via,report.custody.admin.valid],['materialized',true]);
  assert.deepEqual([report.custody.analysis.via,report.custody.analysis.valid],['sops',true]);
  assertNoSecret(report,'status report');
});

test('a server that does not answer is reported down in plain words, with the container state', async t => {
  const root=temporary(t,'down');
  const custody=fakeCustody(root);
  const closed=http.createServer();
  await new Promise(r=>closed.listen(0,'127.0.0.1',r));
  const host=`http://127.0.0.1:${closed.address().port}`;
  await new Promise(r=>closed.close(r));
  const {exitCode,report}=await sonarLocalMain(['status'],{config:configFor(host,custody)});
  assert.equal(exitCode,2);
  assert.equal(report.outcome,'down');
  assert.equal(report.server.reachable,false);
  assert.equal(report.docker.state,'docker-unavailable');
  assert.match(report.message,/is not reachable/);
  assert.match(report.message,/Docker is not available/);
});

test('ensure-project creates a missing project with the admin token and is idempotent', async t => {
  const root=temporary(t,'ensure');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const first=await sonarLocalMain(['ensure-project','--key','starci-next','--name','StarCi Next'],{config:configFor(host,custody)});
  assert.equal(first.exitCode,0);
  assert.equal(first.report.created,true);
  assert.equal(state.projects.get('starci-next'),'StarCi Next');
  const again=await sonarLocalMain(['ensure-project','--key','starci-next'],{config:configFor(host,custody)});
  assert.equal(again.report.created,false);
  assert.equal(state.requests.filter(r=>r.path==='/api/projects/create').length,1);
  assert.ok(state.requests.filter(r=>r.path.startsWith('/api/projects')).every(r=>r.auth===ADMIN),'project calls use the admin token');
  const bad=await sonarLocalMain(['ensure-project','--key','12345'],{config:configFor(host,custody)});
  assert.equal(bad.exitCode,2);
  fs.rmSync(path.join(custody.stack,'runtime/files/sonarqube-admin-token.key'));
  const missing=await sonarLocalMain(['ensure-project','--key','other'],{config:configFor(host,custody)});
  assert.equal(missing.report.outcome,'blocked');
  assert.match(missing.report.message,/never ask the owner/);
});

test('ensure-project --with-token mints a project analysis token into custody through the stack-secret tool', async t => {
  const root=temporary(t,'mint');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['ensure-project','--key','starci-next-fe','--with-token'],{config:configFor(host,custody)});
  assert.equal(exitCode,0);
  assert.equal(report.tokenCustody.via,'minted');
  const generate=state.requests.find(r=>r.path==='/api/user_tokens/generate');
  assert.deepEqual([generate.form.type,generate.form.projectKey],['PROJECT_ANALYSIS_TOKEN','starci-next-fe']);
  const enc=path.join(custody.stack,`${projectTokenRef('starci-next-fe')}.enc`);
  assert.equal(fs.readFileSync(enc,'utf8'),`ENC:${MINTED}`);
  assertNoSecret(report,'ensure report');
  const reuse=await sonarLocalMain(['ensure-project','--key','starci-next-fe','--with-token'],{config:configFor(host,custody)});
  assert.equal(reuse.report.tokenCustody.via,'sops','the stored member is decrypted, not minted again');
  assert.equal(state.requests.filter(r=>r.path==='/api/user_tokens/generate').length,1);
});

test('token runs a child with the analysis token in its env only, and alone reports presence', async t => {
  const root=temporary(t,'token');
  const {host}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const probe=write(root,'probe.mjs',`import fs from 'node:fs';
fs.writeFileSync(process.argv[2],JSON.stringify({token:process.env.SONAR_TOKEN===${JSON.stringify(ANALYSIS)},host:process.env.SONAR_HOST_URL}));`);
  const out=path.join(root,'probe.json');
  const run=await sonarLocalMain(['token','--',process.execPath,probe,out],{config:configFor(host,custody)});
  assert.equal(run.exitCode,0);
  assert.deepEqual(JSON.parse(fs.readFileSync(out,'utf8')),{token:true,host});
  const alone=await sonarLocalMain(['token'],{config:configFor(host,custody)});
  assert.equal(alone.report.outcome,'present');
  assertNoSecret(alone.report,'token report');
});

function fakeRepo(root,{scanner=true}={}){
  const repo=path.join(root,'product-repo');
  write(repo,'package.json',JSON.stringify({name:'product-repo',scripts:{'sonar:check':'node scanner.mjs'}}));
  write(repo,'sonar-project.properties','sonar.projectKey=product-repo\nsonar.host.url=https://sonar.example.invalid\n');
  // The fake scanner echoes the token (the helper must scrub it) and writes report-task.txt into the
  // work directory it is told to use; it fails like the real one when the host was not overridden.
  write(repo,'scanner.mjs',scanner?`import fs from 'node:fs';import path from 'node:path';
const d=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('-D')).map(a=>a.slice(2).split(/=(.*)/s)));
console.log('[INFO] token '+process.env.SONAR_TOKEN);
if(d['sonar.host.url']!==process.env.SONAR_HOST_URL){console.log('[ERROR] host not overridden');process.exit(5);}
fs.mkdirSync(d['sonar.working.directory'],{recursive:true});
fs.writeFileSync(path.join(d['sonar.working.directory'],'report-task.txt'),'projectKey=product-repo\\nceTaskId=CE-1\\ndashboardUrl='+process.env.SONAR_HOST_URL+'/dashboard?id=product-repo\\n');`
    :`console.log('[ERROR] Bootstrapper: Request failed with status code 401');process.exit(1);`);
  return repo;
}

test('scan runs the repository scanner against the local host, mints the project token and waits for the gate', async t => {
  const root=temporary(t,'scan');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const out=path.join(root,'E','sonar.json');
  const log=path.join(root,'E','sonar.txt');
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',repo,'--wait','--out',out,'--log',log],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.outcome,'pass');
  assert.equal(report.projectKey,'product-repo');
  assert.equal(report.project.created,true);
  assert.equal(report.custody.analysis.via,'minted');
  assert.equal(report.scanner.runner,'npm run sonar:check');
  assert.equal(report.ceTask.status,'SUCCESS');
  assert.equal(report.gate.status,'OK');
  assert.equal(report.issues.total,4);
  assert.deepEqual(report.issues.bySeverity,{MAJOR:3,MINOR:1});
  assert.equal(report.hotspots.toReview,1);
  assert.equal(report.measures.coverage,'71.0');
  assert.ok(state.requests.filter(r=>r.path==='/api/ce/task').every(r=>r.auth===MINTED),'the gate is read with the project token');
  const logText=fs.readFileSync(log,'utf8');
  assert.match(logText,/\[INFO\] token \*\*\*/);
  assertNoSecret(logText,'scanner log');
  assertNoSecret(fs.readFileSync(out,'utf8'),'summary file');
  assert.ok(!fs.existsSync(path.join(repo,'.scannerwork')),'the scan leaves no work directory in the repository');
});

test('a failing quality gate is a fail, and a scanner the server refuses is blocked - neither is a pass', async t => {
  const root=temporary(t,'gate');
  const {host}=await fakeSonar(t,{gate:'ERROR'});
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const failed=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.equal(failed.exitCode,1);
  assert.equal(failed.report.outcome,'fail');
  assert.match(failed.report.reason,/new_coverage 71\.0 vs LT 80/);
  fs.rmSync(repo,{recursive:true,force:true});
  const refused=fakeRepo(root,{scanner:false});
  const blocked=await sonarLocalMain(['scan','--cwd',refused,'--wait'],{config:configFor(host,custody)});
  assert.equal(blocked.exitCode,2);
  assert.equal(blocked.report.outcome,'blocked');
  const submitted=await sonarLocalMain(['scan','--cwd',fakeRepo(temporary(t,'nowait')),'--no-ensure'],{config:configFor(host,custody)});
  assert.equal(submitted.report.outcome,'submitted');
  assert.match(submitted.report.reason,/not a pass/);
});

test('scan takes host, stack, credentials and project from the repository declaration; disabled is not a pass', async t => {
  const root=temporary(t,'scan-decl');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const declaration=`schema: starci/application-stacks@1
services:
  sonar:
    provider: sonarqube
    mode: local
    host: {local: '${host}'}
    stack: {repository: source, root: .stacks, environment: dev, compose: .stacks/dev/infra/compose/sonarqube.yaml}
    projects: [{repository: product-repo, key: declared-key, name: Declared Name}]
    credentials:
      - {id: sonarqube-admin, env: SONAR_ADMIN_TOKEN, custody: {repository: source, path: .stacks/dev/runtime/files/sonarqube-admin-token.key}}
    ci: {wiring: optional-follow-up}
    ownerAction: none
`;
  write(repo,'.starcistacks/application-stacks.yaml',declaration);
  const {identity,sops,stackSecret}=custody;
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:{identity,sops,stackSecret,docker:'starci-no-such-docker',pollMs:5}});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.host,host);
  assert.equal(report.projectKey,'declared-key');
  assert.equal(state.projects.get('declared-key'),'Declared Name');
  assert.equal(report.custody.admin.via,'materialized');
  assert.ok(fs.existsSync(path.join(custody.stack,`${projectTokenRef('declared-key')}.enc`)),'the minted token lands in the declared stack custody');
  write(repo,'.starcistacks/application-stacks.yaml',declaration.replace('mode: local','mode: disabled\n    reason: prototype only'));
  const off=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:{identity,sops,stackSecret}});
  assert.equal(off.report.outcome,'disabled');
  assert.match(off.report.reason,/prototype only/);
});

test('scan is blocked with a plain reason when the server is not UP', async t => {
  const root=temporary(t,'scan-down');
  const {host}=await fakeSonar(t,{up:false});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,2);
  assert.match(report.reason,/reports STARTING/);
});

test('the stack declaration decides host, stack, custody and project key; source-host means the source dev stack', t => {
  const root=temporary(t,'decl');
  const backend=path.join(root,'shop-be');
  const frontend=path.join(root,'shop-fe');
  fs.mkdirSync(frontend,{recursive:true});
  // The services.sonar shape of modules/schemas/application-stacks.schema.yaml.
  write(backend,'.starcistacks/application-stacks.yaml',`schema: starci/application-stacks@1
sources:
  - repository: shop-be
  - repository: shop-fe
services:
  sonar:
    provider: sonarqube
    mode: local
    host: {local: 'http://127.0.0.1:9999', public: 'https://sonar.example.invalid'}
    stack: {repository: shop-infra, root: .stacks, environment: dev, compose: .stacks/dev/infra/compose/sonarqube.yaml, container: shop-sonarqube}
    auth: token
    projects:
      - {repository: shop-be, key: shop-backend, name: Shop Backend}
      - {repository: shop-fe, key: shop-frontend}
    credentials:
      - {id: sonarqube-admin, env: SONAR_ADMIN_TOKEN, custody: {repository: shop-infra, path: .stacks/dev/runtime/files/sonarqube-admin-token.key}}
      - {id: sonarqube-shop-frontend, env: SONAR_TOKEN, custody: {repository: shop-infra, path: .stacks/dev/runtime/files/sonarqube-shop-frontend-token.key}}
      - {id: sonarqube-analysis, env: SONAR_TOKEN, custody: {repository: shop-infra, path: .stacks/dev/runtime/files/sonarqube-analysis-token.txt}}
    ci: {wiring: optional-follow-up}
    ownerAction: none
`);
  const infra=path.join(root,'shop-infra','.stacks','dev');
  const be=resolveConfig({cwd:backend},{});
  assert.equal(be.host,'http://127.0.0.1:9999');
  assert.equal(be.publicHost,'https://sonar.example.invalid');
  assert.equal(be.stackDir,infra);
  assert.equal(be.composeFile,path.join(infra,'infra','compose','sonarqube.yaml'));
  assert.equal(be.container,'shop-sonarqube');
  assert.equal(be.adminToken,path.join(infra,'runtime','files','sonarqube-admin-token.key'));
  assert.equal(be.analysisToken,path.join(infra,'runtime','files','sonarqube-analysis-token.txt'));
  assert.deepEqual([be.declaredKey,be.declaredName,be.declaredTokenRef],['shop-backend','Shop Backend',null]);
  assert.deepEqual([be.declaration.ownerAction,be.declaration.ci],['none','optional-follow-up']);
  assert.equal(findDeclaration(frontend).file,path.join(backend,'.starcistacks','application-stacks.yaml'),'a frontend listed in sources is governed by the declaring stack');
  const fe=resolveConfig({cwd:frontend},{});
  assert.equal(fe.declaredKey,'shop-frontend');
  assert.equal(fe.declaredTokenRef,path.join(infra,'runtime','files','sonarqube-shop-frontend-token.key'));
  assert.equal(resolveConfig({cwd:frontend,host:'http://flag'},{}).host,'http://flag','an explicit flag wins over the declaration');
  const hosted=path.join(root,'hosted-repo');
  write(hosted,'.starcistacks/application-stacks.yaml','schema: starci/application-stacks@1\nservices:\n  sonar: {provider: sonarcloud, mode: hosted, host: {public: "https://sonarcloud.io"}, ci: {wiring: not-used}, ownerAction: none}\n');
  assert.equal(resolveConfig({cwd:hosted},{}).host,'https://sonarcloud.io');
  const off=path.join(root,'off-repo');
  write(off,'.starcistacks/application-stacks.yaml','schema: starci/application-stacks@1\nservices:\n  sonar: {provider: sonarqube, mode: disabled, reason: prototype only, ci: {wiring: not-used}, ownerAction: none}\n');
  assert.equal(resolveConfig({cwd:off},{}).disabled,'prototype only');

  const other=path.join(root,'plain-repo');
  write(other,'.starcistacks/application-stacks.yaml','schema: starci/application-stacks@1\nservices:\n  sonar: {provider: sonarqube, mode: local, stack: source-host, projects: [{repository: plain-repo, key: plain-key}], ci: {wiring: optional-follow-up}, ownerAction: none}\n');
  const src=resolveConfig({cwd:other},{});
  assert.equal(src.stackDir,sourceHostStackDir());
  assert.equal(src.host,'http://localhost:9010');
  assert.equal(src.declaredKey,'plain-key');
  assert.equal(readSonarDeclaration(write(root,'none.yaml','schema: starci/application-stacks@1\n')),null);
  assert.equal(resolveConfig({},{}).declaration,null,'no declaration falls back to the source host defaults');
});

test('the scanner command forces the local host and an outside work directory, never a token', () => {
  const withScript=scannerCommand({pkg:{scripts:{'sonar:check':'sonar-scanner-npm'}},props:{'sonar.projectKey':'k'},host:'http://localhost:9010',key:'k',workDir:'/tmp/w'});
  assert.deepEqual(withScript.args,['run','sonar:check','--','-Dsonar.host.url=http://localhost:9010','-Dsonar.working.directory=/tmp/w']);
  const bare=scannerCommand({pkg:{},props:{},host:'http://localhost:9010',key:'k2',workDir:'/tmp/w'});
  assert.equal(bare.runner,'npx @sonar/scan');
  assert.ok(bare.args.includes('-Dsonar.projectKey=k2'));
  assert.ok(![...withScript.args,...bare.args].some(a=>/token|login|password/i.test(a)));
  assert.equal(typeof scrub('x'),'string');
});
