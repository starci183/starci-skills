#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/**
 * The one command line of the workflow kernel. These commands belong to the launcher in
 * `hosts/orca/launch.mjs`; this entry forwards argv to it unchanged so a host never has to name a
 * module path, and the launcher's own direct-run entry keeps working exactly as before.
 */
const LAUNCHER_COMMANDS=['workflow-goal','workflow-amend','workflow-approve','workflow-answer','workflow-run','workflow-retry','workflow-status',
  'workflow-list','workflow-stop','workflow-lane-close','workflow-supervise','workflow-inputs',
  'journal-prune','journal-retire',
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
  workflow-amend       bind an explicit owner grant to the same stopped workflow without rewriting its approval
  workflow-approve     approve that goal, or re-admit what a blocked finish left open
  workflow-answer      give the owner's answer to a question or a reconciliation conflict
  workflow-run         run the approved workflow: allocate, launch, verify, commit, gate, report
                       --startup-token <token> is supplied by the supervisor's exclusive startup reservation
  workflow-retry       --id <id> --runtime-pin <file>: retry a paused workflow with fresh agents on that sealed build
                       --journal-file <path>: use a local journal visible to the execution host
                       --candidate-root <absolute-local-dir>: store only new attempt candidates below this directory
  workflow-status      print what one workflow is doing now, from its own files
  workflow-list        one line per workflow of this repository
  workflow-stop        checkpoint/pause at the next tick and export backend-owned workflows/<id>.md
  workflow-lane-close  remove a merged workflow's worktree, keeping its branch
  workflow-supervise   start and restart the kernel of every approved, unfinished workflow
  workflow-inputs      serve the kernel-owned credential form in its workflow's Orca browser
  journal-prune        --journal-file <file> [--store-root <root,..>] [--retire <id,..>] [--vacuum true] [--dry-run]: retire settled workflow rows
  journal-retire       --journal-file <file> --store-root <root,..> [--delete true]: remove a journal nothing binds
  start-op settle sweep notify report wait verify   the host calls an operation makes

machine checks (read-only; they judge bytes, not claims):

  render check <ui node dir> --brand <work root>    a provenance-marked browser capture against its kept markup (not ImageGen direction proof)
  brand check <work root> [--source <repo root>]    a brand record against the sources it names
  architecture check <repo root> [--config <repository-relative.json>]    TypeScript-resolved BE/FE dependency and composition boundaries
  code-patterns check --profile nest|next --root <repo root> --all    complete declared static code-rule coverage; optional --architecture-config <file>
  check-stales --work <work root> --repo <id>=<git root> [--target <node id>]    deterministic Work/source freshness report; no repair
  stacks check <repo root> --environment dev|vps --deployment-model <rendered.yaml-or-json>    static whole-app stack conformance
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
