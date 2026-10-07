// The structural per-record concepts of the example Work standard (check-example-work.mjs): blocker edges,
// conflicts and tension, gaps, decisions, change kinds, done-needs-proof, appliesTo, events and implementation
// owners. Each rule is `(ctx, rec)` and appends to ctx.problems.
import fs from 'node:fs';
import path from 'node:path';
import { resolveRecordRef } from '../record-ownership.mjs';

/** Schemas whose `done` is an authored claim by nature (concept 6); every other schema needs proof or a declaration. */
const AUTHORED_CLAIM_SCHEMAS = new Set(['work/data@1', 'work/brand@1', 'work/policy-decision@1']);
const CHANGE_KINDS = new Set(['initial', 'editorial', 'clarifying', 'breaking']);
const DELIVERY_GUARANTEES = new Set(['at-least-once', 'at-most-once', 'exactly-once']);
const DELIVERY_ORDERINGS = new Set(['none', 'per-key', 'total']);

// ---- concept 1: blocker edges ----
function checkBlockedByEntry({ problems, recOf }, rec, entry) {
  if (typeof entry === 'string') {
    problems.push(`${rec.shown}: blockedBy carries a prose string ("${entry.slice(0, 60)}..."); every entry must be {record, rev?, because}`);
    return;
  }
  if (!entry || typeof entry !== 'object' || !entry.record) {
    problems.push(`${rec.shown}: blockedBy entry has no record id`);
    return;
  }
  const target = recOf(entry.record);
  if (!target) { problems.push(`${rec.shown}: blockedBy target ${entry.record} does not exist`); return; }
  if (target.state === 'done') {
    const targetRev = target.change?.rev;
    const stale = entry.rev == null || (typeof targetRev === 'number' && targetRev >= entry.rev);
    if (stale) problems.push(`${rec.shown}: blockedBy on ${entry.record} is stale - it is done at rev ${targetRev ?? '(none)'}, cited rev was ${entry.rev ?? '(none)'}`);
  }
}

function checkBlockerEdges(ctx, rec) {
  if (!Array.isArray(rec.data.blockedBy)) return;
  for (const entry of rec.data.blockedBy) checkBlockedByEntry(ctx, rec, entry);
}

// ---- concept 3: conflictsWith (pairwise) + tension (N-ary, policy-decision only) ----
function checkConflictsWith({ problems, recOf }, rec) {
  if (!Array.isArray(rec.data.conflictsWith)) return;
  for (const entry of rec.data.conflictsWith) {
    if (!entry || typeof entry !== 'object' || !entry.record) { problems.push(`${rec.shown}: conflictsWith entry has no record id`); continue; }
    const target = recOf(entry.record);
    if (!target) { problems.push(`${rec.shown}: conflictsWith target ${entry.record} does not exist`); continue; }
    if (entry.rev != null && target.change?.rev !== entry.rev) {
      problems.push(`${rec.shown}: conflictsWith cites ${entry.record} at rev ${entry.rev}, but it is now at rev ${target.change?.rev ?? '(none)'}`);
    }
  }
}

function checkTension({ problems, resolveMap, resolveInline }, rec) {
  const { data, schema } = rec;
  if (!data.tension) return;
  if (schema !== 'work/policy-decision@1') {
    problems.push(`${rec.shown}: tension is only authored on work/policy-decision@1, not ${schema}`);
    return;
  }
  const ids = Array.isArray(data.tension.records) ? data.tension.records : [];
  if (ids.length < 2) problems.push(`${rec.shown}: tension.records needs at least two record ids`);
  for (const tid of ids) if (!resolveRecordRef(resolveMap, tid, resolveInline)) problems.push(`${rec.shown}: tension.records names ${tid}, which no record owns`);
}

// ---- concept 2: gap family (closedBy is a list - a bare string is normalised to one) ----
function checkGapClosers({ problems, resolveMap, resolveInline, recOf }, rec) {
  const data = rec.data;
  const closers = (typeof data.closedBy === 'string' && [data.closedBy]) || (Array.isArray(data.closedBy) && data.closedBy) || null;
  if (!closers) {
    problems.push(`${rec.shown}: closedBy must be a record id or a list of record ids, not ${JSON.stringify(data.closedBy)}`);
    return;
  }
  const unresolved = closers.filter(c => !resolveRecordRef(resolveMap, c, resolveInline));
  for (const c of unresolved) problems.push(`${rec.shown}: closedBy names ${c}, which no record owns`);
  if (data.state === 'done' && !unresolved.length) {
    const notDone = closers.filter(c => recOf(c)?.state !== 'done');
    for (const c of notDone) problems.push(`${rec.shown}: work/gap@1 is done but closedBy's ${c} is ${recOf(c)?.state ?? '(no state)'}, not done - a gap is closed only once every one of its closers is`);
  }
}

function checkGap(ctx, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/gap@1') return;
  if (!['todo', 'done'].includes(data.state)) ctx.problems.push(`${rec.shown}: work/gap@1 state must be todo or done`);
  if (!data.statement) ctx.problems.push(`${rec.shown}: work/gap@1 needs a statement`);
  if (data.closedBy != null) checkGapClosers(ctx, rec);
}

// ---- concept 4: decision vocabulary ----
function checkPolicyDecision({ problems }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/policy-decision@1') return;
  if (!['open', 'decided'].includes(data.outcome)) {
    problems.push(`${rec.shown}: outcome must be open or decided, not "${data.outcome}" - the chosen option's id belongs in chosen, not invented into outcome`);
  } else if (data.outcome === 'decided') {
    const optionIds = Array.isArray(data.options) ? data.options.map(o => o.id) : [];
    if (!data.chosen) problems.push(`${rec.shown}: outcome is decided but chosen is missing`);
    else if (!optionIds.includes(data.chosen)) problems.push(`${rec.shown}: chosen "${data.chosen}" is not one of options [${optionIds.join(', ')}]`);
  }
  if ('targetModule' in data) problems.push(`${rec.shown}: targetModule is not part of the decision vocabulary - a decision's implementation site belongs on the implementation record that proves it`);
}

// ---- concept 5: change.kind is closed ----
function checkChangeKind({ problems }, rec) {
  const data = rec.data;
  if (data.change?.kind && !CHANGE_KINDS.has(data.change.kind)) {
    problems.push(`${rec.shown}: change.kind "${data.change.kind}" is not one of ${[...CHANGE_KINDS].join(', ')}`);
  }
}

// ---- concept 6: done means proven or says so ----
function checkDoneIsProven({ problems }, rec) {
  const data = rec.data;
  if (data.state !== 'done' || AUTHORED_CLAIM_SCHEMAS.has(rec.schema)) return;
  const hasEvidence = fs.existsSync(path.join(rec.dir, 'evidence.yaml'));
  const claims = data.verificationSource === 'authored-claim' && data.because;
  if (!hasEvidence && !claims) {
    problems.push(`${rec.shown}: state is done with no sibling evidence.yaml and no verificationSource: authored-claim + because`);
  }
}

// ---- concept 7: appliesTo is outbound, only on business-rule/sds-component ----
function checkAppliesTo({ problems, resolveMap, resolveInline }, rec) {
  const { data, schema } = rec;
  if (!('appliesTo' in data)) return;
  if (!['work/business-rule@1', 'work/sds-component@1'].includes(schema)) {
    problems.push(`${rec.shown}: appliesTo is only authored on work/business-rule@1 or work/sds-component@1, not ${schema}`);
    return;
  }
  for (const target of data.appliesTo) if (!resolveRecordRef(resolveMap, target, resolveInline)) problems.push(`${rec.shown}: appliesTo names ${target}, which no record owns`);
}

// ---- concept 8: events, data extends, timer transitions ----
function checkEvent({ problems, resolveMap, resolveInline }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/event@1') return;
  if (!data.producer || !resolveRecordRef(resolveMap, data.producer, resolveInline)) problems.push(`${rec.shown}: event producer "${data.producer}" does not resolve to a record`);
  if (!Array.isArray(data.payload) || !data.payload.length) problems.push(`${rec.shown}: event needs a non-empty payload`);
  const guarantee = data.delivery?.guarantee, ordering = data.delivery?.ordering;
  if (!DELIVERY_GUARANTEES.has(guarantee)) problems.push(`${rec.shown}: delivery.guarantee "${guarantee}" is not one of ${[...DELIVERY_GUARANTEES].join(', ')}`);
  if (!DELIVERY_ORDERINGS.has(ordering)) problems.push(`${rec.shown}: delivery.ordering "${ordering}" is not one of ${[...DELIVERY_ORDERINGS].join(', ')}`);
}

function checkSubscribes({ problems, recOf }, rec) {
  if (!Array.isArray(rec.data.subscribes)) return;
  for (const eid of rec.data.subscribes) {
    const target = recOf(eid);
    if (!target) problems.push(`${rec.shown}: subscribes names ${eid}, which no record owns`);
    else if (target.schema !== 'work/event@1') problems.push(`${rec.shown}: subscribes names ${eid}, which is a ${target.schema}, not a work/event@1`);
  }
}

function checkDataExtends({ problems, recOf }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/data@1' || !data.extends) return;
  const base = recOf(data.extends);
  if (!base) problems.push(`${rec.shown}: extends names ${data.extends}, which no record owns`);
  else if (base.schema !== 'work/data@1') problems.push(`${rec.shown}: extends names ${data.extends}, which is a ${base.schema}, not a work/data@1`);
}

function checkTimerTransitions({ problems }, rec) {
  const transitions = rec.data.stateMachine?.transitions;
  if (!transitions) return;
  for (const t of transitions) {
    if (t.on && typeof t.on === 'object' && !('timer' in t.on)) {
      problems.push(`${rec.shown}: transition ${t.id ?? '(unnamed)'}'s on is an object but not {timer: ...}`);
    }
  }
}

// ---- concept 9: implementation owners ----
function checkImplementationOwners({ problems }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/implementation@1') return;
  if ('directory' in data || 'files' in data || 'targetFiles' in data) {
    problems.push(`${rec.shown}: work/implementation@1 carries directory/files/targetFiles, which are not part of the contract; use owners: [{role, path}]`);
  }
  if (data.owners) {
    for (const owner of data.owners) {
      if (!owner?.role || !owner?.path) problems.push(`${rec.shown}: owners entry missing role or path`);
    }
  }
}

function checkBusinessRuleModule({ problems }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/business-rule@1' || !('module' in data)) return;
  const m = data.module;
  const ok = typeof m === 'string' ? m.length > 0 : Array.isArray(m) && m.length > 0 && m.every(x => typeof x === 'string' && x.length > 0);
  if (!ok) problems.push(`${rec.shown}: business-rule module must be a non-empty string or a non-empty list of strings`);
}

/** The structural rules in the order they run for each record. */
export const structureRules = [
  checkBlockerEdges, checkConflictsWith, checkTension, checkGap, checkPolicyDecision, checkChangeKind, checkDoneIsProven,
  checkAppliesTo, checkEvent, checkSubscribes, checkDataExtends, checkTimerTransitions, checkImplementationOwners, checkBusinessRuleModule,
];
