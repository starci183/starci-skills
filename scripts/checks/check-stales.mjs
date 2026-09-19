#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {scanCanonicalWork,SourceStalenessInputError} from '../../kernel/source-staleness.mjs';

const HELP=`Usage: node scripts/checks/check-stales.mjs --work <canonical-work-root> --repo <id>=<git-root> [--repo ...] [--target <work-node-id> ...]

Reads canonical Work, its current semantic input digests, sourceRefs and source-identity@1 proof.
Prints deterministic JSON. Exit 0 is clean, 1 reports stale/missing/unverifiable inputs,
2 means invalid arguments or unreadable declared inputs, and 3 is an unexpected scanner failure.`;

function argsOf(argv){
  const out={workRoot:null,repositories:{},targets:[]};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(key==='--help'||key==='-h')return {help:true};
    const value=argv[++i];if(value===undefined)throw new SourceStalenessInputError(`Missing value for ${key}`);
    if(key==='--work'){if(out.workRoot!==null)throw new SourceStalenessInputError('Use --work exactly once');out.workRoot=value;continue;}
    if(key==='--target'){out.targets.push(value);continue;}
    if(key==='--repo'){
      const split=value.indexOf('=');if(split<1||split===value.length-1)throw new SourceStalenessInputError('--repo must be <id>=<git-root>');
      const id=value.slice(0,split),root=value.slice(split+1);if(Object.hasOwn(out.repositories,id))throw new SourceStalenessInputError(`Duplicate repository mapping ${id}`);out.repositories[id]=path.resolve(root);continue;
    }
    throw new SourceStalenessInputError(`Unknown argument ${key}`);
  }
  if(out.workRoot===null)throw new SourceStalenessInputError('--work is required');out.workRoot=path.resolve(out.workRoot);return out;
}

/** Stable programmatic entry used by the public CLI. It never writes or calls process.exit. */
export function checkStalesMain(argv){
  try{
    const input=argsOf([...argv]);if(input.help)return {exitCode:0,report:{schema:'starci/source-staleness-help@1',help:HELP}};
    const report=scanCanonicalWork(input);return {exitCode:report.clean?0:1,report};
  }catch(error){
    if(error instanceof SourceStalenessInputError)return {exitCode:2,report:{schema:'starci/source-staleness-error@1',code:error.code,message:error.message}};
    return {exitCode:3,report:{schema:'starci/source-staleness-error@1',code:'SCANNER_FAILURE',message:'The scanner failed unexpectedly without changing any input.'}};
  }
}

function print(result){
  const body=result.report.schema==='starci/source-staleness-help@1'?`${result.report.help}\n`:`${JSON.stringify(result.report,null,2)}\n`;
  process.stdout.write(body);process.exitCode=result.exitCode;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)print(checkStalesMain(process.argv.slice(2)));
