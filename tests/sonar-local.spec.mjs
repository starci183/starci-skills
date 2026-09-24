import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {
  coverageFreshness,coverageReports,findDeclaration,parseDiffNewLines,projectTokenRef,readSonarDeclaration,resolveConfig,scannerCommand,
  scrub,sliceChanges,sonarLocalMain,sourceHostStackDir,
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

/**
 * Line coverage of the fake repository's slice files, as /api/sources/lines answers it: every line of
 * src/app.js and src/new.js is coverable and hit unless listed in `missed`.
 */
const coveredSources=({missed=[],lines={'src/app.js':30,'src/new.js':3,'src/legacy.js':5}}={})=>Object.fromEntries(Object.entries(lines).map(([file,count])=>
  [file,Array.from({length:count},(_,i)=>({line:i+1,lineHits:missed.includes(`${file}:${i+1}`)?0:1}))]));

/**
 * A fake SonarQube: records every request, answers the Web API calls the helper makes. `issues` and
 * `hotspots` are [{path, line}] of the project; the default ones sit on lines no slice changed (debt).
 */
async function fakeSonar(t,{gate='OK',up=true,sources=coveredSources(),linesToCover='120',
  issues=[{path:'src/legacy.js',line:2,severity:'MAJOR',type:'CODE_SMELL'},{path:'src/app.js',line:2,severity:'MINOR',type:'CODE_SMELL'}],
  hotspots=[{path:'src/legacy.js',line:3}]}={}){
  const state={projects:new Map(),requests:[],tokens:new Map([[ADMIN,'admin'],[ANALYSIS,'analysis']]),polls:0,gate,sources,issues,hotspots,linesToCover};
  const fileOf=component=>component.split(':').slice(1).join(':');
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
        case '/api/issues/search':{
          const components=(url.searchParams.get('components')??'').split(',');
          if(components.every(c=>!c.includes(':')))
            return send(200,{paging:{total:4},facets:[{property:'severities',values:[{val:'MAJOR',count:3},{val:'MINOR',count:1}]},{property:'types',values:[{val:'CODE_SMELL',count:4}]}]});
          const found=state.issues.flatMap((issue,i)=>components.filter(c=>fileOf(c)===issue.path).map(c=>({key:`IS-${i}`,rule:'js:S1',message:'fake issue',component:c,line:issue.line,severity:issue.severity??'MAJOR',type:issue.type??'CODE_SMELL'})));
          return send(200,{paging:{total:found.length},issues:found});
        }
        case '/api/hotspots/search':{
          const project=url.searchParams.get('projectKey');
          return send(200,{paging:{total:state.hotspots.length},hotspots:state.hotspots.map((h,i)=>({key:`HS-${i}`,ruleKey:'js:S2',vulnerabilityProbability:'HIGH',message:'fake hotspot',component:`${project}:${h.path}`,line:h.line}))});
        }
        case '/api/sources/lines':{
          const lines=state.sources[fileOf(url.searchParams.get('key')??'')];
          if(!lines)return send(404,{errors:[{msg:'not found'}]});
          const from=Number(url.searchParams.get('from')??1),to=Number(url.searchParams.get('to')??1e9);
          return send(200,{sources:lines.filter(l=>l.line>=from&&l.line<=to)});
        }
        case '/api/qualitygates/get_by_project':return send(200,{qualityGate:{name:'Sonar way'}});
        case '/api/qualitygates/show':return send(200,{conditions:[{metric:'new_coverage',op:'LT',error:'80'}]});
        case '/api/measures/component':return send(200,{component:{measures:[{metric:'coverage',value:'71.0'},{metric:'ncloc',value:'120'},
          ...(state.linesToCover?[{metric:'lines_to_cover',value:state.linesToCover}]:[])]}});
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

const gitIn=(cwd,...args)=>{
  const result=spawnSync('git',['-c','user.name=spec','-c','user.email=spec@example.invalid','-c','core.autocrlf=false',...args],{cwd,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
const numbered=(count,label)=>Array.from({length:count},(_,i)=>`const ${label}${i+1} = ${i+1};`).join('\n')+'\n';
/** Write the lcov report the scanner reads, after everything else on disk (a fresh test:ci run). */
const freshLcov=repo=>{const file=write(repo,'coverage/lcov.info','TN:\nend_of_record\n');const later=new Date(Date.now()+2000);fs.utimesSync(file,later,later);return file;};

/**
 * A product repository with one base commit (src/legacy.js, a 5-line src/app.js) and a slice on top in
 * the working tree: src/app.js grows to 30 lines (6-30 changed) and src/new.js is added untracked.
 */
function fakeRepo(root,{scanner=true,lcov=true}={}){
  const repo=path.join(root,'product-repo');
  write(repo,'package.json',JSON.stringify({name:'product-repo',scripts:{'sonar:check':'node scanner.mjs'}}));
  write(repo,'sonar-project.properties','sonar.projectKey=product-repo\nsonar.host.url=https://sonar.example.invalid\nsonar.javascript.lcov.reportPaths=coverage/lcov.info\n');
  write(repo,'.gitignore','coverage/\n');
  write(repo,'src/legacy.js',numbered(5,'legacy'));
  write(repo,'src/app.js',numbered(5,'app'));
  // The fake scanner echoes the token (the helper must scrub it) and writes report-task.txt into the
  // work directory it is told to use; it fails like the real one when the host was not overridden.
  write(repo,'scanner.mjs',scanner?`import fs from 'node:fs';import path from 'node:path';
const d=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('-D')).map(a=>a.slice(2).split(/=(.*)/s)));
console.log('[INFO] token '+process.env.SONAR_TOKEN);
if(d['sonar.host.url']!==process.env.SONAR_HOST_URL){console.log('[ERROR] host not overridden');process.exit(5);}
fs.mkdirSync(d['sonar.working.directory'],{recursive:true});
fs.writeFileSync(path.join(d['sonar.working.directory'],'report-task.txt'),'projectKey=product-repo\\nceTaskId=CE-1\\ndashboardUrl='+process.env.SONAR_HOST_URL+'/dashboard?id=product-repo\\n');`
    :`console.log('[ERROR] Bootstrapper: Request failed with status code 401');process.exit(1);`);
  gitIn(repo,'init','-q','-b','main');
  gitIn(repo,'add','-A');
  gitIn(repo,'commit','-q','-m','base');
  write(repo,'src/app.js',numbered(30,'app'));
  write(repo,'src/new.js',numbered(3,'fresh'));
  if(lcov)freshLcov(repo);
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
  assert.equal(report.schema,'starci/sonar-local-scan@2');
  assert.equal(report.scope,'slice');
  assert.equal(report.projectGate.status,'OK');
  assert.equal(report.projectGate.scope,'whole-project');
  assert.deepEqual(report.slice.changedFiles.sort(),['src/app.js','src/new.js']);
  assert.equal(report.slice.base,'HEAD');
  assert.deepEqual([report.slice.verdict,report.slice.newIssues.total,report.slice.newHotspots.total],['pass',0,0],'debt on unchanged lines is not the slice\'s');
  assert.deepEqual([report.slice.coverage.coverableLines,report.slice.coverage.percent,report.slice.coverage.threshold,report.slice.coverage.applied],[28,100,80,true]);
  assert.equal(report.coverageReport.fresh,true);
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

test('a failing whole-project gate is a note for a clean slice and the verdict only under --project-gate', async t => {
  const root=temporary(t,'gate');
  const {host}=await fakeSonar(t,{gate:'ERROR'});
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const slice=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.equal(slice.exitCode,0,JSON.stringify(slice.report));
  assert.equal(slice.report.outcome,'pass');
  assert.equal(slice.report.projectGate.status,'ERROR');
  assert.match(slice.report.projectGate.note,/not a block[\s\S]*new_coverage 71\.0 vs LT 80/);
  const failed=await sonarLocalMain(['scan','--cwd',repo,'--wait','--project-gate'],{config:configFor(host,custody)});
  assert.equal(failed.exitCode,1);
  assert.equal(failed.report.outcome,'fail');
  assert.equal(failed.report.scope,'project');
  assert.match(failed.report.reason,/new_coverage 71\.0 vs LT 80/);
});

test('the slice fails on an issue or hotspot it introduced and on uncovered changed lines', async t => {
  const root=temporary(t,'slice-fail');
  const {host}=await fakeSonar(t,{issues:[{path:'src/app.js',line:12,severity:'CRITICAL',type:'BUG'},{path:'src/legacy.js',line:1}],hotspots:[{path:'src/new.js',line:2}],
    sources:coveredSources({missed:Array.from({length:10},(_,i)=>`src/app.js:${i+10}`)})});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,1);
  assert.equal(report.outcome,'fail');
  assert.equal(report.slice.newIssues.total,1);
  assert.deepEqual(report.slice.newIssues.items.map(i=>[i.path,i.line,i.severity]),[['src/app.js',12,'CRITICAL']]);
  assert.equal(report.slice.newHotspots.total,1);
  assert.equal(report.slice.coverage.percent,64.3);
  assert.deepEqual(report.slice.coverage.uncovered,[{path:'src/app.js',lines:[10,11,12,13,14,15,16,17,18,19]}]);
  assert.match(report.reason,/coverage on the slice's changed lines 64\.3% < 80%[\s\S]*1 open issue[\s\S]*1 security hotspot/);
});

test('--paths confines the slice; a small slice is not held to the coverage threshold', async t => {
  const root=temporary(t,'slice-paths');
  const {host}=await fakeSonar(t,{issues:[{path:'src/app.js',line:12}],sources:coveredSources({missed:['src/new.js:1','src/new.js:2']})});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait','--paths','src/new.js'],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.deepEqual(report.slice.changedFiles,['src/new.js'],'another slice\'s file is outside --paths');
  assert.equal(report.slice.newIssues.total,0);
  assert.deepEqual([report.slice.coverage.coverableLines,report.slice.coverage.applied],[3,false]);
  assert.match(report.slice.coverage.note,/ignoreSmallChanges/);
});

test('a stale or missing lcov and an empty slice are refused before the scanner runs', async t => {
  const root=temporary(t,'refuse');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root,{lcov:false});
  const missing=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.deepEqual([missing.exitCode,missing.report.outcome,missing.report.code],[1,'refused','COVERAGE_MISSING']);
  const lcov=write(repo,'coverage/lcov.info','TN:\n');
  const past=new Date(Date.now()-3600_000);
  fs.utimesSync(lcov,past,past);
  const stale=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.deepEqual([stale.report.outcome,stale.report.code],['refused','COVERAGE_STALE']);
  assert.match(stale.report.reason,/before the head commit[\s\S]*test:ci/);
  freshLcov(repo);
  const since=await sonarLocalMain(['scan','--cwd',repo,'--wait','--fresh-since',new Date(Date.now()+60_000).toISOString()],{config:configFor(host,custody)});
  assert.match(since.report.reason,/before this attempt/);
  const later=new Date(Date.now()+10_000);
  fs.utimesSync(path.join(repo,'src','new.js'),later,later);
  const edited=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.match(edited.report.reason,/src\/new\.js changed after it was written/);
  const empty=await sonarLocalMain(['scan','--cwd',repo,'--wait','--paths','docs'],{config:configFor(host,custody)});
  assert.deepEqual([empty.report.outcome,empty.report.code],['refused','SLICE_EMPTY']);
  const unknown=await sonarLocalMain(['scan','--cwd',repo,'--wait','--base','no-such-ref'],{config:configFor(host,custody)});
  assert.deepEqual([unknown.report.outcome,unknown.report.code],['refused','SLICE_BASE_UNKNOWN']);
  assert.equal(state.requests.length,0,'nothing reached the server');
});

test('an analysis that imported no coverage is refused, never a trivially covered pass', async t => {
  const root=temporary(t,'no-import');
  const {host}=await fakeSonar(t,{linesToCover:null,sources:{'src/app.js':Array.from({length:30},(_,i)=>({line:i+1})),'src/new.js':[{line:1},{line:2},{line:3}]}});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.deepEqual([exitCode,report.outcome,report.code],[1,'refused','COVERAGE_NOT_IMPORTED']);
});

test('a scanner the server refuses is blocked and a submission alone is not a pass', async t => {
  const root=temporary(t,'refused-scanner');
  const {host}=await fakeSonar(t);
  const custody=fakeCustody(root);
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
  freshLcov(repo);
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

test('the slice reads new-side line ranges from git, including renames and untracked files', t => {
  const patch=['diff --git a/src/a.js b/src/a.js','index 1..2 100644','--- a/src/a.js','+++ b/src/a.js','@@ -3 +3,2 @@','-old','--- removed line that looks like a header','+new','+new2','@@ -10,2 +11,0 @@','-gone','-gone',
    'diff --git a/src/b.js b/src/b.js','new file mode 100644','--- /dev/null','+++ b/src/b.js','@@ -0,0 +1,4 @@','+a','+b','+c','+d',
    'diff --git a/src/c.js b/src/c.js','deleted file mode 100644','--- a/src/c.js','+++ /dev/null','@@ -1 +0,0 @@','-x',
    'diff --git a/old.js b/moved.js','similarity index 100%','rename from old.js','rename to moved.js'].join('\n');
  assert.deepEqual(parseDiffNewLines(patch),[{path:'src/a.js',added:false,ranges:[[3,4]]},{path:'src/b.js',added:true,ranges:[[1,4]]},{path:'moved.js',added:false,ranges:[]}]);
  const root=temporary(t,'slice-git');
  const repo=fakeRepo(root);
  gitIn(repo,'add','-A');
  gitIn(repo,'commit','-q','-m','slice');
  const base=gitIn(repo,'rev-parse','HEAD~1');
  const slice=sliceChanges(repo,{base,paths:'src'});
  assert.deepEqual(slice.files.map(f=>[f.path,f.added,f.ranges]).sort(),[['src/app.js',false,[[6,30]]],['src/new.js',true,[[1,3]]]]);
  assert.equal(sliceChanges(repo,{}).files.length,0,'a committed slice needs its base');
  assert.deepEqual(coverageReports({props:{},pkg:{scripts:{'sonar:check':'sonar-scanner -Dsonar.javascript.lcov.reportPaths=out/lcov.info'}}}),['out/lcov.info']);
  assert.deepEqual(coverageReports({}),['coverage/lcov.info']);
  assert.equal(coverageFreshness(repo,{reports:['coverage/lcov.info'],files:['src/app.js']}).fresh,true);
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
