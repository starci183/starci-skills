// scripts/reconciler/gate-fix-candidates.mjs — what a runtime-defect gate is offered again when the live runtime moves: the commits made since the gate was raised that
// touch what its cause names (its typed codes), so the Supervisor can attest the fix with `fixed --text <commit>`. Read-only git over the runtime root.
import { log } from '../api/git/log.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const MAX_COMMITS = 12;
const MAX_CODES = 4;
const CODE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}\b/g;
const cache = new Map(); // `${incidentId} ${rev}` -> [{sha, subject}]

/** The typed codes a gate's cause names: kebab-case words of its workaround record and detail text (op-gate-tool-failed ...), the longest first. Pure. */
export function causeCodesOf(gate) {
  const text = `${gate.workaround?.attempt ?? ''} ${gate.workaround?.none ?? ''} ${gate.detail ?? ''}`;
  return [...new Set(text.match(CODE) ?? [])].filter((code) => code.length >= 12).sort((a, b) => b.length - a.length).slice(0, MAX_CODES);
}

const commitsOf = (root, since, args) => {
  const r = log([`--since=${new Date(Number(since)).toISOString()}`, '--format=%h %s', ...args], { dir: root, timeout: 30_000 });
  return r.status === 0 ? String(r.stdout ?? '').split(/\r?\n/).filter(Boolean).map((line) => ({ sha: line.slice(0, line.indexOf(' ')), subject: line.slice(line.indexOf(' ') + 1) })) : [];
};

/** The candidate fix commits of one gate under the live revision `rev`: [{sha, subject}], newest first, cached per gate and revision. */
export function fixCandidatesOf(gate, rev, { root = skillRoot } = {}) {
  if (!rev) return [];
  const key = `${gate.incidentId} ${rev}`;
  if (!cache.has(key)) {
    const found = new Map();
    for (const code of causeCodesOf(gate)) for (const c of commitsOf(root, gate.since, ['-S', code, '--', 'scripts', 'engine', 'modules'])) found.set(c.sha, c);
    cache.set(key, [...found.values()].slice(0, MAX_COMMITS));
  }
  return cache.get(key);
}
