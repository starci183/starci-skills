#!/usr/bin/env node
// kill.mjs — close an agent terminal.
//   node scripts/agent/kill.mjs --terminal <handle> [--tab]
import { arg, flag } from '../api/orca/lib.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';

const argv = process.argv.slice(2);
const terminal = arg(argv, 'terminal');
if (!terminal) { console.error('use: kill.mjs --terminal <handle> [--tab]'); process.exit(2); }
const out = terminalClose({ terminal, tab: flag(argv, 'tab') });
console.log(JSON.stringify({ terminal, ...out }, null, 2));
process.exit(out.ok ? 0 : 1);
