// event-payload.mjs — the payload of one ledger event row, whole (the engine tier: scripts call down to it): a payload over the inline bound lives in the blob store (events.payload_sha)
// and its row keeps no inline JSON, so a reader of such an event goes through here and never reads payload_json alone.
import { parseJson } from '../../scripts/lib/json.mjs';
import { getBlob } from './blob.mjs';

/** The payload of an events row ({payload_json, payload_sha}); null when the row has none. */
export function eventPayloadOf(row, { root = null } = {}) {
  return row?.payload_sha ? JSON.parse(getBlob(row.payload_sha, { root }).toString('utf8')) : parseJson(row?.payload_json) ?? null;
}
