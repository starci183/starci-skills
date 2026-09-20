#!/usr/bin/env node
// spawn.mjs — spawn one agent terminal. Provider flags are injected from the
// adapter card — callers NEVER type --yolo/--dangerously-skip-permissions.
//
//   node scripts/agent/spawn.mjs --provider <devin|qwen|claude|codex>
//     --worktree <path> --title <t> [--prompt <text> | --prompt-file <f>]
//     [--command <override>] [--kernel] [--dispatch-id <id>]
//
// --kernel selects the card's kernelCommandRequirements (devin dangerous mode).
// --command supplies a profile launch command (model+tuning); the card's
// credential/env prefix is still prepended.
import { arg, flag } from '../api/orca/lib.mjs';
import { spawnAgent } from './lib.mjs';

const argv = process.argv.slice(2);
const provider = arg(argv, 'provider');
if (!provider) { console.error('use: spawn.mjs --provider <name> [--worktree p] [--title t] [--prompt|--prompt-file] [--kernel] [--command cmd]'); process.exit(2); }

const out = spawnAgent({
  provider,
  worktree: arg(argv, 'worktree'),
  title: arg(argv, 'title'),
  prompt: arg(argv, 'prompt'),
  promptFile: arg(argv, 'prompt-file'),
  command: arg(argv, 'command'),
  kernel: flag(argv, 'kernel'),
  dispatchId: arg(argv, 'dispatch-id'),
});
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
