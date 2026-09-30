import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {allocationMs} from '../engine/config.mjs';
import {
  coverageFreshness,coverageReports,findDeclaration,isolatedKey,isolationDefines,parseDiffNewLines,projectTokenRef,readSonarDeclaration,resolveConfig,
  resolveScanCwd,scannerCommand,scrub,sliceChanges,sonarLocalMain,sourceHostStackDir,
} from '../scripts/checks/sonar-local.mjs';

// Fake values only: no real token is ever read by this spec.
const ADMIN='fake-admin-token-0001';
const ANALYSIS='fake-analysis-token-0002';
const MINTED='fake-minted-project-token-0003';
const REMINTED='fake-reminted-token-0004';

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
async function fakeSonar(t,{gate='OK',firstAnalysis=false,up=true,sources=coveredSources(),linesToCover='120',tests=[],
  issues=[{path:'src/legacy.js',line:2,severity:'MAJOR',type:'CODE_SMELL'},{path:'src/app.js',line:2,severity:'MINOR',type:'CODE_SMELL'}],
  hotspots=[{path:'src/legacy.js',line:3}],duplications={}}={}){
  const state={gateConditions:null,gateSelected:new Map(),newCode:new Map(),duplications:{},projects:new Map(),requests:[],tokens:new Map([[ADMIN,'admin'],[ANALYSIS,'analysis']]),polls:0,mintValues:[],gate,firstAnalysis,sources,issues,hotspots,linesToCover,tests};
  state.duplications=duplications;
  const fileOf=component=>component.split(':').slice(1).join(':');
  const server=http.createServer((req,res)=>{
    let body='';
    req.on('data',c=>{body+=c;});
    req.on('end',()=>{
      const url=new URL(req.url,'http://x');
      const auth=(req.headers.authorization??'').replace(/^Bearer /,'');
      const record={method:req.method,path:url.pathname,auth,query:Object.fromEntries(url.searchParams),form:Object.fromEntries(new URLSearchParams(body))};
      state.requests.push(record);
      // connection: close - no keep-alive socket outlives its request. A reused idle socket races the server's
      // 5s keepAliveTimeout: when the gap between two helper calls (git fixtures, the scanner) lands on it under
      // load, the next request reads ECONNRESET and the helper reports the server unreachable (`blocked`).
      const send=(status,json)=>{record.status=status;res.writeHead(status,{'content-type':'application/json',connection:'close'});res.end(JSON.stringify(json));};
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
          const minted=state.mintValues.shift()??MINTED;
          state.tokens.set(minted,'project');
          return send(200,{token:minted,name:new URLSearchParams(body).get('name')});
        }
        case '/api/user_tokens/revoke':return send(204,{});
        case '/api/projects/delete':{
          if(role!=='admin')return send(403,{});
          state.projects.delete(new URLSearchParams(body).get('project'));
          return send(204,{});
        }
        case '/api/ce/task':{
          state.polls+=1;
          return send(200,{task:state.polls<2?{status:'IN_PROGRESS'}:{status:'SUCCESS',analysisId:'AN-1'}});
        }
        case '/api/qualitygates/project_status':
          return send(200,{projectStatus:{status:state.gate,conditions:state.firstAnalysis?[]:[{metricKey:'new_coverage',status:state.gate==='OK'?'OK':'ERROR',actualValue:'71.0',comparator:'LT',errorThreshold:'80'}]}});
        case '/api/issues/search':{
          const components=(url.searchParams.get('components')??url.searchParams.get('componentKeys')??'').split(',').filter(Boolean);
          if(components.every(c=>!c.includes(':')))
            return send(200,{paging:{total:4},facets:[{property:'severities',values:[{val:'MAJOR',count:3},{val:'MINOR',count:1}]},{property:'types',values:[{val:'CODE_SMELL',count:4}]}]});
          // Like SonarQube 26.x (IssueQueryFactory): one component list must share one qualifier.
          const qualifiers=[...new Set(components.map(c=>state.tests.includes(fileOf(c))?'UTS':'FIL'))];
          if(qualifiers.length>1)return send(400,{errors:[{msg:`All components must have the same qualifier, found ${qualifiers.join(',')}`}]});
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
        case '/api/qualitygates/show':{
          if(url.searchParams.get('name')!=='starci-new-code'||!state.gateConditions)return send(404,{errors:[{msg:'not found'}]});
          return send(200,{name:'starci-new-code',conditions:[...state.gateConditions.values()]});
        }
        case '/api/qualitygates/create':{
          if(role!=='admin')return send(403,{});
          state.gateConditions=new Map();
          return send(201,{name:new URLSearchParams(body).get('name')});
        }
        case '/api/qualitygates/create_condition':case '/api/qualitygates/update_condition':{
          if(role!=='admin')return send(403,{});
          const form=new URLSearchParams(body);
          const id=form.get('id')??`C-${state.gateConditions.size+1}`;
          state.gateConditions.set(form.get('metric'),{id,metric:form.get('metric'),op:form.get('op'),error:form.get('error')});
          return send(200,{id});
        }
        case '/api/qualitygates/delete_condition':{
          for(const [metric,c] of state.gateConditions)if(c.id===new URLSearchParams(body).get('id'))state.gateConditions.delete(metric);
          return send(204,{});
        }
        case '/api/qualitygates/select':{const form=new URLSearchParams(body);state.gateSelected.set(form.get('projectKey'),form.get('gateName'));return send(204,{});}
        case '/api/new_code_periods/set':{const form=new URLSearchParams(body);state.newCode.set(form.get('project'),`${form.get('type')}:${form.get('value')}`);return send(204,{});}
        case '/api/duplications/show':{
          const component=url.searchParams.get('key')??'';
          const blocks=state.duplications[fileOf(component)];
          if(!blocks)return send(200,{duplications:[],files:{}});
          return send(200,{duplications:blocks.map(b=>({blocks:[{from:b.from,size:b.size,_ref:'1'},{from:1,size:b.size,_ref:'2'}]})),files:{'1':{key:component},'2':{key:'x:src/elsewhere.js'}}});
        }
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
  const stack=path.join(root,'source','.starcistacks','dev');
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
const file=path.join(process.cwd(),'.starcistacks',target+'.enc');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,'ENC:'+fs.readFileSync(from,'utf8'));`);
  return {stack,identity,sops,stackSecret};
}

// The helper's own 8s default bounds every fake-sops spawn and Web API call; a node child under the full suite's
// load can take longer than that to start, which turned a healthy fake custody into 'sops did not decrypt' and
// a spurious `blocked`. Specs bound them by the per-spec budget runtimes.yaml gives the land gate instead; a case
// that exercises the timeout itself passes its own timeoutMs.
const CHILD_TIMEOUT_MS=allocationMs('landGate.perSpecMs');

function configFor(host,custody,extra={}){
  // record: a re-mint event of a spec never reaches the supervisor ledger.
  return {host,stack:custody.stack,identity:custody.identity,sops:custody.sops,stackSecret:custody.stackSecret,docker:'starci-no-such-docker',pollMs:5,timeoutMs:CHILD_TIMEOUT_MS,record:()=>{},...extra};
}

const assertNoSecret=(value,label)=>{
  const textValue=typeof value==='string'?value:JSON.stringify(value);
  for(const secret of [ADMIN,ANALYSIS,MINTED,REMINTED])assert.ok(!textValue.includes(secret),`${label} must not carry a token value`);
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
  let blobBytes;
  const blobbed=await sonarLocalMain(['status','--blob'],{config:configFor(host,custody),
    put:async bytes=>{blobBytes=Buffer.from(bytes);return {sha:'a'.repeat(64),size:bytes.length,mediaType:'application/json'};}});
  assert.deepEqual(blobbed.blob,{sha:'a'.repeat(64),redaction:'v1'});
  assert.deepEqual(JSON.parse(blobBytes.toString()),blobbed.report);
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

test('a stale generic analysis token the server rejects is re-minted by status through the stack-secret tool and recorded', async t => {
  const root=temporary(t,'remint-generic');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  // The container and its database were recreated: the stored analysis token no longer exists on the server.
  state.tokens.delete(ANALYSIS);
  state.mintValues.push(REMINTED);
  const events=[];
  const {exitCode,report}=await sonarLocalMain(['status'],{config:configFor(host,custody,{record:e=>events.push(e)})});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.outcome,'up');
  assert.deepEqual([report.custody.analysis.via,report.custody.analysis.reminted,report.custody.analysis.valid],['minted',true,true]);
  const generate=state.requests.filter(r=>r.path==='/api/user_tokens/generate');
  assert.equal(generate.length,1);
  assert.equal(generate[0].auth,ADMIN,'minted with the admin token');
  assert.equal(generate[0].form.type,'GLOBAL_ANALYSIS_TOKEN');
  assert.equal(fs.readFileSync(path.join(custody.stack,'runtime/files/sonarqube-analysis-token.txt.enc'),'utf8'),`ENC:${REMINTED}`,'stored over the rejected member');
  assert.equal(events.length,1);
  assert.equal(events[0].kind,'sonar-token-reminted');
  assert.deepEqual([events[0].payload.role,events[0].payload.ref],['analysis','runtime/files/sonarqube-analysis-token.txt']);
  assertNoSecret(report,'status report');
  assertNoSecret(events,'remint event');
  const again=await sonarLocalMain(['status'],{config:configFor(host,custody,{record:e=>events.push(e)})});
  assert.deepEqual([again.report.outcome,again.report.custody.analysis.via],['up','sops'],'the repaired member is read back, not minted again');
  assert.equal(state.requests.filter(r=>r.path==='/api/user_tokens/generate').length,1);
  assert.equal(events.length,1);
});

test('a rejected analysis token with no valid admin token is blocked as rejected, never minted', async t => {
  const root=temporary(t,'remint-noadmin');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  state.tokens.delete(ANALYSIS);
  state.tokens.delete(ADMIN);
  const events=[];
  const {exitCode,report}=await sonarLocalMain(['status'],{config:configFor(host,custody,{record:e=>events.push(e)})});
  assert.equal(exitCode,2);
  assert.equal(report.outcome,'blocked');
  assert.match(report.message,/rejected by the server/);
  assert.deepEqual([report.custody.admin.valid,report.custody.analysis.valid,report.custody.analysis.rejected],[false,false,true]);
  assert.equal(state.requests.filter(r=>r.path==='/api/user_tokens/generate').length,0);
  assert.equal(events.length,0);
});

test('a stored project token the server rejects is re-minted over the same custody member before use', async t => {
  const root=temporary(t,'remint-project');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const events=[];
  const config=configFor(host,custody,{record:e=>events.push(e)});
  const first=await sonarLocalMain(['ensure-project','--key','starci-next','--with-token'],{config});
  assert.equal(first.report.tokenCustody.via,'minted');
  assert.equal(events.length,0,'a first mint is not a re-mint');
  // Recreated server: every stored analysis token is gone.
  state.tokens.delete(MINTED);
  state.tokens.delete(ANALYSIS);
  state.mintValues.push(REMINTED);
  const second=await sonarLocalMain(['ensure-project','--key','starci-next','--with-token'],{config});
  assert.equal(second.exitCode,0,JSON.stringify(second.report));
  assert.deepEqual([second.report.tokenCustody.via,second.report.tokenCustody.reminted,second.report.tokenCustody.name],['minted',true,projectTokenRef('starci-next')]);
  const generates=state.requests.filter(r=>r.path==='/api/user_tokens/generate');
  assert.equal(generates.length,2);
  assert.deepEqual([generates[1].form.type,generates[1].form.projectKey],['PROJECT_ANALYSIS_TOKEN','starci-next']);
  assert.equal(fs.readFileSync(path.join(custody.stack,`${projectTokenRef('starci-next')}.enc`),'utf8'),`ENC:${REMINTED}`);
  assert.equal(events.length,1);
  assert.deepEqual([events[0].kind,events[0].payload.role,events[0].payload.projectKey],['sonar-token-reminted','project','starci-next']);
  assertNoSecret(second.report,'ensure report');
  assertNoSecret(events,'remint event');
  const third=await sonarLocalMain(['ensure-project','--key','starci-next','--with-token'],{config});
  assert.equal(third.report.tokenCustody.via,'sops');
  assert.equal(state.requests.filter(r=>r.path==='/api/user_tokens/generate').length,2);
});

test('a declared or explicit token reference the server rejects is repaired in place', async t => {
  const root=temporary(t,'remint-ref');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  write(custody.stack,'runtime/files/custom-scan.key.enc','ENC:fake-stale-token-0005');
  state.mintValues.push(REMINTED);
  const events=[];
  const {report}=await sonarLocalMain(['ensure-project','--key','custom','--with-token','--token-ref','runtime/files/custom-scan.key'],
    {config:configFor(host,custody,{record:e=>events.push(e)})});
  assert.deepEqual([report.outcome,report.tokenCustody.reminted,report.tokenCustody.name],['ok',true,'runtime/files/custom-scan.key']);
  assert.equal(fs.readFileSync(path.join(custody.stack,'runtime/files/custom-scan.key.enc'),'utf8'),`ENC:${REMINTED}`);
  assert.ok(!fs.existsSync(path.join(custody.stack,`${projectTokenRef('custom')}.enc`)),'no second member beside the repaired one');
  assert.equal(events.length,1);
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
function fakeRepo(root,{scanner=true,lcov=true,specFile=false}={}){
  const repo=path.join(root,'product-repo');
  write(repo,'package.json',JSON.stringify({name:'product-repo',scripts:{'sonar:check':'node scanner.mjs'}}));
  write(repo,'sonar-project.properties','sonar.projectKey=product-repo\nsonar.host.url=https://sonar.example.invalid\nsonar.sources=src\nsonar.tests=src\nsonar.test.inclusions=**/*.spec.js\nsonar.javascript.lcov.reportPaths=coverage/lcov.info\n');
  write(repo,'.gitignore','coverage/\n');
  write(repo,'src/legacy.js',numbered(5,'legacy'));
  write(repo,'src/app.js',numbered(5,'app'));
  // The fake scanner echoes the token (the helper must scrub it) and writes report-task.txt into the
  // work directory it is told to use; it fails like the real one when the host was not overridden.
  write(repo,'scanner.mjs',scanner?`import fs from 'node:fs';import path from 'node:path';
const d=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('-D')).map(a=>a.slice(2).split(/=(.*)/s)));
fs.writeFileSync(path.join(process.cwd(),'..','scanner-defines.json'),JSON.stringify(d));
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
  if(specFile)write(repo,'src/app.spec.js',numbered(4,'spec'));
  if(lcov)freshLcov(repo);
  return repo;
}

test('--blob stores both the sanitized scanner log and the Sonar report', async t => {
  const root=temporary(t,'blob-scan');
  const {host}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const saved=[];
  const put=async (bytes,{mediaType})=>{
    saved.push({body:Buffer.from(bytes).toString(),mediaType});
    return {sha:String(saved.length).padStart(64,'0'),size:bytes.length,mediaType};
  };
  const {exitCode,report,blob}=await sonarLocalMain(['scan','--cwd',repo,'--wait','--blob'],
    {config:configFor(host,custody),put});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.scanner.logSha,String(1).padStart(64,'0'));
  assert.deepEqual(blob,{sha:String(2).padStart(64,'0'),redaction:'v1'});
  assert.equal(saved[0].mediaType,'text/plain');
  assert.equal(saved[1].mediaType,'application/json');
  assert.deepEqual(JSON.parse(saved[1].body),report);
  assertNoSecret(saved,'stored scan outputs');
});

test('scan runs the repository scanner against the local host, mints the project token and waits for the gate', async t => {
  const root=temporary(t,'scan');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const out=path.join(root,'evidence','sonar.json');
  const log=path.join(root,'evidence','sonar.txt');
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',repo,'--wait','--out',out,'--log',log],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.outcome,'pass');
  assert.equal(report.projectKey,'product-repo');
  assert.equal(report.project.created,true);
  assert.equal(report.custody.analysis.via,'minted');
  assert.equal(report.scanner.runner,'npm run sonar:check');
  assert.equal(report.ceTask.status,'SUCCESS');
  assert.equal(report.schema,'starci/sonar-local-scan@3');
  assert.equal(report.gate.name,'starci-new-code');
  assert.deepEqual([report.gate.coverageMinPercent,report.gate.duplicationMaxPercent,report.gate.blockingSeverities],[80,3,['BLOCKER','CRITICAL']]);
  assert.equal(report.qualityGate.outcome,'ok');
  assert.equal(report.scope,'slice');
  assert.equal(report.projectGate.status,'OK');
  assert.equal(report.projectGate.scope,'whole-project');
  assert.deepEqual(report.slice.changedFiles.sort(),['src/app.js','src/new.js']);
  assert.equal(report.slice.base,'HEAD');
  assert.deepEqual([report.slice.verdict,report.slice.newIssues.total,report.slice.newHotspots.total],['pass',0,0],'debt on unchanged lines is not the slice\'s');
  assert.deepEqual([report.slice.coverage.coverableLines,report.slice.coverage.percent,report.slice.coverage.threshold,report.slice.coverage.applied],[28,100,80,true]);
  assert.deepEqual([report.slice.duplication.changedLines,report.slice.duplication.duplicatedLines,report.slice.duplication.applied],[28,0,true]);
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

test('a first analysis keeps its no-condition note beside the slice note', async t => {
  const root=temporary(t,'first');
  const {host}=await fakeSonar(t,{firstAnalysis:true});
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.match(report.projectGate.note,/not a block: the slice verdict decides; no condition was evaluated \(a first analysis has no new code\)/);
});

test('a sops that hangs is stopped at the configured timeout and named in the custody reason', async t => {
  const root=temporary(t,'sops-hang');
  const {host}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const sops=write(root,'hanging-sops.mjs','setInterval(()=>{},1000);');
  const started=Date.now();
  const {report}=await sonarLocalMain(['status'],{config:configFor(host,{...custody,sops},{timeoutMs:500})});
  assert.ok(Date.now()-started<20000,'the hung sops does not block the check');
  assert.equal(report.custody.analysis.present,false);
  assert.match(report.custody.analysis.reason,/sops did not decrypt runtime\/files\/sonarqube-analysis-token\.txt\.enc within 500ms/);
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
  assert.equal(report.slice.newIssues.blocking,1);
  assert.deepEqual(report.slice.newIssues.items.map(i=>[i.path,i.line,i.severity]),[['src/app.js',12,'CRITICAL']]);
  assert.equal(report.slice.newHotspots.total,1);
  assert.equal(report.slice.coverage.percent,64.3);
  assert.deepEqual(report.slice.coverage.uncovered,[{path:'src/app.js',lines:[10,11,12,13,14,15,16,17,18,19]}]);
  assert.match(report.reason,/coverage on the slice's changed lines 64\.3% < 80%[\s\S]*1 open BLOCKER\/CRITICAL issue[\s\S]*1 security hotspot/);
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

test('a slice holding spec (UTS) and source (FIL) files is judged: issues are asked per qualifier and merged', async t => {
  const root=temporary(t,'qualifiers');
  const {host,state}=await fakeSonar(t,{tests:['src/app.spec.js'],
    issues:[{path:'src/app.js',line:12,severity:'CRITICAL',type:'BUG'},{path:'src/app.spec.js',line:2,severity:'MAJOR',type:'CODE_SMELL'}],
    hotspots:[{path:'src/app.spec.js',line:3}],
    sources:coveredSources({lines:{'src/app.js':30,'src/new.js':3,'src/legacy.js':5,'src/app.spec.js':4}})});
  const custody=fakeCustody(root);
  // inc-0fee2b8fb296: this slice's scan succeeded, then one mixed-qualifier issues query blocked it.
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root,{specFile:true}),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,1,JSON.stringify(report));
  assert.equal(report.outcome,'fail','the mixed slice reaches a verdict instead of a blocked exit 2');
  assert.deepEqual(report.slice.newIssues.items.map(i=>[i.path,i.line]).sort(),[['src/app.js',12],['src/app.spec.js',2]],'issues on source and spec lines merge');
  assert.equal(report.slice.newIssues.total,2);
  assert.equal(report.slice.newIssues.blocking,1,'only the critical one blocks; the major smell on the spec is listed');
  assert.equal(report.slice.newHotspots.total,1,'a hotspot on a changed spec line counts');
  assert.match(report.reason,/1 open BLOCKER\/CRITICAL issue[\s\S]*1 security hotspot/);
  const scoped=state.requests.filter(r=>r.path==='/api/issues/search'&&(r.query.components??r.query.componentKeys??'').includes(':'));
  assert.ok(scoped.length>=2,'the slice asked one query per qualifier group');
  for(const request of scoped){
    const qualifiers=new Set((request.query.components??request.query.componentKeys).split(',').map(c=>state.tests.includes(c.split(':').slice(1).join(':'))?'UTS':'FIL'));
    assert.equal(qualifiers.size,1,'every component list shares one qualifier');
  }
});

test('a clean slice mixing spec and source files passes, and a misread qualifier falls back to one key at a time', async t => {
  const root=temporary(t,'qualifiers-pass');
  const {host,state}=await fakeSonar(t,{tests:['src/app.spec.js'],
    sources:coveredSources({lines:{'src/app.js':30,'src/new.js':3,'src/legacy.js':5,'src/app.spec.js':4}})});
  const custody=fakeCustody(root);
  const pass=await sonarLocalMain(['scan','--cwd',fakeRepo(root,{specFile:true}),'--wait'],{config:configFor(host,custody)});
  assert.equal(pass.exitCode,0,JSON.stringify(pass.report));
  assert.deepEqual([pass.report.slice.verdict,pass.report.slice.newIssues.total,pass.report.slice.newHotspots.total],['pass',0,0]);

  // A file the project's test-path rule does not mark but the server calls a test (the scanner's own
  // detection): the mixed batch is refused once, then asked one key at a time.
  const root2=temporary(t,'qualifiers-fallback');
  const second=await fakeSonar(t,{tests:['src/util.test.js'],
    issues:[{path:'src/util.test.js',line:2,severity:'BLOCKER',type:'BUG'}],
    hotspots:[],
    sources:coveredSources({lines:{'src/app.js':30,'src/new.js':3,'src/legacy.js':5,'src/util.test.js':4}})});
  const repo=fakeRepo(root2);
  write(repo,'src/util.test.js',numbered(4,'utiltest'));
  const failed=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(second.host,custody)});
  assert.equal(failed.exitCode,1,JSON.stringify(failed.report));
  assert.deepEqual(failed.report.slice.newIssues.items.map(i=>[i.path,i.line]),[['src/util.test.js',2]]);
  const scoped=second.state.requests.filter(r=>r.path==='/api/issues/search'&&(r.query.components??r.query.componentKeys??'').includes(':'));
  assert.ok(scoped.some(r=>r.status===400),'the wrongly mixed batch was refused');
  const singles=scoped.filter(r=>r.status===200);
  assert.ok(singles.length>=3,'the batch was then asked one key at a time');
  for(const request of singles)assert.ok(!(request.query.components??request.query.componentKeys).includes(','),'one key per fallback query');
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
  assert.equal(submitted.report.outcome,'submitted',JSON.stringify(submitted.report));
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
    stack: {repository: source, root: .starcistacks, environment: dev, compose: .starcistacks/dev/infra/compose/sonarqube.yaml}
    projects: [{repository: product-repo, key: declared-key, name: Declared Name}]
    credentials:
      - {id: sonarqube-admin, env: SONAR_ADMIN_TOKEN, custody: {repository: source, path: .starcistacks/dev/runtime/files/sonarqube-admin-token.key}}
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
  // (a blocked scan carries unavailable: the settle records it as sonar-unavailable, never a pass)
  const root=temporary(t,'scan-down');
  const {host}=await fakeSonar(t,{up:false});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,2);
  assert.match(report.reason,/reports STARTING/);
  assert.equal(report.unavailable,true);
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
    stack: {repository: shop-infra, root: .starcistacks, environment: dev, compose: .starcistacks/dev/infra/compose/sonarqube.yaml, container: shop-sonarqube}
    auth: token
    projects:
      - {repository: shop-be, key: shop-backend, name: Shop Backend}
      - {repository: shop-fe, key: shop-frontend}
    credentials:
      - {id: sonarqube-admin, env: SONAR_ADMIN_TOKEN, custody: {repository: shop-infra, path: .starcistacks/dev/runtime/files/sonarqube-admin-token.key}}
      - {id: sonarqube-shop-frontend, env: SONAR_TOKEN, custody: {repository: shop-infra, path: .starcistacks/dev/runtime/files/sonarqube-shop-frontend-token.key}}
      - {id: sonarqube-analysis, env: SONAR_TOKEN, custody: {repository: shop-infra, path: .starcistacks/dev/runtime/files/sonarqube-analysis-token.txt}}
    ci: {wiring: optional-follow-up}
    ownerAction: none
`);
  const infra=path.join(root,'shop-infra','.starcistacks','dev');
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

test('a re-mint in a spec run without a recorder never writes machine.sqlite', async t => {
  const root=temporary(t,'remint-noledger');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  state.tokens.delete(ANALYSIS);
  const home=temporary(t,'remint-home');
  const saved={...process.env};
  t.after(()=>{for(const key of ['STARCI_TEST_MACHINE_FILE'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];});
  process.env.STARCI_TEST_MACHINE_FILE=path.join(home,'machine.sqlite');
  const config=configFor(host,custody);
  delete config.record;
  const {report}=await sonarLocalMain(['status'],{config});
  assert.equal(report.custody.analysis.reminted,true);
  assert.deepEqual(fs.readdirSync(home),[],'machine.sqlite was never opened');
});

// nivo-backend: a whole analysis spent 17-40 minutes (JS/TS sensor over ~5600 files) to judge a 1-5 file slice.
test('--isolate analyses only the slice in a throwaway project scanned with the admin token, then deletes it', async t => {
  const root=temporary(t,'isolate');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root,{lcov:false});
  // The slice's own coverage in a job-private directory, not the repository's coverage/lcov.info.
  const lcov=write(root,'cov-job/lcov.info',['SF:src/app.js','end_of_record',''].join('\n'));
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',repo,'--wait','--paths','src/app.js,src/new.js','--isolate','--lcov',lcov],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report));
  assert.equal(report.outcome,'pass');
  const sliceKey=isolatedKey('product-repo',['src/app.js','src/new.js']);
  assert.match(sliceKey,/^product-repo-slice-[0-9a-f]{10}$/);
  assert.deepEqual([report.projectKey,report.isolated.parentKey,report.isolated.deleted],[sliceKey,'product-repo',true]);
  assert.deepEqual(report.lcov,[lcov]);
  const defines=JSON.parse(fs.readFileSync(path.join(root,'scanner-defines.json'),'utf8'));
  assert.equal(defines['sonar.projectKey'],sliceKey);
  assert.equal(defines['sonar.inclusions'],'src/app.js,src/new.js');
  assert.equal(defines['sonar.test.inclusions'],'__starci_no_tests__/**','no scope file is a test, so no test is indexed');
  assert.equal(defines['sonar.javascript.lcov.reportPaths'],lcov);
  assert.ok(state.requests.some(r=>r.path==='/api/projects/create'&&r.form.project===sliceKey&&r.auth===ADMIN));
  assert.ok(state.requests.filter(r=>r.path==='/api/ce/task').every(r=>r.auth===ADMIN),'the slice project is read with the admin token');
  assert.ok(state.requests.some(r=>r.path==='/api/projects/delete'&&r.form.project===sliceKey));
  assert.equal(state.projects.has(sliceKey),false);
  assertNoSecret(report,'summary');
});

test('isolation defines: directories as dir/**, test patterns under each scope directory, a scope file only as what it is', t => {
  const root=temporary(t,'defines');
  write(root,'src/feature/a.ts','a');
  write(root,'src/feature/a.spec.ts','a');
  write(root,'src/other.spec.ts','a');
  const props={'sonar.tests':'src','sonar.test.inclusions':'**/*.spec.ts,**/*.e2e-spec.ts'};
  write(root,'.starciwork/kernel-strays/x/tsconfig.json','{}');
  assert.deepEqual(isolationDefines(root,props,['src/feature','src/other.spec.ts']),[
    '-Dsonar.inclusions=src/feature/**,src/other.spec.ts',
    '-Dsonar.test.inclusions=src/feature/**/*.spec.ts,src/feature/**/*.e2e-spec.ts,src/other.spec.ts']);
  assert.deepEqual(isolationDefines(root,{},['src/feature']),['-Dsonar.inclusions=src/feature/**']);
  assert.deepEqual(isolationDefines(root,{'sonar.tests':'src'},['src/feature']),['-Dsonar.inclusions=src/feature/**','-Dsonar.test.inclusions=src/feature/**']);
  // The repository's root tsconfig types the slice: no program per stray tsconfig.json; a declared one wins.
  write(root,'tsconfig.json','{}');
  assert.deepEqual(isolationDefines(root,{},['src/feature']),['-Dsonar.typescript.tsconfigPaths=tsconfig.json','-Dsonar.inclusions=src/feature/**']);
  assert.deepEqual(isolationDefines(root,{'sonar.typescript.tsconfigPaths':'tsconfig.build.json'},['src/feature']),['-Dsonar.inclusions=src/feature/**']);
});

test('--cwd takes a bare repository name as the directory beside or above the current one', t => {
  const root=temporary(t,'cwd');
  const repo=path.join(root,'starci-next');
  write(repo,'package.json','{}');
  write(root,'starci-next-fe/package.json','{}');
  assert.equal(resolveScanCwd('starci-next',repo),repo,'from inside the repository itself');
  assert.equal(resolveScanCwd('starci-next',path.join(repo,'src','deep')),repo);
  assert.equal(resolveScanCwd('starci-next-fe',repo),path.join(root,'starci-next-fe'),'a sibling repository');
  assert.equal(resolveScanCwd(repo,'C:/elsewhere'),repo,'an absolute root as given');
  assert.equal(resolveScanCwd('missing-repo',repo),path.join(repo,'missing-repo'),'nothing found: the value as a path');
});

test('a declaration is read only in the current form: no hostUrl/publicUrl/string host, no custody block, no .stacks root', t => {
  const root=temporary(t,'old-forms');
  const file=write(root,'old.yaml',`schema: starci/application-stacks@1
services:
  sonar:
    provider: sonarqube
    mode: local
    hostUrl: http://old-host:1
    publicUrl: https://old-public.example.invalid
    custody: {admin: {where: runtime/files/admin.key}, analysis: {path: runtime/files/analysis.key}}
    ci: {wiring: optional-follow-up}
    ownerAction: none
`);
  const declared=readSonarDeclaration(file);
  assert.deepEqual([declared.hostLocal,declared.hostPublic,declared.admin,declared.analysis],[null,null,null,null]);
  assert.equal(readSonarDeclaration(write(root,'string-host.yaml','schema: starci/application-stacks@1\nservices:\n  sonar: {provider: sonarqube, mode: local, host: "http://old-host:1", ci: {wiring: not-used}, ownerAction: none}\n')).hostLocal,null);
});

test('the scan makes the server gate carry knowledge/sonar-gate.yaml, selects it and is idempotent', async t => {
  const root=temporary(t,'gate-ensure');
  const {host,state}=await fakeSonar(t);
  const custody=fakeCustody(root);
  const repo=fakeRepo(root);
  const first=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.equal(first.report.qualityGate.outcome,'ok',JSON.stringify(first.report.qualityGate));
  const conditions=Object.fromEntries([...state.gateConditions.values()].map(c=>[c.metric,`${c.op} ${c.error}`]));
  assert.deepEqual(conditions,{new_coverage:'LT 80',new_duplicated_lines_density:'GT 3',new_security_hotspots_reviewed:'LT 100',new_blocker_violations:'GT 0',new_critical_violations:'GT 0',violations:'GT 0',duplicated_lines_density:'GT 3'});
  assert.equal(state.gateSelected.get('product-repo'),'starci-new-code');
  assert.equal(state.newCode.get('product-repo'),'NUMBER_OF_DAYS:30');
  const made=state.requests.filter(r=>/create|update_condition|delete_condition/.test(r.path)&&r.path.includes('qualitygates')).length;
  // a gate someone edited on the server is put back, an extra condition is dropped
  state.gateConditions.set('new_coverage',{id:'C-9',metric:'new_coverage',op:'LT',error:'50'});
  state.gateConditions.set('new_violations',{id:'C-10',metric:'new_violations',op:'GT',error:'0'});
  const again=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.equal(again.report.qualityGate.outcome,'ok');
  assert.deepEqual(again.report.qualityGate.changed.sort(),['-new_violations','new_coverage']);
  assert.equal(state.gateConditions.get('new_coverage').error,'80');
  assert.ok(!state.gateConditions.has('new_violations'));
  const third=await sonarLocalMain(['scan','--cwd',repo,'--wait'],{config:configFor(host,custody)});
  assert.deepEqual(third.report.qualityGate.changed,[],'a matching gate is left as it is');
  assert.ok(made>0);
});

test('duplication on the changed lines fails the slice; lesser issues are listed and never block', async t => {
  const root=temporary(t,'gate-dup');
  const {host}=await fakeSonar(t,{duplications:{'src/app.js':[{from:10,size:12}]},issues:[{path:'src/app.js',line:12,severity:'MAJOR',type:'CODE_SMELL'}]});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,1,JSON.stringify(report.slice));
  assert.deepEqual([report.slice.duplication.duplicatedLines,report.slice.duplication.percent,report.slice.duplication.threshold],[12,42.9,3]);
  assert.deepEqual(report.slice.duplication.files,[{path:'src/app.js',lines:[10,11,12,13,14,15,16,17,18,19,20,21]}]);
  assert.match(report.reason,/duplication on the slice's changed lines 42\.9% > 3%/);
  assert.doesNotMatch(report.reason,/issue/,'the major smell is not a failure');
  assert.deepEqual([report.slice.newIssues.total,report.slice.newIssues.blocking,report.slice.newIssues.notBlocking],[1,0,1]);
  assert.equal(report.slice.newIssues.items[0].blocking,false);
});

test('a duplicated block outside the changed lines or under the small-change floor is not held', async t => {
  const root=temporary(t,'gate-dup-ok');
  const {host}=await fakeSonar(t,{duplications:{'src/legacy.js':[{from:1,size:5}]}});
  const custody=fakeCustody(root);
  const {exitCode,report}=await sonarLocalMain(['scan','--cwd',fakeRepo(root),'--wait'],{config:configFor(host,custody)});
  assert.equal(exitCode,0,JSON.stringify(report.slice));
  assert.equal(report.slice.duplication.duplicatedLines,0);
  const small=await fakeSonar(t,{duplications:{'src/new.js':[{from:1,size:3}]}});
  const smallRun=await sonarLocalMain(['scan','--cwd',fakeRepo(temporary(t,'gate-dup-small')),'--wait','--paths','src/new.js'],{config:configFor(small.host,custody)});
  assert.equal(smallRun.exitCode,0);
  assert.deepEqual([smallRun.report.slice.duplication.applied,smallRun.report.slice.duplication.duplicatedLines],[false,3]);
});

test('a slice its attempt did not change (already committed) is judged from the branch delta, not left SLICE_EMPTY', t => {
  const root=temporary(t,'slice-fallback');
  const repo=fakeRepo(root);
  gitIn(repo,'checkout','-q','-b','wf/x');
  gitIn(repo,'add','-A');
  gitIn(repo,'commit','-q','-m','an earlier attempt committed the slice');
  const slice=sliceChanges(repo,{base:'HEAD',paths:'src'});
  assert.equal(slice.ok,true);
  assert.deepEqual(slice.files.map(f=>f.path).sort(),['src/app.js','src/new.js']);
  assert.equal(slice.baseFallback.merged,'main');
  assert.equal(slice.baseCommit,gitIn(repo,'rev-parse','main'));
  assert.equal(slice.base,'HEAD','the requested base is kept beside the fallback');
  // no branch delta at all stays empty: nothing to judge, and the scan says so
  const bare=fakeRepo(temporary(t,'slice-fallback-none'));
  gitIn(bare,'add','-A');
  gitIn(bare,'commit','-q','-m','same');
  assert.equal(sliceChanges(bare,{base:'HEAD',paths:'src'}).files.length,0);
});
