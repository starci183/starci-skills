// Durable workflow, Kernel and operation hierarchy projection.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../../engine/yaml.mjs';
import { AWAITING_OWNER } from '../../../../engine/admission.mjs';
import { JOB_ROW } from '../../../machine/job-row.mjs';
import { jobPayloadOf, getWorkflow, jobResultOf } from './rows.mjs';
import { workflowDisplayName } from '../../../lib/display-names.mjs';
import { isAwaitingOwner } from '../../failure-steps.mjs';

export const AGENT_HIERARCHY_SCHEMA = 'starci/agent-hierarchy@1';
export const workflowNodeId = (workflowId) => `workflow:${workflowId}`;
export const kernelNodeId = (workflowId) => `agent:kernel:${workflowId}`;
export const operationNodeId = (jobId) => `agent:operation:${jobId}`;
const profileProviderCache = new Map();
const providerForProfile = (profile, skillRoot) => {
  if (!profile) return null;
  if (profileProviderCache.has(profile)) return profileProviderCache.get(profile);
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${profile}.yaml`);
  let provider = null;
  try { provider = fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8'))?.provider ?? null) : null; } catch { provider = null; }
  profileProviderCache.set(profile, provider);
  return provider;
};

// Durable semantic hierarchy. Terminal tabs and pane ancestry are placement
// hints only; workflow/job identities survive terminal recreation, Kernel
// restarts and operation retries.
const hierarchyNodeOf = (row, skillRoot) => {
  const payload = jobPayloadOf(row);
  const stored = payload.hierarchy ?? {};
  const kernel = row.kind === 'kernel';
  const managed = payload.managed ?? {};
  const orca = payload.orca ?? {};
  const route = payload.route ?? {};
  const runtime = stored.runtime ?? {};
  const profile = runtime.profile ?? route.profile ?? payload.model ?? null;
  const profileProvider = providerForProfile(profile, skillRoot);
  return {
    nodeId: stored.nodeId ?? (kernel ? kernelNodeId(row.workflow_id) : operationNodeId(row.job_id)),
    parentNodeId: stored.parentNodeId ?? (kernel ? workflowNodeId(row.workflow_id) : kernelNodeId(row.workflow_id)),
    role: stored.role ?? (kernel ? 'kernel' : 'operation'),
    workflowId: row.workflow_id,
    jobId: row.job_id,
    opId: row.op_id ?? payload.opId ?? null,
    attempt: row.attempt,
    generation: row.generation,
    status: row.status,
    runtime: {
      host: runtime.host ?? route.host ?? 'orca',
      agent: runtime.agent ?? route.agent ?? payload.agent ?? payload.provider ?? profileProvider ?? null,
      provider: runtime.provider ?? payload.provider ?? route.agent ?? profileProvider ?? null,
      model: runtime.model ?? route.model ?? payload.modelId ?? null,
      profile,
      runtimePool: runtime.runtimePool ?? route.runtimePool ?? payload.model ?? null,
      runId: runtime.runId ?? managed.runId ?? orca.runId ?? null,
      taskId: runtime.taskId ?? managed.taskId ?? orca.taskId ?? null,
      dispatchId: runtime.dispatchId ?? managed.dispatchId ?? orca.dispatchId ?? null,
      terminalHandle: runtime.terminalHandle ?? managed.agentTerminalHandle ?? orca.agentTerminalHandle
        ?? (kernel ? row.worker_id : (managed.dispatchId ? null : row.worker_id)) ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const agentHierarchyFor = (db, workflowId, skillRoot) => {
  const workflow = getWorkflow(db, workflowId);
  if (!workflow) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const root = {
    nodeId: workflowNodeId(workflowId), role: 'workflow', workflowId,
    title: workflowDisplayName(workflow) ?? workflowId, status: workflow.phase ?? null,
    generation: workflow.generation ?? 0,
  };
  const nodes = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id`).all(workflowId)
    .map((row) => ({ ...hierarchyNodeOf(row, skillRoot), verdict: isAwaitingOwner(db, row) ? AWAITING_OWNER : (jobResultOf(row).verdict ?? null) }));
  const edges = nodes.map((node) => ({
    parentNodeId: node.parentNodeId,
    childNodeId: node.nodeId,
    relation: node.role === 'kernel' ? 'coordinates' : 'dispatches',
  }));
  return { schema: AGENT_HIERARCHY_SCHEMA, workflow: root, nodes, edges };
};
