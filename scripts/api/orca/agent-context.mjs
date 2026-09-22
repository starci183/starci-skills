#!/usr/bin/env node
// agent-context.mjs — the calls.yaml `agent-context` call as a callable function.
//   node scripts/api/orca/agent-context.mjs
// The live command/flag signature of the binary that will actually run. It is
// what scripts/api/orca/lib.mjs compares calls.yaml against before the first
// mutation and what `scripts/checks/providers.mjs --live` compares in bulk.
// Returns {ok, commands, listing, schemaVersion} — listing is
// Map<command, Set<flag>>.
import { orcaCall, listingOf } from './lib.mjs';

export function agentContext() {
  const r = orcaCall('agent-context');
  const receipt = r.receipt ?? {};
  const commands = receipt.commands ?? r.result?.commands ?? null;
  const listing = listingOf(commands);
  return {
    ok: r.exitCode === 0 && Boolean(listing),
    commands: Array.isArray(commands) ? commands : [],
    listing,
    commandCount: receipt.commandCount ?? r.result?.commandCount ?? (Array.isArray(commands) ? commands.length : 0),
    schemaVersion: receipt.schemaVersion ?? r.result?.schemaVersion ?? null,
    error: r.error,
  };
}

if (process.argv[1]?.endsWith('agent-context.mjs')) {
  const out = agentContext();
  console.log(JSON.stringify({ ok: out.ok, commandCount: out.commandCount, schemaVersion: out.schemaVersion, error: out.error }, null, 2));
  process.exit(out.ok ? 0 : 1);
}
