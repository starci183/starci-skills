import path from 'node:path';

export function appendReviewRow(db, row, workflowId, repo, classified, byRecord, { decisions, notesOfReceipt, goldenMarkOf, list, slash, readJsonFile }) {
  let rj = {};
  try { rj = JSON.parse(row.report_json ?? '{}') ?? {}; } catch { rj = {}; }
  const review = rj.question?.review;
  if (!review?.record) return;
  const closed = db.prepare(`SELECT kind, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded')
    AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, row.dispatch_id);
  let answer = null;
  if (closed?.kind === 'ask-answered') {
    const payload = (() => { try { return JSON.parse(closed.payload_json ?? '{}'); } catch { return {}; } })();
    answer = (payload.receiptPath ? readJsonFile(path.resolve(repo ?? '.', payload.receiptPath)) : null) ?? { ...payload, review };
    answer.review ??= review;
    answer.at ??= new Date(Number(closed.created_at)).toISOString();
  }
  const entry = byRecord.get(review.record) ?? { record: review.record, recordPath: review.recordPath ?? null, rounds: [] };
  const notes = answer ? notesOfReceipt(answer).map((n) => {
    const c = classified.get(n.id);
    return { id: n.id, text: n.text, shape: n.shape, part: n.part, owed: n.owed, class: c?.class ?? n.class, target: c?.target ?? n.target, classifiedBy: c?.by ?? n.classifiedBy };
  }) : [];
  entry.rounds.push({ round: entry.rounds.length + 1, dispatchId: row.dispatch_id, jobId: rj.from ?? null, askedAt: row.created_at,
    state: ({ true: 'answered', false: closed ? 'superseded' : 'open' })[closed?.kind === 'ask-answered'],
    decision: answer ? decisions[Number(answer.optionIndex)] ?? null : null, answeredBy: answer?.answeredBy ?? null, answeredAt: answer?.at ?? null,
    golden: Boolean(answer && goldenMarkOf(answer)), parts: list(review.parts).map((p) => ({ path: slash(p.path), sha256: p.sha256 ?? null, shape: p.shape ?? null, breakpoint: p.breakpoint ?? null })), notes });
  byRecord.set(review.record, entry);
}

export function completeReviewEntry(entry, repo, { owner, noteAddressed, reviewShapesOf, stateKey, list, slash, readYaml }) {
  const dir = entry.recordPath && repo ? path.dirname(path.resolve(repo, entry.recordPath)) : null;
  let record = null;
  try { record = dir ? readYaml(path.join(dir, 'index.yaml')) : null; } catch { record = null; }
  const lastAccept = Math.max(0, ...entry.rounds.filter((r) => r.decision === 'accept' && r.answeredBy === owner).map((r) => r.round));
  const open = entry.rounds.filter((r) => r.round > lastAccept && r.decision === 'redraw').flatMap((r) => r.notes.filter((n) => n.owed).map((n) => ({ ...n, round: r.round, dispatchId: r.dispatchId, seen: r.parts })));
  const judged = open.map((n) => ({ ...n, ...(record && dir ? noteAddressed(dir, record, n) : { addressed: false, reasons: ['the ui record is not readable'] }) }));
  const latest = entry.rounds[entry.rounds.length - 1];
  const shapeNames = [...new Set([...(record ? reviewShapesOf(record).shapes.map((s) => s.shape) : []), ...entry.rounds.flatMap((r) => r.parts.map((p) => p.shape)).filter(Boolean)])];
  const goldenMark = record?.ui?.review?.golden ?? null;
  entry.shapes = shapeNames.map((shape) => {
    const mine = judged.filter((n) => !n.shape || stateKey(n.shape) === stateKey(shape));
    const lastRound = [...entry.rounds].reverse().find((r) => r.parts.some((p) => p.shape === shape));
    return { shape, round: lastRound?.round ?? null, parts: lastRound?.parts.filter((p) => p.shape === shape) ?? [],
      openNotes: mine.map(({ id, text: t, round, class: cls, addressed, reasons }) => ({ id, text: t, round, class: cls, addressed, reasons })),
      addressed: mine.filter((n) => n.addressed).length, unaddressed: mine.filter((n) => !n.addressed).length,
      golden: ({ 0: lastAccept ? 'accepted' : 'none', 1: 'golden' })[Number(Boolean(goldenMark && list(goldenMark.shapes).includes(shape)))] };
  });
  entry.awaitingOwner = latest?.state === 'open';
  entry.redrawOwed = latest?.state === 'answered' && latest.decision === 'redraw' ? { dispatchId: latest.dispatchId, jobId: latest.jobId, notes: latest.notes.map((n) => n.id) } : null;
  entry.state = [[entry.awaitingOwner, 'awaiting-owner'], [entry.redrawOwed, 'redraw-owed'], [lastAccept && lastAccept === latest?.round, 'accepted'], [true, 'idle']].find(([condition]) => condition)[1];
  return entry;
}
