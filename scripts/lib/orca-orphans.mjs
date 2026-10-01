// orca-orphans.mjs — pure logic of the Orca worktree orphan scan (lane ORPHAN2, deep map REPLACE #5 WT4). No process,
// no file and no database access here: scripts/lib/worktrees.mjs gcWorktrees feeds it Orca's `worktree ps` rows and
// the registry, and acts on its verdicts.
//
//   stamp     every Orca worktree the runtime creates carries an ownership comment in Orca's metadata
//             (`orca worktree create --comment`): `starci:<kind>:<slot>` plus `;wf=<workflow>`, `;job=<job>` and
//             `;ledger=<ledger>` when known, each value URI-encoded. The stamp is written by the same call that creates
//             the tree, so a crash between Orca's create and the registry bind leaves a tree that is still recognisably
//             the runtime's.
//   ownership a tree with no stamp (a lane, a human's tree, another tool's) is FOREIGN and never touched, whatever its
//             path or branch. Ownership is never guessed from a name or a folder.
//   verdict   orphanVerdict judges a stamped tree with no live registry row from its owner's state: collect (preserve,
//             then remove link-safely), adopt (register it, so its owner's next lookup finds it), or keep for now.
//   coverage  Orca's page covers the hosts in hostScope; an omitted host or a truncated page proves nothing about a
//             tree it does not list (psCoverage).

/** The stamp's prefix: the runtime's mark in Orca's worktree comment. */
export const RUNTIME_STAMP_PREFIX = 'starci';
/**
 * The kinds the runtime stamps: the Orca kinds (scripts/lib/worktree-registry.mjs ORCA_KINDS) and the [Worker] staging
 * checkout (supervisor-staging, owned by a Supervisor job: its `sup` field), which lane WSTAGE moves to Orca.
 */
export const STAMPED_KINDS = Object.freeze(['workflow', 'critic', 'supervisor-staging']);
const STAMPED = new Set(STAMPED_KINDS);
const OWNER_FIELDS = Object.freeze([['wf', 'workflowId'], ['job', 'jobId'], ['ledger', 'ledgerId'], ['sup', 'supJobId']]);

const enc = (v) => encodeURIComponent(String(v));
const dec = (v) => { try { return decodeURIComponent(v); } catch { return null; } };

/**
 * The ownership comment of a runtime Orca worktree: `starci:<kind>:<slot>[;wf=..][;job=..][;ledger=..][;sup=..]`.
 * kind: one of STAMPED_KINDS; slot: the owner's slot key (a workflow id, a critic name, a staging job); owner:
 * {workflowId, jobId, ledgerId, supJobId}.
 */
export function runtimeStampOf({ kind, slot, owner = {} }) {
  if (!STAMPED.has(kind)) throw new Error(`runtimeStampOf: ${kind} is not a stamped Orca kind`);
  if (!slot) throw new Error('runtimeStampOf: a slot key is required');
  const fields = OWNER_FIELDS.filter(([, k]) => owner?.[k] != null && owner[k] !== '').map(([f, k]) => `;${f}=${enc(owner[k])}`);
  return `${RUNTIME_STAMP_PREFIX}:${kind}:${enc(slot)}${fields.join('')}`;
}

const STAMP = /^starci:(workflow|critic|supervisor-staging):([^;\s]+)((?:;[a-z]+=[^;\s]*)*)$/;

/** {kind, slot, workflowId, jobId, ledgerId, supJobId} of a runtime stamp, or null for any other comment (a foreign tree). */
export function parseRuntimeStamp(comment) {
  const m = STAMP.exec(String(comment ?? '').trim());
  if (!m) return null;
  const slot = dec(m[2]);
  if (!slot) return null;
  const out = { kind: m[1], slot, workflowId: null, jobId: null, ledgerId: null, supJobId: null };
  for (const part of m[3].split(';').filter(Boolean)) {
    const [f, v] = part.split('=');
    const k = OWNER_FIELDS.find(([name]) => name === f)?.[1];
    if (!k) return null;
    const value = dec(v);
    if (value == null) return null;
    out[k] = value || null;
  }
  return out;
}

/**
 * What one `worktree ps` page proves. complete: the page lists every tree of the covered hosts (not truncated, no host
 * omitted), so a registered tree absent from it is really gone from Orca. covered(hostId): the page covers that host.
 */
export function psCoverage(ps) {
  const omitted = new Set((ps?.omittedHostIds ?? []).map(String));
  const covered = (hostId) => !omitted.has(String(hostId ?? 'local'));
  return { ok: ps?.ok === true, complete: ps?.ok === true && ps.truncated !== true && omitted.size === 0, covered };
}

/** The `preserved/orphan/<id>` name of an orphan's work: its slot and a short digest of Orca's id (ids hold ':'). */
export function orphanPreserveName({ slot, orcaId, digest }) {
  const safe = String(slot ?? 'tree').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[.-]+/, '').slice(0, 80) || 'tree';
  return `orphan/${safe}-${digest(String(orcaId)).slice(0, 10)}`;
}

/**
 * The verdict on a STAMPED Orca tree that has no live registry row. Pure over its inputs.
 *   stamp           parseRuntimeStamp of its comment (null: foreign -> {verdict: 'foreign'}, never touched)
 *   inFlight        a fresh (not stale) pending slot of the same kind and slot exists: its creation is still running
 *   liveTerminals   Orca's liveTerminalCount of the tree: an agent still works in it
 *   workflowPhase   the stamped workflow's phase (a workflow tree), null when no ledger knows it
 *   jobStatus       the stamped owner job's status: a critic's op job (its ledger), a staging tree's Supervisor job
 *                   (machine.sqlite sup_jobs); null when nothing knows it. settledStatuses: the settled job statuses (engine/admission.mjs
 *                   SETTLED_JOB_LIST, which holds a Supervisor job's final statuses too)
 *   ageMs           how long the tree has existed without a row; ownerGoneMs the unknown-owner grace
 * {verdict: 'foreign'|'in-flight'|'keep'|'adopt'|'collect', owner?: 'ended'|'unknown'|'live'}
 */
export function orphanVerdict({ stamp, inFlight = false, liveTerminals = 0, workflowPhase = null, jobStatus = null, ageMs = 0, ownerGoneMs, endedPhases, settledStatuses }) {
  if (!stamp) return { verdict: 'foreign' };
  if (inFlight) return { verdict: 'in-flight' };
  const aged = Number(ageMs) > Number(ownerGoneMs);
  if (Number(liveTerminals) > 0) return { verdict: 'adopt', owner: 'live' };
  if (stamp.kind === 'workflow') {
    if (workflowPhase && endedPhases.has(workflowPhase)) return { verdict: 'collect', owner: 'ended' };
    if (workflowPhase) return { verdict: 'adopt', owner: 'live' };
    return aged ? { verdict: 'collect', owner: 'unknown' } : { verdict: 'keep', owner: 'unknown' };
  }
  if (jobStatus && settledStatuses.has(jobStatus)) return { verdict: 'collect', owner: 'ended' };
  if (jobStatus) return { verdict: 'adopt', owner: 'live' };
  return aged ? { verdict: 'collect', owner: 'unknown' } : { verdict: 'keep', owner: 'unknown' };
}
