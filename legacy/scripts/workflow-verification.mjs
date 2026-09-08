import { locateWorkflowSession } from './workflow-root.mjs';
// Read-only portfolio proof. Task messages locate evidence; only the original accepted bytes
// establish an outcome. No peer ledger is edited and no producer output is imported.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { workflowTopologyMode, workflowTopologyPeers, sessionWorkflowTopologyErrors } from './workflow-topology.mjs';
import { buildCoordinationVerification } from './workflow-coordination.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORKFLOW_OPERATOR = 'workflow.verify';
export const WORKFLOW_REPORT = 'response/data/workflow-verification-report.json';
export const WORKFLOW_PEERS = 'request/peers.json';
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const schema = (root, name) => json(path.join(root, 'templates', 'kinds', `${name}.schema.json`));
const policyOf = root => json(path.join(root, 'resources', 'orchestrator.json')).workflowTopologies;
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

function confined(base, ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || path.win32.isAbsolute(ref) || /[\\:\0]/.test(ref)
    || ref.split('/').some(part => !part || part === '.' || part === '..')) throw Error('workflow evidence path is unsafe');
  const realBase = realpathSync(base);
  let file = base;
  for (const part of ref.split('/')) {
    file = path.join(file, part);
    if (lstatSync(file).isSymbolicLink()) throw Error('workflow evidence symlinks are forbidden');
    const relative = path.relative(realBase, realpathSync(file));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error('workflow evidence escaped its Source');
  }
  return file;
}

const git = (worktree, args) => execFileSync('git', ['-C', worktree, ...args], {
  encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const fullCommit = (worktree, oid) => git(worktree, ['rev-parse', '--verify', `${oid}^{commit}`]);
const repositoryHash = worktree => {
  const common = git(worktree, ['rev-parse', '--git-common-dir']);
  const resolved = realpathSync(path.isAbsolute(common) ? common : path.resolve(worktree, common));
  return sha(Buffer.from(process.platform === 'win32' ? resolved.toLowerCase() : resolved));
};
const isAncestor = (worktree, older, newer) => {
  try { git(worktree, ['merge-base', '--is-ancestor', older, newer]); return true; }
  catch { return false; }
};
const trackedHeadSet = peer => Array.isArray(peer?.heads)
  ? peer.heads.map(({ alias, head }) => ({ alias, head })).sort((a, b) => a.alias.localeCompare(b.alias))
  : null;
const frozenHeadSet = peer => peer.heads.map(({ alias, head }) => ({ alias, head })).sort((a, b) => a.alias.localeCompare(b.alias));

export function workflowPeerSnapshotErrors(root, branch, request, state) {
  if (request.operatorId !== WORKFLOW_OPERATOR) return [];
  const errors = [];
  const policy = policyOf(root);
  const rule = policy.modes[workflowTopologyMode(policy, state)];
  if (rule?.completionOperator !== WORKFLOW_OPERATOR) errors.push('workflow.verify requires a topology whose completionOperator owns this proof');
  errors.push(...sessionWorkflowTopologyErrors(policy, state, { dispatch: true }));
  if (request.requirements?.peers !== WORKFLOW_PEERS) errors.push(`workflow.verify requirements.peers must be ${WORKFLOW_PEERS}`);
  let snapshot, bytes;
  try { bytes = readFileSync(confined(branch, WORKFLOW_PEERS)); snapshot = JSON.parse(bytes); }
  catch (error) { return [...errors, `workflow peers snapshot: ${error.message}`]; }
  const shapeErrors = validateAgainst(schema(root, 'workflow-peers'), snapshot, WORKFLOW_PEERS);
  if (shapeErrors.length) return [...errors, ...shapeErrors];
  if (!(request.frozenInputs ?? []).some(item => item.ref === WORKFLOW_PEERS && item.sha256 === sha(bytes))) errors.push('workflow peers snapshot must be sealed in frozenInputs at its exact digest');
  if (state.coordination?.active && (snapshot.version !== 2 || canonical(snapshot.coordination?.assignment) !== canonical(state.coordination.active))) errors.push('workflow peers snapshot must freeze its current coordinated assignment');
  const tracked = workflowTopologyPeers(policy, state) ?? {};
  if (Object.keys(tracked).sort().join('\n') !== Object.keys(snapshot.peers).sort().join('\n')) errors.push('workflow peers snapshot must name exactly the tracked peer tasks');
  const expectedGoals = (state.mission?.doneWhen ?? []).filter(line => line.producedBy === WORKFLOW_OPERATOR).map(line => line.evidence);
  if (!expectedGoals.length || new Set(expectedGoals).size !== expectedGoals.length) errors.push('workflow.verify requires distinct coordinator doneWhen evidence lines produced by this operator');
  const covered = new Set();
  const sessionIds = new Set();
  for (const impact of state.mission?.discovery?.impacts ?? []) if (impact.producer && !Object.values(snapshot.peers).some(peer => peer.sessionId === impact.producer.sessionId)) errors.push(`workflow peers snapshot omits the original owner of impact ${impact.id}`);
  const contexts = request.contexts ?? [];
  const boundAliases = new Set(contexts.map(context => context.alias));
  const allowedPeerAliases = new Set(Object.values(snapshot.peers).flatMap(peer => ['sessions', 'done'].map(zone => `@worktrees/${zone}/${peer.sessionId}`)));
  if (snapshot.coordination) for (const zone of ['sessions', 'done']) allowedPeerAliases.add(`@worktrees/${zone}/${state.id}`);
  const seenPeerAliases = new Set();
  for (const [index, context] of contexts.entries()) {
    const alias = context?.alias;
    const peerEvidence = typeof alias === 'string' && (alias === '@worktrees/sessions' || alias.startsWith('@worktrees/sessions/')
      || alias === '@worktrees/done' || alias.startsWith('@worktrees/done/'));
    if (!peerEvidence) continue;
    if (!allowedPeerAliases.has(alias)) errors.push(`workflow peer context ${index}: ${alias} is not an exact live or retained root of a frozen peer`);
    else if (seenPeerAliases.has(alias)) errors.push(`workflow peer context ${index}: ${alias} is duplicated`);
    seenPeerAliases.add(alias);
  }
  for (const [taskId, peer] of Object.entries(snapshot.peers)) {
    const trackedPeer = tracked[taskId];
    if (peer.owns !== trackedPeer?.owns) errors.push(`workflow peer ${taskId}: frozen ownership differs from brief.peers`);
    if (snapshot.version === 1) {
      if (peer.head !== trackedPeer?.head) errors.push(`workflow peer ${taskId}: frozen head differs from brief.peers`);
    } else {
      const aliases = peer.heads.map(item => item.alias);
      if (new Set(aliases).size !== aliases.length) errors.push(`workflow peer ${taskId}: repository head aliases must be distinct`);
      if (canonical(frozenHeadSet(peer)) !== canonical(trackedHeadSet(trackedPeer))) errors.push(`workflow peer ${taskId}: frozen repository heads differ from brief.peers`);
    }
    if (peer.sessionId === state.id || sessionIds.has(peer.sessionId)) errors.push(`workflow peer ${taskId}: session identity must be distinct from the coordinator and other peers`);
    sessionIds.add(peer.sessionId);
    if (!['sessions', 'done'].some(zone => boundAliases.has(`@worktrees/${zone}/${peer.sessionId}`))) errors.push(`workflow peer ${taskId}: the isolated worker needs an explicit original session or archive context alias`);
    for (const line of peer.doneWhen) {
      if (!expectedGoals.includes(line)) errors.push(`workflow peer ${taskId}: doneWhen maps outside the coordinator's workflow.verify goal`);
      covered.add(line);
    }
  }
  for (const line of expectedGoals) if (!covered.has(line)) errors.push(`workflow peers snapshot leaves doneWhen unowned: ${line}`);
  return errors;
}

async function originalSession(hostRoot, sessionId, request) {
  hostRoot = locateWorkflowSession(hostRoot, sessionId).ownerRoot;
  const live = `.worktrees/sessions/${sessionId}`;
  const bound = new Set((request.contexts ?? []).map(context => context.alias));
  if (existsSync(path.join(hostRoot, live))) {
    if (!bound.has(`@worktrees/sessions/${sessionId}`)) throw Error('live peer evidence is outside the isolated worker context');
    const session = confined(hostRoot, live);
    if (json(confined(session, 'state.json')).lifecycle?.phase !== 'active') throw Error('live peer is not active; finish or recover its normal close before verification');
    return session;
  }
  if (!bound.has(`@worktrees/done/${sessionId}`)) throw Error('retained peer evidence is outside the isolated worker context; bind its archive on a new attempt');
  const archive = confined(hostRoot, `.worktrees/done/${sessionId}`);
  const { verifyRetention } = await import('./session-cleanup.mjs');
  await verifyRetention(archive, json(confined(archive, 'retention.json')));
  return confined(archive, 'bundle');
}

function acceptedWorkspaceHints(proofRows) {
  const hints = new Map();
  for (const rows of proofRows.values()) {
    for (const proof of rows.proofs) {
      for (const binding of proof.bindings) {
        if (!binding.worktree || !binding.repositoryHash) continue;
        if (!hints.has(binding.alias)) hints.set(binding.alias, []);
        if (!hints.get(binding.alias).some(existing => existing.worktree === binding.worktree)) {
          hints.get(binding.alias).push({ worktree: binding.worktree, repositoryHash: binding.repositoryHash });
        }
      }
    }
  }
  for (const [alias, items] of hints) {
    if (new Set(items.map(item => item.repositoryHash)).size > 1) {
      throw Error(`repository alias ${alias} resolves to multiple accepted repository identities`);
    }
  }
  return hints;
}

async function acceptedProofs(root, session, child, ledger, doneWhen, legacy = null) {
  const proofs = [];
  const refusals = [];
  const candidates = ledger.filter(row => row.doneWhen === doneWhen && row.achieved && child.attempts?.[row.branch]?.status === 'matched');
  for (const candidate of candidates) {
    try {
      const [n, m] = candidate.branch.split('/');
      const ref = `step-${n}/parallel-${m}`;
      const original = confined(session, ref);
      const attempt = child.attempts[candidate.branch];
      const manifestErrors = await evidenceManifestErrors(original, attempt.evidenceManifest);
      if (manifestErrors.length) throw Error(manifestErrors.join('; '));
      const requestFile = confined(original, 'request/request.json');
      const requestBytes = readFileSync(requestFile);
      const childRequest = JSON.parse(requestBytes);
      if (child.requestHashes?.[candidate.branch] !== sha(requestBytes) || childRequest.sessionId !== child.id
        || childRequest.operatorId !== child.steps[candidate.branch]) throw Error('original request identity or frozen hash differs');
      const checked = await (await import('./validate-step.mjs')).validateStep(root, original, { origin: true, operator: true, requestPhase: 'accept' });
      if (checked.errors.length) throw Error(checked.errors.join('; '));
      const bindings = new Map((childRequest.contexts ?? []).filter(context => /^@workspaces\//.test(context.alias) && context.head)
        .map(context => [context.alias, { alias: context.alias, revision: context.head, worktree: null, repositoryHash: null }]));
      const workspace = childRequest.environment?.workspace;
      if (workspace) {
        if (!path.isAbsolute(workspace.worktree) || !workspace.alias || !workspace.revision) throw Error('proving workspace must bind an absolute worktree, routed alias and full revision');
        const base = fullCommit(workspace.worktree, workspace.revision);
        const commits = (checked.response?.commits ?? []).map(oid => fullCommit(workspace.worktree, oid));
        bindings.set(workspace.alias, { alias: workspace.alias, worktree: workspace.worktree,
          revision: commits.at(-1) ?? base, repositoryHash: repositoryHash(workspace.worktree) });
      } else if ((checked.response?.commits ?? []).length && !legacy) throw Error('accepted commits have no proving workspace boundary');
      if (legacy) {
        const recorded = [workspace?.revision, ...(checked.response?.commits ?? [])].filter(Boolean);
        if (recorded.includes(legacy.head)) {
          const worktree = workspace?.worktree ?? legacy.worktree;
          if (!path.isAbsolute(worktree)) throw Error('proving source worktree is not absolute');
          bindings.set('@legacy-host', { alias: '@legacy-host', worktree, revision: fullCommit(worktree, legacy.head), repositoryHash: repositoryHash(worktree) });
        }
      }
      proofs.push({ doneWhen, operatorId: child.mission.doneWhen[doneWhen].producedBy, ref, ...(candidate.partition ? { partition: candidate.partition } : {}),
        fingerprint: attempt.evidenceManifest.fingerprint, bindings: [...bindings.values()].sort((a, b) => a.alias.localeCompare(b.alias)) });
    } catch (error) { refusals.push(error.message); }
  }
  const requiredPartitions = [...new Set(ledger.filter(row => row.doneWhen === doneWhen).flatMap(row => row.requiredPartitions ?? []))];
  for (const member of requiredPartitions) if (!proofs.some(proof => proof.partition === member)) refusals.push(`required goal partition ${member} has no accepted original proof`);
  return { proofs, refusals, requiredPartitions };
}

function legacyProof(peer, rows) {
  for (const row of rows.proofs) {
    for (const binding of row.bindings) {
      if (!binding.worktree || binding.revision !== peer.head) continue;
      if (fullCommit(binding.worktree, peer.head) !== peer.head || git(binding.worktree, ['rev-parse', 'HEAD']) !== peer.head) continue;
      return { ref: row.ref, fingerprint: row.fingerprint };
    }
  }
  throw Error(`recorded peer head is not bound by the accepted proving branch: ${rows.refusals.join('; ')}`);
}

const hydrate = (binding, hints) => {
  if (!binding) return null;
  if (binding.worktree) return binding;
  for (const hint of hints.get(binding.alias) ?? []) {
    try { return { ...binding, ...hint, revision: fullCommit(hint.worktree, binding.revision) }; }
    catch { /* Try the next accepted same-alias worktree. */ }
  }
  return null;
};

export function repositoryProof(peer, proofRows, childGoals, ancestralEvidenceOperators, hints = new Map()) {
  for (const [alias, items] of hints) {
    if (new Set(items.map(item => item.repositoryHash)).size > 1) throw Error(`repository alias ${alias} resolves to multiple accepted repository identities`);
  }
  const boundaries = new Map(peer.heads.map(item => [item.alias, { ...item }]));
  const ancestors = new Set(ancestralEvidenceOperators);
  const required = new Map([...boundaries].map(([alias]) => [alias, new Set()]));
  const aliasesByGoal = new Map();
  for (const [doneWhen, rows] of proofRows) {
    const operatorId = childGoals[doneWhen]?.producedBy;
    const aliases = new Set(rows.proofs.flatMap(row => row.bindings.map(binding => binding.alias)));
    aliasesByGoal.set(doneWhen, aliases);
    if (!aliases.size) throw Error(`child doneWhen:${doneWhen} (${operatorId}) binds no repository head`);
    for (const alias of aliases) {
      if (!boundaries.has(alias)) throw Error(`child doneWhen:${doneWhen} routes proof through undeclared repository boundary ${alias}`);
      if (ancestors.has(operatorId)) continue;
      required.get(alias).add(doneWhen);
      if (!boundaries.get(alias).deliveryDoneWhen.includes(doneWhen)) throw Error(`repository ${alias}: deliveryDoneWhen omits required current child doneWhen:${doneWhen}`);
    }
  }

  // Each required partition is one observation over its own frozen role heads. No partition may
  // manufacture a multi-role observation by joining aliases from different accepted invocations.
  const proofGroups = rows => rows.requiredPartitions?.length
    ? rows.requiredPartitions.map(member => rows.proofs.filter(proof => proof.partition === member)) : [rows.proofs];
  const selectedByGoal = new Map();
  for (const [doneWhen, rows] of proofRows) {
    const operatorId = childGoals[doneWhen]?.producedBy;
    if (ancestors.has(operatorId)) continue;
    const selections = [];
    for (const group of proofGroups(rows)) {
    const aliases = new Set(group.flatMap(row => row.bindings.map(binding => binding.alias)));
    let selected = null;
    for (const row of group) {
      const bindings = new Map();
      let valid = true;
      for (const alias of aliases) {
        const boundary = boundaries.get(alias);
        const binding = hydrate(row.bindings.find(item => item.alias === alias), hints);
        if (!binding || binding.revision !== boundary.head) { valid = false; break; }
        if (fullCommit(binding.worktree, boundary.head) !== boundary.head || git(binding.worktree, ['rev-parse', 'HEAD']) !== boundary.head) { valid = false; break; }
        bindings.set(alias, binding);
      }
      if (valid) { selected = { row, bindings }; break; }
    }
    if (!selected) throw Error(`child doneWhen:${doneWhen} has no single accepted proving branch at the exact delivered head of every bound repository`);
    selections.push(selected);
    }
    selectedByGoal.set(doneWhen, selections);
  }

  const verifiedHeads = [];
  for (const boundary of [...boundaries.values()].sort((a, b) => a.alias.localeCompare(b.alias))) {
    const deliveryEvidence = [];
    let identity = null;
    for (const doneWhen of boundary.deliveryDoneWhen) {
      if (!proofRows.has(doneWhen)) throw Error(`repository ${boundary.alias}: deliveryDoneWhen:${doneWhen} is outside the child mission`);
      if (ancestors.has(childGoals[doneWhen]?.producedBy)) throw Error(`repository ${boundary.alias}: ancestral child doneWhen:${doneWhen} cannot stand in for current delivery evidence`);
      const candidates = (selectedByGoal.get(doneWhen) ?? []).filter(exact => exact.bindings.has(boundary.alias));
      if (!candidates.length) throw Error(`repository ${boundary.alias}: child doneWhen:${doneWhen} has no complete accepted delivery partitions`);
      for (const exact of candidates) {
      const binding = exact?.bindings.get(boundary.alias);
      if (!exact || !binding) throw Error(`repository ${boundary.alias}: child doneWhen:${doneWhen} has no accepted delivery proof at exact current head ${boundary.head}`);
      if (identity && identity !== binding.repositoryHash) throw Error(`repository ${boundary.alias}: exact delivery proofs resolve to different repositories`);
      identity = binding.repositoryHash;
      deliveryEvidence.push({ doneWhen, ref: exact.row.ref, fingerprint: exact.row.fingerprint });
      }
    }
    verifiedHeads.push({ alias: boundary.alias, head: boundary.head, repositoryHash: identity, deliveryEvidence });
  }
  const verifiedByAlias = new Map(verifiedHeads.map(item => [item.alias, item]));

  for (const [doneWhen, rows] of proofRows) {
    const operatorId = childGoals[doneWhen]?.producedBy;
    if (!ancestors.has(operatorId)) continue;
    const selections = [];
    for (const group of proofGroups(rows)) {
    const aliases = new Set(group.flatMap(row => row.bindings.map(binding => binding.alias)));
    let selected = null;
    for (const row of group) {
      const bindings = new Map();
      let valid = true;
      for (const alias of aliases) {
        const boundary = boundaries.get(alias);
        const verified = verifiedByAlias.get(alias);
        const binding = hydrate(row.bindings.find(item => item.alias === alias), hints);
        if (!binding || !verified || binding.repositoryHash !== verified.repositoryHash
          || !isAncestor(binding.worktree, binding.revision, boundary.head)) { valid = false; break; }
        bindings.set(alias, binding);
      }
      if (valid) { selected = { row, bindings }; break; }
    }
    if (!selected) throw Error(`child doneWhen:${doneWhen} has no single accepted proving branch in the declared repository ancestry of every bound repository: ${rows.refusals.join('; ')}`);
    selections.push(selected);
    }
    selectedByGoal.set(doneWhen, selections);
  }

  const evidence = [];
  for (const [doneWhen, rows] of [...proofRows.entries()].sort(([a], [b]) => a - b)) {
    for (const selected of selectedByGoal.get(doneWhen)) for (const alias of selected.bindings.keys()) {
      const boundary = boundaries.get(alias);
      const binding = selected.bindings.get(alias);
      evidence.push({ doneWhen, ref: selected.row.ref, fingerprint: selected.row.fingerprint,
        repository: { alias, revision: binding.revision, terminalHead: boundary.head,
          relation: binding.revision === boundary.head ? 'exact' : 'ancestor' } });
    }
  }
  return { heads: verifiedHeads, evidence };
}

export async function buildWorkflowVerification(root, branch, request, state, { hostRoot = path.dirname(root) } = {}) {
  const errors = workflowPeerSnapshotErrors(root, branch, request, state);
  if (errors.length) return { errors, report: null };
  const snapshotBytes = readFileSync(confined(branch, WORKFLOW_PEERS));
  const snapshot = JSON.parse(snapshotBytes);
  const policy = policyOf(root);
  const rule = policy.modes[workflowTopologyMode(policy, state)];
  const report = { version: snapshot.version, snapshotHash: sha(snapshotBytes), peers: [] };
  const { validateSession, goalLedger } = await import('./validate-session.mjs');
  const { sessionProofHash } = await import('./session-cleanup.mjs');
  for (const [taskId, peer] of Object.entries(snapshot.peers).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const session = await originalSession(hostRoot, peer.sessionId, request);
      const child = json(confined(session, 'state.json'));
      if (child.id !== peer.sessionId || child.hostBinding?.hostId !== taskId) throw Error('original session is not bound to the named peer task');
      if (child.mission?.goal !== peer.goal) throw Error('original peer goal differs from the frozen assignment');
      if (workflowTopologyMode(policy, child) !== rule.peerTopology) throw Error('peer must own the declared independent topology');
      if (Object.values(child.steps ?? {}).includes(WORKFLOW_OPERATOR)) throw Error('an independent peer cannot contain a portfolio verifier');
      if (child.contractVersion !== request.contractVersion || child.status !== 'done'
        || !['active', 'closed-success'].includes(child.lifecycle?.phase)) throw Error('peer outcome is not terminal success');
      if ((child.workerSlots ?? []).length || Object.keys(child.leases ?? {}).length || (child.brief?.blocked ?? []).length
        || Object.values(child.attempts ?? {}).some(attempt => ['running', 'waiting'].includes(attempt.status))) throw Error('peer retains unfinished work, a blocker or a worker lease');
      const checked = await validateSession(root, session, { uncheckedRoot: hostRoot });
      if (checked.errors.length) throw Error(`original session fails validation: ${checked.errors.join('; ')}`);
      const stateHash = sessionProofHash(child);
      const ledger = await goalLedger(session, child, root);
      const proofRows = new Map();
      for (let index = 0; index < child.mission.doneWhen.length; index++) {
        if (!(child.brief.proven ?? []).some(line => line.startsWith(`doneWhen:${index} `))) throw Error(`child doneWhen:${index} is not proven`);
        const legacy = snapshot.version === 1 ? { worktree: child.hostBinding?.worktree, head: peer.head } : null;
        const rows = await acceptedProofs(root, session, child, ledger, index, legacy);
        if (!rows.proofs.length || rows.requiredPartitions.some(member => !rows.proofs.some(proof => proof.partition === member))) throw Error(`child doneWhen:${index} has no complete validator-accepted original proof: ${rows.refusals.join('; ')}`);
        proofRows.set(index, rows);
      }
      let peerReport;
      if (snapshot.version === 1) {
        const evidence = [];
        for (const [index, rows] of proofRows) {
          const proof = legacyProof(peer, rows);
          if (!evidence.some(item => item.ref === proof.ref)) evidence.push(proof);
        }
        peerReport = { taskId, ...peer, stateHash, evidence };
      } else {
        const hints = acceptedWorkspaceHints(proofRows);
        const bounded = repositoryProof(peer, proofRows, child.mission.doneWhen, rule.ancestralEvidenceOperators, hints);
        peerReport = { taskId, sessionId: peer.sessionId, goal: peer.goal, owns: peer.owns, heads: bounded.heads,
          doneWhen: peer.doneWhen, stateHash, evidence: bounded.evidence };
      }
      if (sessionProofHash(json(confined(session, 'state.json'))) !== stateHash) throw Error('peer state changed during verification');
      const refs = new Set(snapshot.version === 1 ? peerReport.evidence.map(item => item.ref)
        : [...peerReport.evidence.map(item => item.ref), ...peerReport.heads.flatMap(item => item.deliveryEvidence.map(proof => proof.ref))]);
      for (const ref of refs) {
        const key = ref.replace('step-', '').replace('/parallel-', '/');
        const changed = await evidenceManifestErrors(confined(session, ref), child.attempts[key].evidenceManifest);
        if (changed.length) throw Error(changed.join('; '));
      }
      report.peers.push(peerReport);
    } catch (error) { errors.push(`workflow peer ${taskId}: ${error.message}`); }
  }
  if (!errors.length) try {
    const coordinatorSession = path.resolve(branch, '..', '..');
    const coordination = await buildCoordinationVerification(root, coordinatorSession, state, snapshot, report.peers, request);
    if (coordination) report.coordination = coordination;
  } catch (error) { errors.push(`workflow coordination: ${error.message}`); }
  if (sha(readFileSync(confined(branch, WORKFLOW_PEERS))) !== report.snapshotHash) errors.push('workflow peer snapshot changed during verification');
  return { errors, report: errors.length ? null : report };
}

export async function workflowReportErrors(root, branch, request, state, options) {
  const built = await buildWorkflowVerification(root, branch, request, state, options);
  if (built.errors.length) return built.errors;
  try {
    const actual = json(confined(branch, WORKFLOW_REPORT));
    const errors = validateAgainst(schema(root, 'workflow-verification-report'), actual, WORKFLOW_REPORT);
    if (canonical(actual) !== canonical(built.report)) errors.push('workflow verification report differs from the original verified peer outcomes');
    return errors;
  } catch (error) { return [`workflow verification report: ${error.message}`]; }
}

export async function workflowCompletionErrors(root, session, state) {
  const policy = policyOf(root);
  const rule = policy.modes[workflowTopologyMode(policy, state)];
  if (!rule?.completionOperator) return [];
  if (!(state.mission?.doneWhen ?? []).some(line => line.producedBy === rule.completionOperator)) return [`state.json: coordinated completion requires a doneWhen produced by ${rule.completionOperator}`];
  const failures = [];
  for (const [key, attempt] of Object.entries(state.attempts ?? {})) {
    if (attempt.status !== 'matched' || attempt.operatorId !== rule.completionOperator || !/^\d+\/\d+$/.test(key)) continue;
    const [n, m] = key.split('/');
    try {
      const branch = confined(session, `step-${n}/parallel-${m}`);
      const request = json(confined(branch, 'request/request.json'));
      if (state.requestHashes?.[key] !== sha(readFileSync(confined(branch, 'request/request.json')))) throw Error('coordinator verifier request no longer matches its frozen request hash');
      if (state.mission.doneWhen[request.goal?.doneWhen]?.producedBy !== rule.completionOperator) continue;
      const { validateStep } = await import('./validate-step.mjs');
      const checked = await validateStep(root, branch, { origin: true, operator: true, requestPhase: 'accept' });
      if (!checked.errors.length) return [];
      failures.push(...checked.errors);
    } catch (error) { failures.push(error.message); }
  }
  return ['state.json: coordinated completion requires a matched local verifier receipt over all current peer outcomes', ...failures];
}
