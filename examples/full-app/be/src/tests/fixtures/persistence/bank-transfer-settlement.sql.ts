import { sql } from "@modules/platform/database"
import type { CountRow, RowQuery } from "./e2e-verification.rows"

/** The committed receipt of one order ($1 order id), including the identity replayed by the reactor. */
export const TRANSFER_RECEIPT_OF_ORDER: RowQuery<{
    event_id: string
    provider_reference: string
}> = {
    text: sql`SELECT event_id, envelope::jsonb -> 'payload' ->> 'referenceCode' AS provider_reference
    FROM event_outbox WHERE event_name = 'billing.bank-transfer-received'
    AND envelope::jsonb -> 'payload' ->> 'code' = $1 ORDER BY id LIMIT 1`,
}

/** Publishes another receipt after the replay, retaining its partition key ($1 original event id, $2 marker event id). */
export const APPEND_SETTLEMENT_MARKER = sql`INSERT INTO event_outbox (event_id, event_name, topic, message_key, envelope, created_at)
    SELECT $2::text, event_name, topic, message_key,
        jsonb_set(jsonb_set(envelope::jsonb, '{eventId}', to_jsonb($2::text)), '{payload,eventId}', to_jsonb($2::text)), created_at
    FROM event_outbox WHERE event_id = $1 ORDER BY id LIMIT 1`

/** The processing claim of one receipt ($1 event id); the marker proves the preceding replay has been consumed. */
export const SETTLEMENT_CLAIM_COUNT: RowQuery<CountRow> = {
    text: sql`SELECT count(*)::int AS count FROM inbox_claims
    WHERE source = 'billing.bank-transfer-received' AND event_id = $1`,
}
