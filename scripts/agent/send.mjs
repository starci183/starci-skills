#!/usr/bin/env node
// send.mjs — deliver a prompt to a live agent terminal and confirm consumption.
//   node scripts/agent/send.mjs --terminal <h> --provider <p>
//     (--text <t> | --text-file <f>) [--worktree <path>] [--dispatch-id <id>] [--no-await]
// --provider loads the adapter card for delivery mode + submission patterns.
import { arg, flag } from '../api/orca/lib.mjs';
import { loadAdapter, deliverPrompt, awaitSubmission, awaitAttestation, cleanupDeliveryArtifact } from './lib.mjs';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const terminal = arg(argv, 'terminal');
const provider = arg(argv, 'provider');
const text = arg(argv, 'text-file') ? fs.readFileSync(arg(argv, 'text-file'), 'utf8') : arg(argv, 'text');
if (!terminal || !provider || text == null) {
  console.error('use: send.mjs --terminal <h> --provider <p> (--text|--text-file) [--worktree] [--no-await]');
  process.exit(2);
}
const { card, error } = loadAdapter(provider);
if (error) { console.error(JSON.stringify({ ok: false, step: 'adapter', error })); process.exit(1); }

const send = deliverPrompt({ handle: terminal, adapter: card, prompt: text, worktree: arg(argv, 'worktree'), dispatchId: arg(argv, 'dispatch-id') ?? 'send' });
const out = { ok: send.ok, terminal, step: 'send', error: send.error };
if (send.ok && !flag(argv, 'no-await')) {
  const sub = awaitSubmission(terminal, card);
  out.step = 'submission';
  out.ok = sub.ok;
  out.error = sub.reason;
  if (sub.ok) {
    // Same death-watch as spawnAgent — a consumed prompt is not a live agent.
    const att = awaitAttestation(terminal, card);
    if (!att.ok) { out.step = 'attestation'; out.ok = false; out.error = att.signal; out.signal = att.signal; }
  }
  cleanupDeliveryArtifact(send.artifact);
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
