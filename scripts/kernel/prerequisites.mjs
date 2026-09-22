// prerequisites.mjs — the machine-checkable half of an op's prerequisites,
// evaluated by `api dispatch` before anything is reserved or launched. Only
// data is read: a manifest read marked `mustExist` whose path the job's binding
// resolves, and the `dependsOn` of the job's bound Work records when the op's
// graphPolicy.prerequisiteState is `done`. Prose (route.prerequisites) is never
// parsed. Anything the data cannot decide — a placeholder the binding does not
// resolve, a record outside a Work tree, a tree the Work traversal reads as
// invalid — is unknown, and unknown is not unmet.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateWorkspace } from '../../engine/index.mjs';

const WORK_ROOT = '.starciwork';
const PLACEHOLDER = /^<[^<>/]+>$/;
const GLOB = /[*?[\]{}]/;

const plainPath = (value) => String(typeof value === 'string' ? value : value?.path ?? '')
  .trim().replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '').replace(/^\.\//, '');
const segments = (value) => value.split('/').filter((part) => part && part !== '.');

/**
 * Where a manifest read path lands for this job. The path's placeholders must
 * all sit in a prefix that one bound record or owned path spells out in full;
 * the rest of the path is appended to it. Returns [] when nothing resolves.
 */
export function resolveReadPath(pattern, bindings) {
  const parts = segments(plainPath(pattern));
  const last = parts.map((part) => PLACEHOLDER.test(part)).lastIndexOf(true);
  if (last < 0 || parts.some((part) => !PLACEHOLDER.test(part) && (GLOB.test(part) || /[<>]/.test(part)))) return [];
  const prefix = parts.slice(0, last + 1), suffix = parts.slice(last + 1);
  const resolved = new Set();
  for (const binding of bindings) {
    const candidate = segments(plainPath(binding));
    if (candidate.length !== prefix.length) continue;
    const fits = prefix.every((part, i) => (PLACEHOLDER.test(part)
      ? !GLOB.test(candidate[i]) && !/[<>]/.test(candidate[i])
      : part === candidate[i]));
    if (fits) resolved.add([...candidate, ...suffix].join('/'));
  }
  return [...resolved];
}

/** The index.yaml files a record's effective dependsOn is drawn from: its own and every ancestor's up to the Work root. */
const declaredDependsOn = (workRoot, recordDir) => {
  const declared = [];
  for (let dir = recordDir; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'index.yaml');
    if (fs.existsSync(file)) {
      try {
        const deps = parseYaml(fs.readFileSync(file, 'utf8'))?.dependsOn;
        if (Array.isArray(deps)) declared.push(...deps.filter((dep) => typeof dep === 'string' && dep));
      } catch { /* an unreadable record declares nothing this check can read */ }
    }
    if (path.resolve(dir) === path.resolve(workRoot) || path.dirname(dir) === dir) break;
  }
  return declared;
};

/**
 * Evaluate one job's data prerequisites against the target repository.
 * Returns {unmet:[...], unknown:[...]} — an empty `unmet` admits.
 */
export function checkPrerequisites({ brief, payload, repo, validate = validateWorkspace }) {
  const unmet = [], unknown = [];
  const records = (Array.isArray(payload?.records) ? payload.records : []).map(plainPath).filter(Boolean);
  const bindings = [...(Array.isArray(payload?.owned_paths) ? payload.owned_paths : []), ...records];

  for (const read of Array.isArray(brief?.reads) ? brief.reads : []) {
    if (read?.mustExist !== true) continue;
    const resolved = resolveReadPath(read.path, bindings);
    if (!resolved.length) { unknown.push({ kind: 'read-unbound', read: read.id, path: read.path }); continue; }
    for (const rel of resolved) {
      if (!fs.existsSync(path.join(repo, rel))) unmet.push({ kind: 'record-missing', read: read.id, path: rel });
    }
  }

  if (brief?.graphPolicy?.prerequisiteState === 'done') {
    const trees = new Map();
    for (const record of records) {
      const parts = segments(record);
      const at = parts.indexOf(WORK_ROOT);
      if (at < 0 || at === parts.length - 1) { if (at < 0) unknown.push({ kind: 'record-outside-work', record }); continue; }
      const workRoot = path.join(repo, ...parts.slice(0, at + 1));
      const nodePath = `${parts.slice(at + 1).join('/')}/index.yaml`;
      if (!declaredDependsOn(workRoot, path.join(repo, ...parts)).length) continue;
      if (!trees.has(workRoot)) trees.set(workRoot, validate(workRoot));
      const nodes = trees.get(workRoot)?.nodes ?? [];
      const node = nodes.find((n) => n.path === nodePath);
      if (!node) { unknown.push({ kind: 'record-not-a-node', record }); continue; }
      const states = new Map(nodes.map((n) => [n.id, n.effectiveState]));
      const notDone = (node.dependsOn ?? []).map((id) => ({ id, state: states.get(id) ?? 'missing' }))
        .filter(({ state }) => state !== 'done');
      const decidable = notDone.filter(({ state }) => state !== 'invalid' && state !== 'missing');
      if (decidable.length) unmet.push({ kind: 'dependency-not-done', record, dependsOn: decidable });
      if (decidable.length < notDone.length) unknown.push({ kind: 'dependency-state-unknown', record, dependsOn: notDone.filter((d) => !decidable.includes(d)) });
    }
  }
  return { unmet, unknown };
}

/** The one-paragraph instruction a refused Kernel acts on. */
export function prerequisiteDetail({ op, jobId, unmet }) {
  const lines = unmet.map((item) => (item.kind === 'record-missing'
    ? `${op} reads ${item.path} (reads.${item.read}, mustExist) and it does not exist`
    : `bound record ${item.record} depends on ${item.dependsOn.map((d) => `${d.id} (${d.state})`).join(', ')}, not done, and ${op} graphPolicy.prerequisiteState is done`));
  return `${lines.join('; ')}. Produce the missing record or finish the dependency through the op that owns it, then run api dispatch --job ${jobId} again; if the job binds the wrong record, enqueue a corrected job and settle this one --verdict blocked. The job stays queued and nothing was reserved or launched.`;
}
