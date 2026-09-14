#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/**
 * The one command line of the workflow kernel. These commands belong to the launcher in
 * `hosts/orca/launch.mjs`; this entry forwards argv to it unchanged so a host never has to name a
 * module path, and the launcher's own direct-run entry keeps working exactly as before.
 */
const LAUNCHER_COMMANDS=['workflow-goal','workflow-approve','workflow-answer','workflow-run','workflow-retry','workflow-status',
  'workflow-list','workflow-stop','workflow-lane-close','workflow-supervise','workflow-inputs',
  'start-op','settle','sweep','notify','report','wait','verify'];

/**
 * The kernel half of the help. The installer prints its own page for `--help`, and for years that page was
 * the whole answer a person got from this entry - which taught the wrong command line, because the workflow
 * commands are the ones typed most and they never appeared. They are listed here, one line each, product-
 * agnostic: what the command does, not what any particular product's workflow is about.
 */
const KERNEL_HELP=`
workflow kernel (forwarded to the launcher; add --host <skill root> to reach a Work tree):

  workflow-goal        turn a job into a goal page and stop for the one human approval
  workflow-approve     approve that goal, or re-admit what a blocked finish left open
  workflow-answer      give the owner's answer to a question or a reconciliation conflict
  workflow-run         run the approved workflow: allocate, launch, verify, commit, gate, report
  workflow-retry       --id <id> --engine 6 --runtime-pin <file>: retry a paused workflow with fresh agents
                       --journal-file <path>: use a local journal visible to the execution host
  workflow-status      print what one workflow is doing now, from its own files
  workflow-list        one line per workflow of this repository
  workflow-stop        pause a running workflow at its next tick
  workflow-lane-close  remove a merged workflow's worktree, keeping its branch
  workflow-supervise   start and restart the kernel of every approved, unfinished workflow
  workflow-inputs      serve the kernel-owned credential form in its workflow's Orca browser
  start-op settle sweep notify report wait verify   the host calls an operation makes

machine checks (read-only; they judge bytes, not claims):

  render check <ui node dir> --brand <work root>    a drawing against its capture and kept markup
  brand check <work root> [--source <repo root>]    a brand record against the sources it names
`;

const args=process.argv.slice(2);
const command=args[0]??'help';
if (LAUNCHER_COMMANDS.includes(command)) {
  const {main}=await import('../.dist/hosts/orca/launch.mjs');
  try {
    // A text view prints as text; everything else is the record it always was.
    const output=await main(args);
    process.stdout.write(typeof output?.print==='string'?output.print.endsWith('\n')?output.print:`${output.print}\n`:`${JSON.stringify(output,null,2)}\n`);
    if(output?.ok===false)process.exitCode=1;
  } catch(error) {
    process.stderr.write(`${JSON.stringify({ok:false,error:{message:error.message}},null,2)}\n`);
    process.exitCode=1;
  }
} else if (['init','update','doctor','version','--version','help','--help','-h'].includes(command)) {
  const forwarded=command==='--version'?['version']:args;
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./starci-skills.mjs',import.meta.url)),...forwarded],{stdio:'inherit',windowsHide:true});
  // The installer help is the first half; the commands this entry forwards are the other half, and a person
  // asking for help gets both or learns the wrong command line.
  if(['help','--help','-h'].includes(command)&&(result.status??1)===0)process.stdout.write(KERNEL_HELP);
  process.exitCode=result.status??1;
} else if(command==='workspace') {
  if(args[1]!=='init') {console.error('starci: use workspace init <work-root> --id <workspace-id>');process.exitCode=1;}
  else {const {main}=await import('../.dist/cli/main.mjs');process.exitCode=await main(args.slice(1));}
} else {
  const {main}=await import('../.dist/cli/main.mjs');
  process.exitCode=await main(args);
}
