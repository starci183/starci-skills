import fs from 'node:fs';
import path from 'node:path';

const WORK_YAML = /(^|[\\/])\.starciwork[\\/].*\.ya?ml$/i;
const WORK_WALK_MAX = 2000;
/**
 * The Work records a settled job may cite blobs from (a3-3 work-citations, ARCHITECTURE-DB §5.3): the .starciwork yaml
 * files its report names, plus every yaml under the .starciwork paths it owns (a draw-loop bundle's generation.loop,
 * impl assets[] and the shell layout captures are written there without being listed in report.files). Bounded walk.
 */
export function workRecordFilesOf(repo, payload, envelope) {
  const out = new Set((Array.isArray(envelope?.files) ? envelope.files : []).filter((f) => typeof f === 'string' && WORK_YAML.test(f)));
  const owned = (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path))
    .filter((p) => typeof p === 'string' && /(^|\/)\.starciwork(\/|$)/.test(p.replace(/\\/g, '/')));
  const stack = owned.map((p) => path.resolve(repo, p.replace(/\/\*\*$/, '')));
  let seen = 0;
  while (stack.length && seen < WORK_WALK_MAX) {
    const at = stack.pop();
    let st; try { st = fs.statSync(at); } catch { continue; }
    if (st.isFile()) { if (/\.ya?ml$/i.test(at)) { out.add(at); seen += 1; } continue; }
    if (!st.isDirectory()) continue;
    let names = []; try { names = fs.readdirSync(at); } catch { continue; }
    for (const n of names) if (n !== 'node_modules' && !n.startsWith('.git')) stack.push(path.join(at, n));
  }
  return [...out];
}
