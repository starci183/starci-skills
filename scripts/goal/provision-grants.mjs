// Provider grants bind an existing immutable plan; goal prose never supplies provider authority.
import fs from 'node:fs';
import path from 'node:path';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateAgainstSchema } from '../lib/json-schema.mjs';
import { callerOf } from '../guards/op-caller.mjs';
import { currentRole } from '../cli/roles.mjs';

/** Load an explicit public document, or retain the prior revision's typed grants. */
function readProvisionGrants({ provisionGrantsFile, revisionBase, skillRoot }) {
  let document = { schema: 'starci/provision-grants@1', grants: revisionBase?.json?.provisionGrants ?? [] };
  try {
    if (provisionGrantsFile) {
      const file = path.resolve(provisionGrantsFile);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('invalid file');
      document = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    const schema = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules/schemas/provision-operation.schema.yaml'), 'utf8'));
    if (validateAgainstSchema(document, { ...schema, $ref: '#/$defs/goalGrants' }).length) throw new Error('invalid grants');
  } catch { throw new Error('--provision-grants requires a regular public starci/provision-grants@1 JSON document'); }
  return document.grants;
}

/** Resolve only unique prepared plans in this project and ops in the selected goal chain. */
function provisionPlans({ provisionGrants, chain, repo }) {
  if (!provisionGrants.length) return [];
  const approvedOps = new Set((chain?.legs ?? []).map(leg => leg.op));
  const seen = new Set();
  let ledger;
  try {
    ledger = inspectLedger({ file: ledgerFileFor(repo) });
    return provisionGrants.map(grant => {
      if (seen.has(grant.operation) || !approvedOps.has(grant.op)) throw new Error('grant scope mismatch');
      seen.add(grant.operation);
      const row = ledger.db.prepare('SELECT action,target_id,plan_sha FROM provision_operations WHERE operation_id=?').get(grant.operation);
      if (!row || row.plan_sha !== grant.digest) throw new Error('prepared plan mismatch');
      return { ...grant, action: row.action, target: row.target_id };
    });
  } catch { throw new Error('provision grants must name unique prepared plans in this project and operations in the derived chain'); }
  finally { ledger?.close(); }
}

/** Prepare the content-bound grant selection before the native goal plan or persistence path. */
export function prepareProvisionGrants({ provisionGrantsFile, revisionBase, skillRoot, chain, repo,
  planOnly, reviseWorkflowId, definedBy, approvedBy, approveProvisionGrants }) {
  const provisionGrants = readProvisionGrants({ provisionGrantsFile, revisionBase, skillRoot });
  const provisionGrantsDigest = sha256(canonicalJSON(provisionGrants));
  const provisionGrantPlans = provisionPlans({ provisionGrants, chain, repo });
  if (!planOnly && provisionGrantsFile && (definedBy || approvedBy)) {
    throw new Error('a provisional or supervisor goal cannot issue provider grants');
  }
  if (!planOnly && !reviseWorkflowId && provisionGrants.length && approveProvisionGrants !== provisionGrantsDigest) {
    throw new Error('provider grants need --approve-provision-grants with the exact digest from the owner-approved goal plan');
  }
  if (approveProvisionGrants && approveProvisionGrants !== provisionGrantsDigest) {
    throw new Error('--approve-provision-grants does not match the selected grant list');
  }
  let provisionGrantsApproval = null;
  if (approvedBy) provisionGrantsApproval = revisionBase?.json?.provisionGrantsApproval ?? null;
  else if (provisionGrants.length) provisionGrantsApproval = {
    digest: provisionGrantsDigest, source: 'owner-goal-entry', assurance: 'conversation-context-not-authenticated',
  };
  return { provisionGrants, provisionGrantsDigest, provisionGrantPlans, provisionGrantsApproval };
}

/** Require the history-aware native owner when issuing, retaining or revoking provider grants. */
export function requireProvisionGrantOwner({ ledger, grants = [], priorGrants = [], root, env = process.env, provisional = false }) {
  if (!grants.length && !priorGrants.length) return;
  const caller = callerOf(ledger.db, env, { file: ledger.path, root });
  if (provisional || currentRole({ env, root }) !== 'owner' || caller.role !== 'owner' || caller.via !== 'unbound') {
    throw Object.assign(new Error('Provider grants require the actual unbound owner; a provisional or formerly managed caller cannot issue them.'),
      { code: 'provision-owner-checkpoint-required' });
  }
}
