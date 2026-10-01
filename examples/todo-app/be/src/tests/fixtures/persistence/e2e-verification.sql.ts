import { sql } from "@modules/platform/database"

/**
 * The out-of-band SQL of the e2e suite: what a spec reads from (or, in two places, ages in) the run-owned postgres to
 * prove that a flow really persisted. Every value is a `$n` parameter; every multi-row read is bounded.
 */

/** Answers while the connection is alive. */
export const PING_DATABASE = sql`SELECT 1 AS alive`

/** The tables of the public schema: what apps/migrate created. */
export const PUBLIC_TABLES = sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 500`

/** One session by token ($1). */
export const SESSION_BY_TOKEN = sql`SELECT token, person_id FROM sessions WHERE token = $1`

/** The sessions among a list of tokens ($1 text array). */
export const SESSIONS_BY_TOKENS = sql`SELECT token, person_id FROM sessions WHERE token = ANY($1) LIMIT 100`

/** How many sessions carry this token ($1). */
export const SESSION_COUNT_BY_TOKEN = sql`SELECT count(*)::int AS count FROM sessions WHERE token = $1`

/** Ages one session one second past its expiry ($1 token); an UPDATE answers `[rows, rowCount]`. */
export const EXPIRE_SESSION = sql`UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token = $1 RETURNING token`

/** One task by id ($1). */
export const TASK_BY_ID = sql`SELECT id, owner, title, complete, completed_at FROM tasks WHERE id = $1`

/** The audit key rows of one person ($1). */
export const AUDIT_KEYS_OF_PERSON = sql`SELECT person_id, key_id FROM audit_keys WHERE person_id = $1`

/** The audit key rows that belong to a person ($1) or carry a key id ($2). */
export const AUDIT_KEYS_OF_PERSON_OR_KEY = sql`SELECT person_id, key_id FROM audit_keys WHERE person_id = $1 OR key_id = $2`

/** The audit key row of one key id ($1). */
export const AUDIT_KEY_BY_ID = sql`SELECT person_id, key_id FROM audit_keys WHERE key_id = $1`

/** How many log lines are stored under one key ($1). */
export const AUDIT_LINE_COUNT_UNDER_KEY = sql`SELECT count(*)::int AS count FROM audit_log_lines WHERE key_id = $1`

/** The log lines stored under one key ($1) in append order. */
export const AUDIT_LINES_UNDER_KEY = sql`SELECT action, target, key_id, actor FROM audit_log_lines WHERE key_id = $1 ORDER BY id LIMIT 500`

/**
 * The system erasure lines that name one request ($1), in the order the transitions happened (`at`, the instant each
 * line records). Append order (`id`) is not that order: the lines arrive through the outbox, which delivers each message
 * at least once but in no promised order, so two transitions close together can be appended either way round.
 */
export const AUDIT_ERASURE_LINES_OF_REQUEST = sql`SELECT action, target, key_id, actor FROM audit_log_lines
    WHERE action IN ('audit.erasure.requested', 'audit.erasure.completed') AND target = $1 ORDER BY at, id LIMIT 10`

/** The hash chain of the whole log in append order. */
export const AUDIT_CHAIN = sql`SELECT id, prev_hash, hash FROM audit_log_lines ORDER BY id LIMIT 1000`

/** One erasure request by id ($1). */
export const AUDIT_ERASURE_REQUEST = sql`SELECT request_id, person_id, state, verified_at::text AS verified_at,
    executing_at::text AS executing_at, completed_at::text AS completed_at FROM audit_erasure_requests WHERE request_id = $1`

/** The notifications of one recipient ($1) about one completed task ($2). */
export const TASK_COMPLETE_NOTIFICATIONS = sql`SELECT id, digest_group_id FROM notify_notifications
    WHERE recipient_id = $1 AND kind = 'task-complete' AND payload->>'taskId' = $2 LIMIT 10`

/** The delivery attempts of one notification ($1). */
export const DELIVERY_ATTEMPTS_OF_NOTIFICATION = sql`SELECT state, attempt, failure_class, history FROM notify_delivery_attempts
    WHERE notification_id = $1 LIMIT 10`

/** The task-complete notifications of one recipient ($1) about one task ($2) joined to their delivery attempt. */
export const TASK_COMPLETE_WITH_ATTEMPT = sql`SELECT n.id, n.digest_group_id, a.state, a.attempt, a.failure_class, a.history
    FROM notify_notifications n JOIN notify_delivery_attempts a ON a.notification_id = n.id
    WHERE n.recipient_id = $1 AND n.kind = 'task-complete' AND n.payload->>'taskId' = $2 LIMIT 10`

/** The subscriptions of one person ($1). */
export const SUBSCRIPTIONS_OF_PERSON = sql`SELECT id, plan, status FROM subscriptions WHERE person_id = $1 LIMIT 10`

/** One payment intent by id ($1). */
export const PAYMENT_INTENT_BY_ID = sql`SELECT id, subscription_id, gateway_intent_id, status FROM payment_intents WHERE id = $1`

/** The payment intents of the subscription of one person ($1). */
export const PAYMENT_INTENTS_OF_PERSON = sql`SELECT pi.id, pi.subscription_id, pi.gateway_intent_id, pi.status
    FROM payment_intents pi JOIN subscriptions s ON s.id = pi.subscription_id WHERE s.person_id = $1 LIMIT 100`

/** The end instant of one recurrence rule ($1). */
export const RULE_ENDED_AT = sql`SELECT ended_at FROM recurrence_rules WHERE id = $1`

/** How many occurrences of one rule ($1) sit in each status. */
export const OCCURRENCE_COUNTS_BY_STATUS = sql`SELECT status, count(*)::int AS count FROM occurrences
    WHERE rule_id = $1 GROUP BY status ORDER BY status LIMIT 10`

/** How many occurrences of one rule ($1) are dated after a local date ($2). */
export const OCCURRENCE_COUNT_AFTER = sql`SELECT count(*)::int AS count FROM occurrences WHERE rule_id = $1 AND local_date > $2`

/** One invitation by id ($1). */
export const INVITATION_BY_ID = sql`SELECT status, person_id, revoked_at FROM invitations WHERE id = $1`

/** One upload by id ($1). */
export const UPLOAD_BY_ID = sql`SELECT id, owner, task_id, filename, mime, size_bytes, storage_key, status FROM uploads WHERE id = $1`

/** How many uploads carry this id ($1). */
export const UPLOAD_COUNT_BY_ID = sql`SELECT count(*)::int AS count FROM uploads WHERE id = $1`

/** How many outbox messages have given up (status dead). */
export const OUTBOX_DEAD_COUNT = sql`SELECT count(*)::int AS count FROM outbox_messages WHERE status = 'dead'`
