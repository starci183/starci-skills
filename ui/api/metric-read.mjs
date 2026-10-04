import { getBlob } from '../../engine/db/blob.mjs';

/** Recorded snapshots only; a failed indexed payload never falls back to another representation. */
export function readMetricSnapshot(machine, kind, ledgerId, workflowId, now = Date.now()) {
  const row = machine.latestMetrics({ kind, ledgerId, workflowId });
  if (!row) return null;
  const payload = JSON.parse(row.data_sha ? getBlob(row.data_sha).toString('utf8') : row.data_json);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Metric snapshot has no object payload');
  const at = Number.isFinite(row.at) ? row.at : null;
  return {
    snapshot: { id: row.snap_id, kind: row.kind, ledgerId: row.ledger_id, workflowId: row.workflow_id,
      at, windowMs: row.window_ms, subject: row.subject, dataSha: row.data_sha,
      payloadSource: row.data_sha ? 'blob' : 'inline', ageMs: at != null && at <= now ? now - at : null },
    payload,
  };
}

export function metricPayload(snapshot, schema) {
  if (snapshot && snapshot.payload.schema !== schema) throw new Error(`Unsupported metric snapshot schema: ${snapshot.payload.schema ?? 'missing'}`);
  if (snapshot) {
    const data = snapshot.payload;
    const numbers = (value, keys) => value && keys.every(key => Number.isFinite(value[key]));
    const valid = schema === 'starci/rca@1' ? numbers(data, ['attempts', 'windowMs']) && Array.isArray(data.clusters)
      && data.clusters.every(cluster => numbers(cluster, ['count', 'open']) && typeof cluster.cause === 'string' && typeof cluster.why === 'string' && typeof cluster.authority === 'string')
      && (data.actions === undefined || Array.isArray(data.actions))
      : schema === 'starci/proof-coverage@1' ? numbers(data.summary, ['total', 'proven', 'stale', 'missing', 'mustOwed'])
      : schema === 'starci/proof-verify@1' ? typeof data.ok === 'boolean' && numbers(data.files, ['checked', 'intact', 'unchained']) && numbers(data.chain, ['events']) && typeof data.chain.ok === 'boolean'
      : schema === 'starci/progress@1' ? numbers(data, ['unitsPerHour', 'minUnitsPerHour']) && (data.eta === null || typeof data.eta === 'string')
      : false;
    if (!valid) throw new Error(`Invalid metric snapshot payload: ${schema}`);
  }
  return snapshot?.payload ?? null;
}
