#!/usr/bin/env node
// Move historical job artifacts and kernel custody into the v2 evidence index.
// Dry-run is read-only. Apply requires an operator-made SQLite backup and the
// evidence schema migration from ev-store. Source files are never removed here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectLedger, openLedger, ledgerFileFor, hasLedgerTable, EVIDENCE_SCHEMA_MIGRATE_ENV} from '../../engine/ledger-db.mjs';
import {putBlob, getBlob, blobPath} from '../lib/artifact-store.mjs';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replace(/\\/g, '/');
const EVIDENCE = '.starciwork/kernel-evidence/';
const ROLE = new Set(['check-output','check-stdout','check-stderr','patch','report-attachment','screenshot','video','dom','render','redline','proof','log']);
const extType = new Map([['.json','application/json'],['.jsonl','application/x-ndjson'],['.txt','text/plain'],['.log','text/plain'],['.md','text/markdown'],['.yaml','application/yaml'],['.yml','application/yaml'],['.patch','text/x-diff'],['.diff','text/x-diff'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.svg','image/svg+xml'],['.webm','video/webm'],['.mp4','video/mp4'],['.html','text/html'],['.zip','application/zip']]);
const mediaType = file => extType.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream';
const roleOf = (file, kind) => {
  const p=slash(file).toLowerCase();
  if (kind==='patch'||/\.(patch|diff)$/.test(p)) return 'patch';
  if (/\.webm$|\.mp4$/.test(p)) return 'video';
  if (/\.(png|jpe?g|webp)$/.test(p)) return 'screenshot';
  if (/\.html?$/.test(p) && /dom|snapshot/.test(p)) return 'dom';
  if (/stderr/.test(p)) return 'check-stderr';
  if (/stdout/.test(p)) return 'check-stdout';
  if (/check|scan|lint|test|coverage|verify/.test(p)) return 'check-output';
  if (/report(?:-\d+)?\.json$/.test(p)||kind==='report') return 'report-attachment';
  if (/\.log$|\.txt$|\.jsonl$/.test(p)) return 'log';
  return 'proof';
};
const filesUnder = root => {
  if (!fs.existsSync(root)) return [];
  const out=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.isFile())out.push(file);
    else throw new Error(`unsupported evidence entry: ${file}`);
  }};
  walk(root);
  return out.sort((a,b)=>a.localeCompare(b));
};
const isWorkProof=(rel,tracked)=>/^\.starciwork\/features\/.+\/E(?:-[^/]+)?\//.test(rel)&&tracked.has(rel);
const logicalName=(rel,wf,job)=>{
  const prefix=`${EVIDENCE}${wf}/jobs/${job}/`;
  return rel.startsWith(prefix)?rel.slice(prefix.length):rel;
};
const recordBlob=(db,sha,bytes,type,now,stored)=>{
  const uri=stored?blobPath(sha):null;
  const http=stored?`/api/blob/${sha}`:null;
  db.prepare('INSERT OR IGNORE INTO blobs(sha256,bytes,media_type,file_uri,http_path,created_at) VALUES(?,?,?,?,?,?)').run(sha,bytes,type,uri,http,now);
  if(stored)db.prepare('UPDATE blobs SET file_uri=?,http_path=? WHERE sha256=? AND (file_uri IS NULL OR http_path IS NULL)').run(uri,http,sha);
  const row=db.prepare('SELECT bytes FROM blobs WHERE sha256=?').get(sha);
  if(Number(row.bytes)!==bytes)throw new Error(`blob registry size differs for ${sha}`);
};
const rowFor=(db,wf,job,attempt,name)=>db.prepare('SELECT artifact_id,sha256,bytes,storage,repo_path FROM job_artifacts_v2 WHERE workflow_id=? AND job_id=? AND attempt=? AND name=?').get(wf,job,attempt,name);
const verifyBackup=(file,backup,ledgerId)=>{
  if(!backup||!fs.existsSync(backup)||path.resolve(backup)===path.resolve(file))throw new Error('apply requires --backup pointing to a separate SQLite ledger backup');
  let copy;
  try{
    copy=inspectLedger({file:path.resolve(backup)});
    if(copy.ledgerId!==ledgerId)throw new Error('backup ledger identity differs');
    if(copy.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('backup SQLite integrity check failed');
  }finally{copy?.close();}
};
const insertArtifact=(db,a)=>{
  const old=rowFor(db,a.workflow_id,a.job_id,a.attempt,a.name);
  if(old){
    if(old.sha256!==a.sha256||Number(old.bytes)!==a.bytes||old.storage!==a.storage||old.repo_path!==a.repo_path)
      throw new Error(`existing v2 artifact differs: ${a.workflow_id}/${a.job_id}/${a.name}`);
    return {id:old.artifact_id,added:false};
  }
  const r=db.prepare(`INSERT INTO job_artifacts_v2(workflow_id,job_id,op_id,attempt,cut,role,kind,subkind,name,storage,sha256,bytes,media_type,repo_path,label,origin,head_sha,landed_sha,base_sha,created_at)
    VALUES(@workflow_id,@job_id,@op_id,@attempt,@cut,@role,@kind,@subkind,@name,@storage,@sha256,@bytes,@media_type,@repo_path,@label,@origin,@head_sha,@landed_sha,@base_sha,@created_at)`).run(a);
  return {id:Number(r.lastInsertRowid),added:true};
};
const reportMatch=(db,rel,raw)=>{
  const match=/\/report-(\d+)\.json$/.exec(rel);
  if(match){const row=db.prepare('SELECT report_json FROM reports WHERE report_id=?').get(Number(match[1]));
    return row ? (JSON.stringify(JSON.parse(row.report_json))===JSON.stringify(raw)?'exact':'different') : 'missing';}
  if(!/\/report\.json$/.test(rel))return null;
  const parts=rel.slice(EVIDENCE.length).split('/');
  if(parts[1]!=='jobs'||!parts[2])return 'missing';
  const row=db.prepare('SELECT r.report_json FROM reports r JOIN jobs j ON j.workflow_id=r.workflow_id AND j.op_id=r.op_id AND j.attempt=r.attempt WHERE j.job_id=? ORDER BY r.report_id DESC LIMIT 1').get(parts[2]);
  if(!row)return 'missing';
  const filed=JSON.parse(row.report_json);
  return Object.entries(raw).every(([key,value])=>JSON.stringify(filed[key])===JSON.stringify(value))?'subset':'different';
};

/** Backfill one ledger. Apply is idempotent; a changed previously indexed file is an error. */
export function migrateEvidence({repo,apply=false,backup=null,now=Date.now()}={}){
  if(!repo)throw new Error('repo is required');
  const root=path.resolve(repo), file=ledgerFileFor(root), evidence=path.join(root,'.starciwork','kernel-evidence');
  if(!fs.existsSync(file))throw new Error(`ledger missing: ${file}`);
  if(apply){const read=inspectLedger({file});try{verifyBackup(file,backup,read.ledgerId);}finally{read.close();}}
  let ledger;
  if(apply){
    const previous=process.env[EVIDENCE_SCHEMA_MIGRATE_ENV];process.env[EVIDENCE_SCHEMA_MIGRATE_ENV]='1';
    try{ledger=openLedger({file});}finally{if(previous===undefined)delete process.env[EVIDENCE_SCHEMA_MIGRATE_ENV];else process.env[EVIDENCE_SCHEMA_MIGRATE_ENV]=previous;}
  }else ledger=inspectLedger({file});
  const db=ledger.db;
  const result={repo:root,mode:apply?'apply':'dry-run',files:0,artifactCandidates:0,v1:0,added:0,existing:0,orphanFiles:0,checks:0,proofs:0,proofsSkippedDrift:0,reports:{exact:0,subset:0,different:0,missing:0},sourceDrift:{count:0,samples:[]},bytes:0,missing:[]};
  try{
    if(apply)for(const table of ['blobs','job_artifacts_v2','check_runs','artifact_proofs_v2'])if(!hasLedgerTable(db,table))throw new Error(`ev-store migration missing ${table}`);
    const tracked=new Set((spawnSync('git',['-C',root,'ls-files','-z','--','.starciwork/features'],{encoding:'utf8',windowsHide:true}).stdout??'').split('\0').filter(Boolean).map(slash));
    const workflows=new Set(db.prepare('SELECT workflow_id FROM workflows').all().map(r=>r.workflow_id));
    const jobs=new Map(db.prepare('SELECT job_id,workflow_id,op_id,attempt FROM jobs').all().map(r=>[r.job_id,r]));
    const old=hasLedgerTable(db,'job_artifacts')?db.prepare('SELECT * FROM job_artifacts ORDER BY workflow_id,job_id,path').all():[];
    const source=[],covered=new Set();
    for(const row of old){
      result.v1++;
      const rel=slash(row.path), abs=path.join(root,...rel.split('/'));
      if(!fs.existsSync(abs)){result.missing.push(rel);continue;}
      source.push({rel,row,abs});covered.add(rel);
    }
    for(const abs of filesUnder(evidence)){
      const rel=slash(path.relative(root,abs));
      if(!covered.has(rel))source.push({rel,row:null,abs});
    }
    if(result.missing.length)throw new Error(`${result.missing.length} v1 artifact files missing`);
    const pending=[],seenFiles=new Set(),drifted=new Set();
    for(const {rel,row,abs} of source){
      const bytes=fs.readFileSync(abs),sha=sha256(bytes),type=mediaType(abs),proof=Boolean(row&&isWorkProof(rel,tracked));
      if(row&&(row.sha256!==sha||Number(row.bytes)!==bytes.length)){
        drifted.add(`${row.workflow_id}\0${row.job_id}\0${rel}`);
        result.sourceDrift.count++;
        if(result.sourceDrift.samples.length<20)result.sourceDrift.samples.push({path:rel,jobId:row.job_id,storedSha:row.sha256,actualSha:sha,storedBytes:row.bytes,actualBytes:bytes.length});
      }
      result.artifactCandidates++;
      const firstSeen=!seenFiles.has(rel);
      if(firstSeen){seenFiles.add(rel);result.files++;result.bytes+=bytes.length;}
      let wf=row?.workflow_id,job=row?.job_id,attempt=row?.attempt??1,op=row?.op_id??null;
      if(!row){
        const parts=rel.slice(EVIDENCE.length).split('/');wf=parts[0];
        if(parts[1]==='jobs'&&parts[2]){job=parts[2];const known=jobs.get(job);attempt=known?.attempt??1;op=known?.op_id??null;}
        else job='legacy-kernel-evidence';
      }
      if(!workflows.has(wf)){result.orphanFiles++;pending.push({rel,abs,bytes,sha,type,artifact:null});continue;}
      const name=logicalName(rel,wf,job),kind=row?.kind??'file',role=roleOf(rel,kind);
      if(!ROLE.has(role))throw new Error(`invalid role ${role}`);
      const artifact={workflow_id:wf,job_id:job,op_id:op,attempt,cut:row?.cut??null,role,kind,subkind:row?.subkind??null,name,
        storage:proof?'work-proof':'blob',sha256:sha,bytes:bytes.length,media_type:row?.mime??type,repo_path:proof?rel:null,
        label:row?.label??null,origin:'backfill',head_sha:row?.head_sha??null,landed_sha:row?.landed_sha??null,base_sha:row?.base_sha??null,created_at:row?.created_at??now};
      pending.push({rel,abs,bytes,sha,type,artifact});
      if(/\/report(?:-\d+)?\.json$/.test(rel)&&rel.startsWith(EVIDENCE)&&firstSeen){
        let match='different';try{match=reportMatch(db,rel,JSON.parse(bytes.toString('utf8')));}catch{}
        if(match)result.reports[match]++;
      }
    }
    if(!apply)return result;
    // Blob publication is immutable and may precede the single ledger transaction.
    for(const p of pending)if(p.artifact?.storage==='blob'||!p.artifact)putBlob(p.bytes,{mediaType:p.type});
    ledger.transaction(()=>{
      for(const p of pending){
        recordBlob(db,p.sha,p.bytes.length,p.type,now,!p.artifact||p.artifact.storage==='blob');
        if(!p.artifact)continue;
        const inserted=insertArtifact(db,p.artifact);
        if(inserted.added)result.added++;else result.existing++;
        if(p.artifact.storage==='blob'){
          const check=getBlob(p.sha);if(check.length!==p.bytes.length||sha256(check)!==p.sha)throw new Error(`blob verification failed: ${p.rel}`);
        }
      }
      if(hasLedgerTable(db,'artifact_proofs'))for(const proof of db.prepare('SELECT * FROM artifact_proofs').all()){
        const rel=slash(proof.path),v1=old.find(row=>row.workflow_id===proof.workflow_id&&row.job_id===proof.job_id&&slash(row.path)===rel);if(!v1)continue;
        if(drifted.has(`${v1.workflow_id}\0${v1.job_id}\0${rel}`)){result.proofsSkippedDrift++;continue;}
        const id=rowFor(db,v1.workflow_id,v1.job_id,v1.attempt??1,logicalName(rel,v1.workflow_id,v1.job_id))?.artifact_id;
        if(!id)throw new Error(`proof artifact missing: ${rel}`);
        const r=db.prepare('INSERT OR IGNORE INTO artifact_proofs_v2(artifact_id,claims_json,code_sha,deps_json,created_at) VALUES(?,?,?,?,?)').run(id,proof.claims_json,proof.code_sha,proof.deps_json,proof.created_at);
        result.proofs+=r.changes;
      }
      if(hasLedgerTable(db,'checks'))for(const group of db.prepare('SELECT * FROM checks').all()){
        let parsed;try{parsed=JSON.parse(group.checks_json);}catch{continue;}
        const entries=Array.isArray(parsed)?parsed:Array.isArray(parsed?.checks)?parsed.checks:[];
        const job=db.prepare('SELECT job_id FROM jobs WHERE workflow_id=? AND op_id=? AND attempt=? ORDER BY created_at DESC LIMIT 1').get(group.workflow_id,group.op_id,group.attempt)?.job_id??`legacy-checks:${group.op_id}:${group.attempt}`;
        for(const [index,check] of entries.entries()){
          const name=String(check.name??`check-${index+1}`),exit=Number.isInteger(check.exitCode)?check.exitCode:null;
          const present=db.prepare('SELECT 1 FROM check_runs WHERE workflow_id=? AND job_id=? AND attempt=? AND name=? AND runner=? AND command IS ? LIMIT 1').get(group.workflow_id,job,group.attempt,name,'kernel',check.command??null);
          if(present)continue;
          db.prepare(`INSERT INTO check_runs(workflow_id,job_id,op_id,attempt,name,phase,runner,command,cwd,exit_code,status,started_at,finished_at,stdout_sha,stderr_sha,output_sha,summary_json,created_at)
            VALUES(?,?,?,?,?,'verify','kernel',?,?,?,?,?,NULL,NULL,NULL,NULL,?,?)`).run(group.workflow_id,job,group.op_id,group.attempt,name,check.command??null,null,exit,exit===null?'unavailable':exit===0?'pass':'fail',null,
              JSON.stringify({legacyEvidence:check.evidence??null}),group.created_at);
          result.checks++;
        }
      }
    });
    return result;
  }finally{ledger.close();}
}

// Zip verification reads every entry back and compares it with its source file.
// The archive is published only after all entries pass; the ledger is marked only
// after the published zip passes a second verification in the same process.
const ARCHIVER=String.raw`
import hashlib,json,os,sys,zipfile
from pathlib import Path
root=Path(sys.argv[1]); target=Path(sys.argv[2]); mode=sys.argv[3]
files=sorted(p for p in root.rglob('*') if p.is_file()) if root.exists() else []
entries={f'kernel-evidence/{p.relative_to(root).as_posix()}':p for p in files}
if mode=='write':
 target.parent.mkdir(parents=True,exist_ok=True)
 temp=target.with_name(target.name+f'.{os.getpid()}.tmp')
 try:
  with zipfile.ZipFile(temp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
   for name,p in entries.items(): z.write(p,name)
  with zipfile.ZipFile(temp,'r') as z:
   if set(z.namelist())!=set(entries): raise RuntimeError('archive entry inventory differs')
   for name,p in entries.items():
    data=p.read_bytes(); archived=z.read(name)
    if archived!=data: raise RuntimeError(f'archive mismatch: {name}')
  os.replace(temp,target)
 finally:
  if temp.exists(): temp.unlink()
with zipfile.ZipFile(target,'r') as z:
 if set(z.namelist())!=set(entries): raise RuntimeError('published archive inventory differs')
 out=[]
 for name,p in entries.items():
  data=p.read_bytes(); archived=z.read(name)
  if archived!=data: raise RuntimeError(f'published archive mismatch: {name}')
  out.append({'entry':name,'sha':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
print(json.dumps({'entries':out,'archive':str(target),'size':target.stat().st_size}))
`;

/** Create or verify an archive, then mark only its verified blob bytes archived. */
export function archiveEvidence({repo,archive,backup=null,verifyOnly=false,now=Date.now()}={}){
  if(!repo||!archive)throw new Error('repo and archive are required');
  const root=path.resolve(repo), target=path.resolve(archive);
  const read=inspectLedger({file:ledgerFileFor(root)});
  try{verifyBackup(ledgerFileFor(root),backup,read.ledgerId);}finally{read.close();}
  const command=spawnSync('python',['-c',ARCHIVER,path.join(root,'.starciwork','kernel-evidence'),target,verifyOnly?'verify':'write'],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
  if(command.status!==0)throw new Error(`zip ${verifyOnly?'verification':'creation'} failed: ${command.stderr||command.stdout}`);
  const receipt=JSON.parse(command.stdout);
  const ledger=openLedger({file:ledgerFileFor(root)});
  try{
    ledger.transaction(db=>{
      for(const item of receipt.entries){
        const row=db.prepare('SELECT bytes,file_uri FROM blobs WHERE sha256=?').get(item.sha);
        if(!row||Number(row.bytes)!==item.bytes||!row.file_uri)throw new Error(`archive blob not indexed: ${item.entry}`);
        if(sha256(getBlob(item.sha))!==item.sha)throw new Error(`archive blob failed hash verification: ${item.entry}`);
        db.prepare('UPDATE blobs SET archived_at=COALESCE(archived_at,?),archive_ref=COALESCE(archive_ref,?) WHERE sha256=?').run(now,`${target}#${item.entry}`,item.sha);
      }
    });
  }finally{ledger.close();}
  return {archive:target,files:receipt.entries.length,bytes:receipt.entries.reduce((n,e)=>n+e.bytes,0),zipBytes:receipt.size};
}

const usage='node scripts/migrate/evidence-to-blobs.mjs --repo <repo> [--dry-run|--apply --backup <sqlite-backup> [--archive <zip>]] [--verify-archive <zip> --backup <sqlite-backup>] [--json]';
function main(){
  const args={apply:false,repo:null,backup:null,json:false,archive:null,verifyArchive:null};
  for(let i=2;i<process.argv.length;i++){
    const x=process.argv[i];if(x==='--repo')args.repo=process.argv[++i];else if(x==='--backup')args.backup=process.argv[++i];
    else if(x==='--apply')args.apply=true;else if(x==='--dry-run')args.apply=false;else if(x==='--json')args.json=true;
    else if(x==='--archive')args.archive=process.argv[++i];else if(x==='--verify-archive')args.verifyArchive=process.argv[++i];
    else {console.error(usage);process.exit(2);}
  }
  if(!args.repo){console.error(usage);process.exit(2);}
  try{
    const out=args.verifyArchive?{archive:archiveEvidence({repo:args.repo,archive:args.verifyArchive,backup:args.backup,verifyOnly:true})}:migrateEvidence(args);
    if(args.archive){if(!args.apply)throw new Error('--archive requires --apply');out.archive=archiveEvidence({repo:args.repo,archive:args.archive,backup:args.backup});}
    console.log(JSON.stringify(out,null,args.json?2:0));
  }
  catch(error){console.error(JSON.stringify({ok:false,error:String(error?.message??error)}));process.exit(1);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
