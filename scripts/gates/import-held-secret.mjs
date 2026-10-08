#!/usr/bin/env node
// starci runtime import-held-secret --member <old path> [--rev <rev>] [--json]
//
// The owner's one-time step per sealed member the public runtime repository once tracked (HELD_MEMBERS of sonar-host-secrets.mjs):
// the member's ciphertext is read from git history (`git show <rev>:<path>`; without --rev, the parent of the commit that deleted
// it), decrypted with the owner's own age identity through the sops call owner, and appended to the untracked .claude/secret.env as
// `NAME=value`. The value is never echoed, printed, put on argv or kept in a file other than secret.env; an existing NAME is never
// overwritten. The ports (history reader, decryptor) are parameters, so the spec runs it with fakes.
import fs from 'node:fs';
import path from 'node:path';
import {isMain} from '../lib/is-main.mjs';
import {arg,flag} from '../lib/cli-arg.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {SECRET_ENV_FILE,credentialPresent,readDotenv} from '../../engine/secrets.mjs';
import {log} from '../api/git/log.mjs';
import {show} from '../api/git/show.mjs';
import {tempPath} from '../api/fs/temp-path.mjs';
import {runtimeSecretEnv,verifiedRuntimeMain} from './runtime-host.mjs';
import {decryptMember} from './sonar-ext-custody.mjs';
import {HELD_MEMBERS} from './sonar-host-secrets.mjs';

/** A refusal: code 'held-secret-import-refused' (modules/kernel/failure-codes.yaml), `cause` says which. */
const refuse=(cause,message,extra={})=>({outcome:'refused',code:'held-secret-import-refused',cause,message,...extra});

/** The member's ciphertext at `rev` in the runtime repository, or {error}; without a rev, at the parent of the commit that deleted it. */
export function readMemberFromHistory({cwd,member,rev=null}){
  let at=rev;
  if(!at){
    const deleted=log(['--diff-filter=D','-1','--format=%H','--',member],{cwd});
    const hash=String(deleted.stdout??'').trim();
    if(deleted.status!==0||!hash)return {error:`no commit that deleted ${member} is in this history: name the revision that still holds it with --rev`};
    at=`${hash}^`;
  }
  const shown=show([`${at}:${member}`],{cwd});
  if(shown.status!==0||!String(shown.stdout??'').trim())return {error:`${member} is not in ${at}: ${String(shown.stderr??'').trim().split(/\r?\n/).slice(-1)[0]??'empty'}`};
  return {ciphertext:String(shown.stdout),rev:at};
}

/** Decrypt a ciphertext with the owner's identity through the sops call owner (a temp file the tool reads, removed at once); {value} or {error}. */
export function decryptCiphertext(ciphertext,{env,sops=null,identity=null,timeoutMs=20000}={}){
  const file=tempPath(`starci-held-secret-${process.pid}-${Date.now().toString(36)}.enc`);
  try{
    fs.writeFileSync(file,ciphertext,{mode:0o600});
    const result=decryptMember({env,sops,identity,timeoutMs},file);
    if(result.error?.identityRefusal)return {error:result.error.message};
    const cause=result.error?.code??'';
    if(result.status!==0)return {error:`sops could not decrypt the member (exit ${result.status??'none'} ${cause})`.replace(' )',')')};
    return {value:String(result.stdout??'').trim()};
  }finally{
    fs.rmSync(file,{force:true});
  }
}

const endsWithNewline=file=>{
  const size=fs.statSync(file).size;
  if(size===0)return true;
  const fd=fs.openSync(file,'r');
  try{
    const last=Buffer.alloc(1);
    fs.readSync(fd,last,0,1,size-1);
    return last[0]===0x0a;
  }finally{
    fs.closeSync(fd);
  }
};

/** Append \`NAME=value\` to the dotenv file (created 0600 when absent), after a newline when the file does not end with one. */
function appendVariable(file,name,value){
  const prefix=fs.existsSync(file)&&!endsWithNewline(file)?'\n':'';
  fs.appendFileSync(file,`${prefix}${name}=${value}\n`,{mode:0o600});
}

/**
 * Move one held member's value into secret.env. `readMember(member)` returns {ciphertext,rev} or {error}; `decryptMember(ciphertext)`
 * returns {value} or {error}. Returns {outcome:'imported', variable, member, rev, reader} or a refusal; the value appears in neither.
 */
export function importHeldSecret({member,secretFile,readMember,decryptCipher}){
  const row=HELD_MEMBERS.find(entry=>entry.path===member);
  if(!row)return refuse('unknown-member',`${member} is not a held member; the members are ${HELD_MEMBERS.map(entry=>entry.path).join(', ')}`);
  if(!row.variable)return refuse('retired-member',`${member} is ${row.reader}; nothing is imported`,{member});
  if(Object.hasOwn(readDotenv(secretFile),row.variable))return refuse('variable-exists',`${row.variable} is already in secret.env: it is not overwritten; edit the file by hand to replace it`,{member,variable:row.variable});
  const history=readMember(member);
  if(history.error)return refuse('history-unreadable',history.error,{member,variable:row.variable});
  const opened=decryptCipher(history.ciphertext);
  if(opened.error)return refuse('undecryptable',opened.error,{member,variable:row.variable,rev:history.rev});
  if(!credentialPresent(opened.value)||/[\r\n]/u.test(opened.value))return refuse('value-unusable',`the decrypted value of ${member} is empty or spans several lines, so it is not a one-line variable`,{member,variable:row.variable,rev:history.rev});
  appendVariable(secretFile,row.variable,opened.value);
  return {outcome:'imported',member,variable:row.variable,rev:history.rev,reader:row.reader};
}

const text=report=>report.outcome==='imported'
  ?`${report.variable} appended to secret.env from ${report.member} at ${report.rev}; read by ${report.reader}`
  :`refused (${report.cause}): ${report.message}`;

async function main(argv){
  const member=arg(argv,'member');
  if(!member){process.stderr.write('usage: starci runtime import-held-secret --member <old path> [--rev <rev>] [--json]\n');return 2;}
  const env=runtimeSecretEnv(process.env,skillRoot);
  const secretFile=path.join(verifiedRuntimeMain(skillRoot,process.env),SECRET_ENV_FILE);
  const report=importHeldSecret({member,secretFile,
    readMember:name=>readMemberFromHistory({cwd:skillRoot,member:name,rev:arg(argv,'rev')}),
    decryptCipher:ciphertext=>decryptCiphertext(ciphertext,{env})});
  process.stdout.write(flag(argv,'json')?`${JSON.stringify(report,null,2)}\n`:`${text(report)}\n`);
  return report.outcome==='imported'?0:1;
}

if(isMain(import.meta.url))process.exitCode=await main(process.argv.slice(2));
