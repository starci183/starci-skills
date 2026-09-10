#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
const command=args[0]??'help';
if (['init','update','doctor','version','--version','help','--help','-h'].includes(command)) {
  const forwarded=command==='--version'?['version']:args;
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./starci-skills.mjs',import.meta.url)),...forwarded],{stdio:'inherit',windowsHide:true});
  process.exitCode=result.status??1;
} else if(command==='workspace') {
  if(args[1]!=='init') {console.error('starci: use workspace init <work-root> --id <workspace-id>');process.exitCode=1;}
  else {const {main}=await import('../.dist/cli/main.mjs');process.exitCode=await main(args.slice(1));}
} else {
  const {main}=await import('../.dist/cli/main.mjs');
  process.exitCode=await main(args);
}
