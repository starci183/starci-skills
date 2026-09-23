#!/usr/bin/env node
// The one command line of StarCi: a thin dispatcher over the installed tree's own executables.
// install/update/doctor/version are the installer (scripts/install/install.mjs); api is the kernel
// agent's mutation gate; start boots a workflow kernel; goal defines one. Anything else is the help.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROUTES = {
  init: '../scripts/install/install.mjs',
  update: '../scripts/install/install.mjs',
  doctor: '../scripts/install/install.mjs',
  version: '../scripts/install/install.mjs',
  api: '../scripts/kernel/api.mjs',
  start: '../scripts/kernel/start-workflow.mjs',
  goal: '../scripts/goal/define-goal.mjs',
  validate: '../scripts/checks/work-validate.mjs',
};

const HELP = `starci — kernel-agent workflow runtime

  starci init|update|doctor|version   install & maintain the .claude runtime tree
  starci api <verb> [args]            kernel ledger gate: survey|status|hierarchy|plan|enqueue|estimate|route|dispatch|reconcile|nudge|observe|questions|reply|settle|report|op-contract|check|consume-report|serve-ask|retire-ask|incident|finish
  starci start [args]                 claim a queued goal and boot its kernel agent
  starci goal [args]                  define a goal: assess, plan table, persist to the ledger
  starci validate <work-root>         read-only Work record/layout validation
  starci help                         this text
`;

const INSTALL_VERBS = new Set(['init', 'update', 'doctor', 'version']);
const [command, ...rest] = process.argv.slice(2);
const verb = command === '--version' ? 'version' : command;
if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
  process.stdout.write(HELP);
} else if (ROUTES[verb]) {
  const script = fileURLToPath(new URL(ROUTES[verb], import.meta.url));
  // The installer expects its verb as argv[0]; api/start/goal take their own arguments only.
  const args = INSTALL_VERBS.has(verb) ? [verb, ...rest] : rest;
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', windowsHide: true });
  process.exitCode = result.status ?? 1;
} else {
  process.stderr.write(`starci: unknown command ${command}\n`);
  process.stdout.write(HELP);
  process.exitCode = 1;
}
