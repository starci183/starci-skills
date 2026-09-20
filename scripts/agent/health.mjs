#!/usr/bin/env node
// health.mjs — is this agent terminal alive and usable?
//   node scripts/agent/health.mjs --terminal <handle>
// {live, connected, writable, reason} — terminal identity is the proof.
import { arg } from '../api/orca/lib.mjs';
import { agentHealth } from './lib.mjs';

const terminal = arg(process.argv.slice(2), 'terminal');
if (!terminal) { console.error('use: health.mjs --terminal <handle>'); process.exit(2); }
const out = agentHealth(terminal);
console.log(JSON.stringify({ terminal, ...out }, null, 2));
process.exit(out.live ? 0 : 1);
