/** The row shapes the SQL constants of `e2e-verification.sql.ts` answer, snake_case as the tables spell them. */

/** A persisted session. */
export interface SessionRow {
    token: string
    person_id: string
}

/** A persisted task. */
export interface TaskRow {
    id: string
    owner: string
    title: string
    complete: boolean
    completed_at: Date | null
}

/** An audit key of the keystore. */
export interface AuditKeyRow {
    person_id: string
    key_id: string
}

/** A stored audit line as the table spells it: the actor stays sealed. */
export interface AuditLineRow {
    action: string
    target: string | null
    key_id: string
    actor: string
}

/** One link of the audit hash chain. */
export interface AuditChainRow {
    id: string
    prev_hash: string
    hash: string
}

/** A persisted erasure request. */
export interface ErasureRequestRow {
    request_id: string
    person_id: string | null
    state: string
    verified_at: string | null
    executing_at: string | null
    completed_at: string | null
}

/** A persisted notification with its digest group. */
export interface NotificationRow {
    id: string
    digest_group_id: string | null
}

/** A persisted delivery attempt with its state history. */
export interface DeliveryAttemptRow {
    state: string
    attempt: number
    failure_class: string | null
    history: Array<{ state: string; at: string; failureClass?: string | null }>
}

/** A notification joined to its delivery attempt. */
export interface NotificationAttemptRow extends NotificationRow, DeliveryAttemptRow {}

/** A persisted subscription. */
export interface SubscriptionRow {
    id: string
    plan: string
    status: string
}

/** A persisted payment intent. */
export interface PaymentIntentRow {
    id: string
    subscription_id: string
    gateway_intent_id: string
    status: string
}

/** The occurrences of one rule in one status. */
export interface OccurrenceStatusCountRow {
    status: string
    count: number
}

/** A persisted invitation. */
export interface InvitationRow {
    status: string
    person_id: string | null
    revoked_at: Date | null
}

/** A persisted upload. */
export interface UploadRow {
    id: string
    owner: string
    task_id: string | null
    filename: string
    mime: string
    size_bytes: number
    storage_key: string
    status: string
}

/** A `count(*)` answer. */
export interface CountRow {
    count: number
}

/** The answer of the liveness query. */
export interface AliveRow {
    alive: number
}

/** One table name of the public schema. */
export interface TableRow {
    table_name: string
}

/** The end instant of a recurrence rule. */
export interface RuleEndedAtRow {
    ended_at: string | null
}
