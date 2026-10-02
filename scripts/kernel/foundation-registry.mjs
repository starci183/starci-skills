// foundations.mjs — the ledger-level registry of SHARED FOUNDATIONS across the workflows of one
// ledger (api foundations / api foundation).
//
// Owner, 2026-09-24: workflows that share one repository planned independently and discovered
// their shared foundations mid-flight - the layout tree/shell, the brand, the @starci/grammar
// version, shared modules - so one workflow's leg sat blocked on another's foundation with no
// record of who owned it (one product's Collab workflow held on Modules' shell rev; another's brand.decide
// waited on its base-repos peer's Grammar install for 23h). A foundation is one row: an OWNER workflow, a state
// (unclaimed -> claimed -> landed) and its dependents. Landing it notifies every dependent and
// releases every typed wait on it (api incident --kind peer-wait --until-foundation <name>).
//
// Storage is the ledger's `foundations` table (one row per name; `detail` keeps the whole FOUNDATION_SCHEMA
// record as JSON text: the row's columns carry kind, state, owner and version for SQL readers) and
// `foundation_declarations` (one row per workflow: builds_none, and the {none, detail, at} value as JSON
// text), written through engine/db/ledger.mjs upsertFoundation / declareFoundations.
// Every write also appends an event on the acting workflow (entity_type 'foundation').
import { parseJson } from '../lib/json.mjs';
import { declareFoundations, upsertFoundation } from '../../engine/db/ledger.mjs';

export const FOUNDATION_SCHEMA = 'starci/foundation@1';
export const FOUNDATION_KINDS = ['layout-tree', 'brand', 'grammar', 'module', 'contract', 'baseline', 'scaffold', 'other'];
// The contract change that introduced foundation planning (modules/kernel/contract-changes/):
// a workflow created after it must declare before its first leg; an older one is told, not held.
export const FOUNDATION_CHANGE_ID = 'shared-foundation-planning';
const NAME_RX = /^[a-z0-9][a-z0-9._@/-]{0,79}$/;

const fail = (message, code, extra = {}) => { throw Object.assign(new Error(message), { code, ...extra }); };

export function normalizeFoundationName(name) {
  const value = String(name ?? '').trim().toLowerCase();
  if (!NAME_RX.test(value)) fail(`foundation name '${name}' must be a lowercase slug (a-z 0-9 . _ @ / -), at most 80 characters`, 'foundation-name-invalid');
  return value;
}

const recordOf = (row) => {
  const value = parseJson(row?.detail ?? '');
  return value?.schema === FOUNDATION_SCHEMA ? value : null;
};
export const readFoundation = (db, name) => recordOf(db.prepare('SELECT detail FROM foundations WHERE name=?').get(name));
export const readFoundations = (db) => db.prepare('SELECT detail FROM foundations ORDER BY name').all().map(recordOf).filter(Boolean);
export const writeFoundation = (db, record, now = Date.now()) => upsertFoundation(db, { name: record.name, kind: record.kind, state: record.state,
  ownerWorkflow: record.owner?.workflowId ?? null, version: record.version ?? null, detail: record, at: now });

export const readDeclaration = (db, workflowId) => parseJson(db.prepare('SELECT detail FROM foundation_declarations WHERE workflow_id=?').get(workflowId)?.detail ?? '');
export const writeDeclaration = (db, workflowId, value, now = Date.now()) => declareFoundations(db, { workflowId, buildsNone: value?.none === true, detail: value, at: now });

/** What one workflow declared: the foundations it owns and needs, and whether it declared at all. */
export function declarationsOf(db, workflowId, foundations = readFoundations(db)) {
  const owns = foundations.filter((f) => f.owner?.workflowId === workflowId);
  const needs = foundations.filter((f) => (f.dependents ?? []).some((d) => d.workflowId === workflowId));
  const marker = readDeclaration(db, workflowId);
  return { declared: Boolean(marker) || owns.length > 0 || needs.length > 0, none: marker?.none === true && !owns.length && !needs.length, owns, needs, marker };
}

const blank = (name, now) => ({ schema: FOUNDATION_SCHEMA, name, kind: 'other', detail: null, state: 'unclaimed', owner: null, version: null, landed: null, dependents: [], history: [], createdAt: now, updatedAt: now });
const remember = (record, entry) => ({ ...record, history: [...(record.history ?? []), entry].slice(-20) });

/**
 * Claim a foundation for `workflowId`. A foundation another RUNNING workflow owns is refused
 * (foundation-owned); one whose owner stopped running passes to the claimant (transferredFrom). A
 * claim on a landed foundation re-opens it for a new version (the landing stays in history).
 */
export function claimFoundation(existing, { name, workflowId, ownerRunning, kind = null, detail = null, version = null, now = Date.now() }) {
  if (kind != null && !FOUNDATION_KINDS.includes(kind)) fail(`--kind must be ${FOUNDATION_KINDS.join('|')}, got '${kind}'`, 'foundation-kind-invalid');
  const record = existing ?? blank(name, now);
  const priorOwner = record.owner?.workflowId ?? null;
  if (priorOwner && priorOwner !== workflowId && ownerRunning) {
    fail(`foundation ${name} is owned by running workflow ${priorOwner}; declare this workflow a dependent (api foundation --declare-dependent ${name}) or agree a handoff with that peer (api notify --kind handoff)`, 'foundation-owned', { owner: priorOwner });
  }
  const reopen = record.state === 'landed' && (version == null || version !== record.version);
  let next = {
    ...record, kind: kind ?? record.kind, detail: detail ?? record.detail, version: version ?? record.version,
    owner: { workflowId, claimedAt: priorOwner === workflowId ? record.owner.claimedAt : now },
    state: record.state === 'landed' && !reopen ? 'landed' : 'claimed', updatedAt: now,
    // A dependent that becomes the owner no longer waits on itself.
    dependents: (record.dependents ?? []).filter((d) => d.workflowId !== workflowId),
  };
  if (reopen) next = { ...next, landed: null };
  const transferredFrom = priorOwner && priorOwner !== workflowId ? priorOwner : null;
  next = remember(next, { at: now, event: 'claimed', by: workflowId, ...(transferredFrom ? { transferredFrom } : {}), ...(reopen ? { reopenedFrom: record.version } : {}) });
  return { record: next, transferredFrom, reopened: reopen, idempotent: priorOwner === workflowId && !reopen && record.state === next.state };
}

/** Record `workflowId` as a dependent of a foundation, creating it unclaimed when nobody registered it yet. */
export function declareDependent(existing, { name, workflowId, detail = null, now = Date.now() }) {
  const record = existing ?? blank(name, now);
  if (record.owner?.workflowId === workflowId) fail(`workflow ${workflowId} owns foundation ${name}; an owner is not its own dependent`, 'foundation-self-dependent');
  const already = (record.dependents ?? []).find((d) => d.workflowId === workflowId);
  const dependents = already
    ? record.dependents.map((d) => (d.workflowId === workflowId ? { ...d, detail: detail ?? d.detail } : d))
    : [...(record.dependents ?? []), { workflowId, detail, at: now }];
  return { record: remember({ ...record, dependents, updatedAt: now }, { at: now, event: 'dependent-declared', by: workflowId }), idempotent: Boolean(already) };
}

/** Land a foundation: only its owner may, with the proof of what landed. */
export function landFoundation(existing, { name, workflowId, proof, version = null, refs = [], now = Date.now() }) {
  if (!existing) fail(`foundation ${name} is not registered; claim it first (api foundation --claim ${name})`, 'foundation-unknown');
  if (existing.owner?.workflowId !== workflowId) {
    fail(`foundation ${name} is ${existing.owner ? `owned by ${existing.owner.workflowId}` : 'unclaimed'}; only its owner lands it (claim it first when its owner stopped running)`, 'foundation-not-owner', { owner: existing.owner?.workflowId ?? null });
  }
  const text = String(proof ?? '').trim();
  if (!text) fail('a landing names its proof: --proof <what landed and how it was checked: a commit, a published version, a record rev>', 'foundation-proof-missing');
  const landedVersion = version ?? existing.version ?? null;
  const idempotent = existing.state === 'landed' && existing.version === landedVersion;
  const record = remember({ ...existing, state: 'landed', version: landedVersion, landed: { at: now, by: workflowId, version: landedVersion, proof: text, refs }, updatedAt: now },
    { at: now, event: 'landed', by: workflowId, version: landedVersion });
  return { record, idempotent };
}
