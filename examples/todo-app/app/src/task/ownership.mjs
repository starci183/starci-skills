/**
 * The guard of sds.task.ownership-guard and the rule br.task.single-owner. Two transitions: t-owner
 * lets the write through, t-stranger refuses before anything is written. It consumes
 * contract.login.identity-for-task, so a null actor is a refusal and never an invented person.
 */
export function guardOwnership({actor, task}) {
  if (!actor || !actor.personId) return {allowed: false, reason: 'unauthenticated'};
  if (!task) return {allowed: false, reason: 'unknown task'};
  return actor.personId === task.owner
    ? {allowed: true, transition: 't-owner'}
    : {allowed: false, reason: 'not the owner', transition: 't-stranger'};
}

export function createTaskStore() {
  const rows = new Map();
  return {
    create({actor, title}) {
      if (!actor || !actor.personId) return {ok: false, reason: 'unauthenticated'};
      const trimmed = String(title ?? '').trim();
      if (!trimmed) return {ok: false, reason: 'title is required'};
      const id = `t${rows.size + 1}`;
      rows.set(id, {id, owner: actor.personId, title: trimmed, complete: false, completedAt: null});
      return {ok: true, task: {...rows.get(id)}};
    },
    remove({actor, id}) {
      const verdict = guardOwnership({actor, task: rows.get(id)});
      if (!verdict.allowed) return {ok: false, reason: verdict.reason};
      rows.delete(id);
      return {ok: true};
    },
    listFor(personId) { return [...rows.values()].filter(row => row.owner === personId); },
    get(id) { const row = rows.get(id); return row ? {...row} : null; }
  };
}

