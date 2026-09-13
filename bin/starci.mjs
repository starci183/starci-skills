#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/**
 * The one command line of the workflow kernel. These commands belong to the launcher in
 * `hosts/orca/launch.mjs`; this entry forwards argv to it unchanged so a host never has to name a
 * module path, and the launcher's own direct-run entry keeps working exactly as before.
 */
const LAUNCHER_COMMANDS=['workflow-goal','workflow-approve','workflow-answer','workflow-run','workflow-status',
  'workflow-list','workflow-stop','workflow-lane-close','workflow-supervise',
  'start-op','settle','sweep','notify','report','wait','verify'];

const args=process.argv.slice(2);
const command=args[0]??'help';
if (LAUNCHER_COMMANDS.includes(command)) {
  const {main}=await import('../.dist/hosts/orca/launch.mjs');
  try {
    // A text view prints as text; everything else is the record it always was.
    const output=main(args);
    process.stdout.write(typeof output?.print==='string'?output.print.endsWith('\n')?output.print:`${output.print}\n`:`${JSON.stringify(output,null,2)}\n`);
    if(output?.ok===false)process.exitCode=1;
  } catch(error) {
    process.stderr.write(`${JSON.stringify({ok:false,error:{message:error.message}},null,2)}\n`);
    process.exitCode=1;
  }
} else if (['init','update','doctor','version','--version','help','--help','-h'].includes(command)) {
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
