import fs from 'node:fs';
import path from 'node:path';

const WORK_YAML = /(^|[\\/])\.starciwork[\\/].*\.ya?ml$/i;
const WORK_WALK_MAX = 2000;
/**
 * The Work records a settled job may cite blobs from (work-citations, docs/ledger-db.md): the .starciwork yaml
 * files its report names, plus every yaml under the .starciwork paths it owns (a draw-loop bundle's generation.loop,
 * impl assets[] and the shell layout captures are written there without being listed in report.files). Bounded walk.
 */
export function workRecordFilesOf(repo, payload, envelope) {
  const out = new Set((Array.isArray(envelope?.files) ? envelope.files : []).filter((f) => typeof f === 'string' && WORK_YAML.test(f)));
  const owned = (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path))
    .filter((p) => typeof p === 'string' && /(^|\/)\.starciwork(\/|$)/.test(p.replaceAll('\\', '/')));
  const stack = owned.map((p) => path.resolve(repo, p.replace(/\/\*\*$/, '')));
  walkYaml(stack, out);
  return [...out];
}

function walkYaml(stack, out) {
  let seen = 0;
  while (stack.length && seen < WORK_WALK_MAX) {
    const at = stack.pop();
    seen += visitYamlPath(at, stack, out);
  }
}

function visitYamlPath(at, stack, out) {
  let st; try { st = fs.statSync(at); } catch { return 0; }
  if (st.isFile()) {
    if (/\.ya?ml$/i.test(at)) { out.add(at); return 1; }
    return 0;
  }
  if (!st.isDirectory()) return 0;
  let names = []; try { names = fs.readdirSync(at); } catch { return 0; }
  for (const n of names) if (n !== 'node_modules' && !n.startsWith('.git')) stack.push(path.join(at, n));
  return 0;
}
