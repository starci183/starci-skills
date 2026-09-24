// cluster.mjs — OWED items grouped by root cause (modules/supervisor/supervise.yaml step owed, kernelSeat):
// the [Supervisor] turns each cluster into ONE [Worker] job (scripts/supervisor/workers.mjs), never one per
// incident. Pure: items in (scripts/supervisor/owed.mjs owedFindings().owed, several ledgers), clusters out.
//
// Two items share a cluster when one cites the other's incident, when both carry the same fixed-by commit, or
// when they share a root-cause label (owed.mjs labelsOf, 'addressed-to-supervisor' aside) AND a distinctive
// token (owed.mjs fixTokens weight 2: a file name, an identifier, a finding code). The cluster id is stable
// across ticks while its lead label and token stay the same: <label>-<token>.
import crypto from 'node:crypto';
import { fixTokens, citedIncidents } from './owed.mjs';

const GENERIC_LABEL = 'addressed-to-supervisor';
const slug = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

/** Cluster `items`; returns [{id, label, token, items, workflows, incidents, fixedBy, summary}] largest first. */
export function clusterOwed(items) {
  const n = items.length;
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent[y] = x; };
  const facts = items.map((it) => {
    const text = `${it.summary ?? ''} ${it.text ?? ''}`;
    return {
      labels: new Set((it.labels ?? []).filter((l) => l !== GENERIC_LABEL)),
      tokens: new Set(fixTokens(it.kind, text).filter((t) => t.weight >= 2).map((t) => t.token)),
      cites: new Set(citedIncidents(text, it.incidentId ?? null)),
      fix: it.fixedBy?.sha ?? null,
    };
  });
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const fa = facts[a], fb = facts[b];
      if ((items[b].incidentId && fa.cites.has(items[b].incidentId)) || (items[a].incidentId && fb.cites.has(items[a].incidentId))) { join(a, b); continue; }
      if (fa.fix && fa.fix === fb.fix) { join(a, b); continue; }
      const sharedLabel = [...fa.labels].some((l) => fb.labels.has(l)) || (!fa.labels.size && !fb.labels.size && (items[a].pattern ?? items[a].kind) === (items[b].pattern ?? items[b].kind));
      if (sharedLabel && [...fa.tokens].some((t) => fb.tokens.has(t))) join(a, b);
    }
  }
  const groups = new Map();
  items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  const clusters = [...groups.values()].map((members) => {
    const count = (pick) => { const m = new Map(); for (const i of members) for (const v of pick(i)) m.set(v, (m.get(v) ?? 0) + 1); return [...m].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0])))[0]?.[0] ?? null; };
    const label = count((i) => facts[i].labels) ?? items[members[0]].pattern ?? items[members[0]].kind ?? 'owed';
    const token = count((i) => facts[i].tokens);
    const its = members.map((i) => items[i]);
    const keySeed = token ?? its.map((x) => x.incidentId ?? x.key).sort()[0] ?? crypto.randomUUID();
    const fixes = [...new Set(its.map((x) => x.fixedBy?.sha).filter(Boolean))];
    return {
      id: `${slug(label)}-${slug(keySeed)}`.replace(/-+$/, ''),
      label, token, size: its.length,
      workflows: [...new Set(its.map((x) => x.workflowId))],
      incidents: its.map((x) => x.incidentId).filter(Boolean),
      patterns: its.filter((x) => x.pattern).map((x) => x.key),
      fixedBy: fixes.length === 1 && its.every((x) => x.fixedBy?.sha === fixes[0]) ? fixes[0] : null,
      oldestMin: Math.max(...its.map((x) => x.ageMin ?? 0)),
      summary: its.map((x) => x.summary).filter(Boolean)[0] ?? '',
      items: its,
    };
  });
  return clusters.sort((a, b) => b.size - a.size || b.oldestMin - a.oldestMin);
}

export const clusterLine = (c) => `CLUSTER ${c.id} size=${c.size} oldest=${c.oldestMin}m ${c.fixedBy ? `fixed-by ${c.fixedBy.slice(0, 9)}?` : 'open'} wf=${c.workflows.join(',')} inc=${c.incidents.join(',') || '-'}${c.patterns.length ? ` patterns=${c.patterns.length}` : ''}: ${String(c.summary).replace(/\s+/g, ' ').slice(0, 160)}`;
