// prune.mjs - removes the managed Swarm secrets and configs that none of the kept releases names. A name is never reused and an earlier
// version is never deleted before convergence, so this runs only after a release was accepted. Docker refuses to remove an object a
// service still uses; such a refusal is reported and left alone (never forced). Without `execute` it only lists what it would remove.
import fs from 'node:fs';
import { firstLine, lines as splitLines, tool } from './context.mjs';
import { failure, refusal } from './errors.mjs';

const KINDS = ['secret', 'config'];

/** The runtime names a kept release.json holds: secret runtimeNames and config names (names only, never values). */
function keptNames(files) {
  const keep = new Set();
  for (const file of files) {
    let release;
    try { release = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw refusal('STACK_PRUNE_KEEP_INVALID', `${file} is not a readable release.json`); }
    for (const secret of release.secrets ?? []) keep.add(secret.runtimeName);
    for (const config of release.configs ?? []) keep.add(config.name);
  }
  return keep;
}

function managed(ctx, config, kind) {
  const list = tool(ctx, 'docker', [kind, 'ls', '--filter', `label=${config.stack}.managed=true`, '--format', '{{.Name}}']);
  if (list.status !== 0) throw failure('STACK_PRUNE_LIST', `docker ${kind} ls failed: ${firstLine(list.stderr)}`);
  return splitLines(list.stdout);
}

/**
 * Prunes superseded managed secrets and configs. `keepFiles` are the release.json files to keep (at least one).
 * Returns { ok, lines, data: { kept, candidates, removed, inUse } }.
 */
export async function pruneStack(ctx, config, { keepFiles = [], execute = false } = {}) {
  if (keepFiles.length === 0) throw refusal('STACK_PRUNE_NO_KEEP', 'prune needs --keep <release.json> (at least the accepted release)');
  const keep = keptNames(keepFiles);
  const out = { lines: [], removed: 0, inUse: 0, candidates: 0 };
  for (const kind of KINDS) {
    for (const name of managed(ctx, config, kind).filter((entry) => !keep.has(entry))) {
      out.candidates += 1;
      if (!execute) out.lines.push(`dry run: would remove ${kind} ${name}`);
      else if (tool(ctx, 'docker', [kind, 'rm', name]).status === 0) out.removed += 1;
      else { out.inUse += 1; out.lines.push(`${kind} ${name} is still in use; left alone`); }
    }
  }
  out.lines.push(execute ? `prune: removed ${out.removed} superseded objects, ${out.inUse} still in use` : `dry run: ${out.candidates} superseded objects would be removed`);
  return { ok: true, lines: out.lines, data: { kept: keep.size, candidates: out.candidates, removed: out.removed, inUse: out.inUse } };
}
