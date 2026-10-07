import { ownedOf } from './work-ownership.mjs';
import { parseJson } from '../lib/json.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { pathsOverlap } from '../lib/path-key.mjs';

const OPEN_JOB = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];
const SHARED_WIRING = /(?:^|\/)(?:app\.module\.ts|package\.json|package-lock\.json|pnpm-lock\.yaml|architecture\.json|\.starciwork\/index\.yaml)$/;

function addOpenJobDuplicatePairs(openJobs, addDup) {
  for (let i = 0; i < openJobs.length; i++) for (let j = i + 1; j < openJobs.length; j++) {
    const a = openJobs[i], b = openJobs[j];
    if (a.workflow_id === b.workflow_id) continue;
    const hit = a.owned.find((p) => !SHARED_WIRING.test(p) && b.owned.some((q) => pathsOverlap(p, q)));
    if (hit) addDup({ workflowId: a.workflow_id }, { workflowId: b.workflow_id }, { via: 'open-jobs', path: hit, jobs: [a.job_id, b.job_id] });
  }
}

function addWorkGraphDuplicatePairs(graphOwned, addDup) {
  for (let i = 0; i < graphOwned.length; i++) for (let j = i + 1; j < graphOwned.length; j++) {
    const a = graphOwned[i], b = graphOwned[j];
    if (a.workflowId === b.workflowId) continue;
    const hit = a.owned.find((p) => !SHARED_WIRING.test(p) && b.owned.some((q) => pathsOverlap(p, q)));
    if (hit) addDup(a, b, { via: 'work-graph', path: hit, nodes: [a.node, b.node] });
  }
}

function addDuplicatePairFindings(dupPairs, findings, byId, shortWorkflow) {
  for (const { workflows, items } of dupPairs.values()) {
    const [older, younger] = [...workflows].toSorted((a, b) => byId.get(a).created_at - byId.get(b).created_at);
    const duplicateText = items.slice(0, 3).map((it) => {
      let related = '';
      if (it.jobs) related = ` ${it.jobs.join(' / ')}`;
      else if (it.nodes) related = ` ${it.nodes.join(' / ')}`;
      return `${it.path} (${it.via}${related})`;
    }).join('; ');
    findings.push({
      key: `duplicate-work|${workflows.join('+')}`, kind: 'duplicate-work', workflows,
      summary: `${shortWorkflow(workflows[0])} and ${shortWorkflow(workflows[1])} build the same thing: ${duplicateText}`,
      evidence: items,
      proposal: { action: 'revise', workflow: younger, keeps: older, paths: [...new Set(items.map((it) => it.path))], clearCut: false,
        why: `the older ${shortWorkflow(older)} keeps the shared part; ${shortWorkflow(younger)} is revised to park (or merge) its duplicating legs - which legs is a judgement on the goal texts` },
    });
  }
}

function addFoundationAliasFindings(aliasGroups, findings, live, shortWorkflow) {
  for (const [k, group] of aliasGroups) {
    const owned = group.filter((f) => f.owner?.workflowId && live.has(f.owner.workflowId) && f.state !== 'landed');
    const owners = [...new Set(owned.map((f) => f.owner.workflowId))];
    if (owners.length < 2) continue;
    findings.push({
      key: `duplicate-work|foundation:${k}`, kind: 'duplicate-work', workflows: owners,
      summary: `foundation ${k} is claimed under ${group.map((f) => f.name).join(', ')} by ${owners.map((w) => shortWorkflow(w)).join(', ')}: two owners build one foundation`,
      evidence: group.map((f) => ({ foundation: f.name, state: f.state, owner: f.owner?.workflowId ?? null })),
      proposal: { action: 'transfer', target: { foundation: owned.slice(1).map((f) => f.name)[0] }, to: owned[0].owner.workflowId, clearCut: false,
        why: 'one foundation, one owner: the older claim keeps it, the other claim transfers to it and its legs are revised' },
    });
  }
}

export function addDuplicateFindings({ db, live, graphOwned, foundations, findings, byId, foundationAliasKey, shortWorkflow }) {
  const openJobs = db.prepare(`SELECT job_id,workflow_id,op_id,status,payload_json FROM jobs WHERE kind<>'kernel' AND status IN (${OPEN_JOB.map(() => '?').join(',')})`).all(...OPEN_JOB)
    .filter((j) => live.has(j.workflow_id)).map((j) => ({ ...j, owned: ownedOf(parseJson(j.payload_json)).map((p) => p.toLowerCase()) }));
  const dupPairs = new Map();
  const addDup = (a, b, detail) => {
    const pair = [a.workflowId, b.workflowId].toSorted(byCodeUnit);
    const k = pair.join('+');
    if (!dupPairs.has(k)) dupPairs.set(k, { workflows: pair, items: [] });
    if (dupPairs.get(k).items.length < 12) dupPairs.get(k).items.push(detail);
  };
  addOpenJobDuplicatePairs(openJobs, addDup);
  addWorkGraphDuplicatePairs(graphOwned, addDup);
  addDuplicatePairFindings(dupPairs, findings, byId, shortWorkflow);
  const aliasGroups = new Map();
  for (const f of foundations.filter((item) => !item.mergedInto)) {
    const k = foundationAliasKey(f.name);
    if (!aliasGroups.has(k)) aliasGroups.set(k, []);
    aliasGroups.get(k).push(f);
  }
  addFoundationAliasFindings(aliasGroups, findings, live, shortWorkflow);
}
