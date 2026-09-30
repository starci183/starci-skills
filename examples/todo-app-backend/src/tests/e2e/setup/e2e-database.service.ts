import type { sql } from "@modules/platform/database"
import { openTestDatabase } from "@tests/fixtures/database"
import type { TestDatabase } from "@tests/fixtures/database"
import {
    AUDIT_CHAIN,
    AUDIT_ERASURE_LINES_OF_REQUEST,
    AUDIT_ERASURE_REQUEST,
    AUDIT_KEY_BY_ID,
    AUDIT_KEYS_OF_PERSON,
    AUDIT_KEYS_OF_PERSON_OR_KEY,
    AUDIT_LINE_COUNT_UNDER_KEY,
    AUDIT_LINES_UNDER_KEY,
    DELIVERY_ATTEMPTS_OF_NOTIFICATION,
    EXPIRE_SESSION,
    INVITATION_BY_ID,
    OCCURRENCE_COUNT_AFTER,
    OCCURRENCE_COUNTS_BY_STATUS,
    OUTBOX_DEAD_COUNT,
    PAYMENT_INTENT_BY_ID,
    PAYMENT_INTENTS_OF_PERSON,
    PING_DATABASE,
    PUBLIC_TABLES,
    RULE_ENDED_AT,
    SESSION_BY_TOKEN,
    SESSION_COUNT_BY_TOKEN,
    SESSIONS_BY_TOKENS,
    SUBSCRIPTIONS_OF_PERSON,
    TASK_BY_ID,
    TASK_COMPLETE_NOTIFICATIONS,
    TASK_COMPLETE_WITH_ATTEMPT,
    UPLOAD_BY_ID,
    UPLOAD_COUNT_BY_ID,
} from "@tests/fixtures/persistence/e2e-verification.sql"

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

/** The kind of value the `sql` tag builds: the only statement text the manager accepts. */
type Statement = ReturnType<typeof sql>

interface CountRow {
    count: number
}

/**
 * Out-of-band reads of the run persisted state, over the one `primary` connection. The door for asserting that a flow
 * really persisted: it is never used to shortcut the flow under test; the single write it has ages a session, because no
 * public door can do that.
 */
export class E2EDatabase {
    private constructor(private readonly database: TestDatabase) {}

    /** Opens the database of the stack. */
    static async open(databaseUrl: string): Promise<E2EDatabase> {
        return new E2EDatabase(await openTestDatabase(databaseUrl))
    }

    /** Closes the connection. */
    close(): Promise<void> {
        return this.database.close()
    }

    /** Whether the database answers. */
    async ping(): Promise<boolean> {
        const rows: Array<{ alive: number }> = await this.database.manager.query(PING_DATABASE, [])
        return rows[0]?.alive === 1
    }

    /** The tables the migrations created. */
    async tables(): Promise<Array<string>> {
        const rows: Array<{ table_name: string }> = await this.database.manager.query(PUBLIC_TABLES, [])
        return rows.map((row) => row.table_name)
    }

    /** The persisted session with this token (zero or one row). */
    sessionByToken(token: string): Promise<Array<SessionRow>> {
        return this.database.manager.query(SESSION_BY_TOKEN, [token])
    }

    /** The persisted sessions among these tokens. */
    sessionsByTokens(tokens: ReadonlyArray<string>): Promise<Array<SessionRow>> {
        return this.database.manager.query(SESSIONS_BY_TOKENS, [[...tokens]])
    }

    /** How many sessions carry this token. */
    sessionCountByToken(token: string): Promise<number> {
        return this.count(SESSION_COUNT_BY_TOKEN, [token])
    }

    /** Ages a session one second past its expiry and answers how many rows it touched. */
    async expireSession(token: string): Promise<number> {
        // An UPDATE answers `[rows, rowCount]` even with RETURNING.
        const [, count]: [Array<object>, number] = await this.database.manager.query(EXPIRE_SESSION, [token])
        return count
    }

    /** The persisted task with this id (zero or one row). */
    taskById(taskId: string): Promise<Array<TaskRow>> {
        return this.database.manager.query(TASK_BY_ID, [taskId])
    }

    /** The audit keys of one person. */
    auditKeysOfPerson(personId: string): Promise<Array<AuditKeyRow>> {
        return this.database.manager.query(AUDIT_KEYS_OF_PERSON, [personId])
    }

    /** The audit keys that belong to a person or carry a key id. */
    auditKeysOfPersonOrKey(personId: string, keyId: string): Promise<Array<AuditKeyRow>> {
        return this.database.manager.query(AUDIT_KEYS_OF_PERSON_OR_KEY, [personId, keyId])
    }

    /** The audit key with this key id. */
    auditKeyById(keyId: string): Promise<Array<AuditKeyRow>> {
        return this.database.manager.query(AUDIT_KEY_BY_ID, [keyId])
    }

    /** How many audit lines are stored under one key. */
    auditLineCountUnderKey(keyId: string): Promise<number> {
        return this.count(AUDIT_LINE_COUNT_UNDER_KEY, [keyId])
    }

    /** The audit lines stored under one key, in append order. */
    auditLinesUnderKey(keyId: string): Promise<Array<AuditLineRow>> {
        return this.database.manager.query(AUDIT_LINES_UNDER_KEY, [keyId])
    }

    /** The system erasure lines that name one request, in append order. */
    auditErasureLinesOfRequest(requestId: string): Promise<Array<AuditLineRow>> {
        return this.database.manager.query(AUDIT_ERASURE_LINES_OF_REQUEST, [requestId])
    }

    /** The hash chain of the whole audit log. */
    auditChain(): Promise<Array<AuditChainRow>> {
        return this.database.manager.query(AUDIT_CHAIN, [])
    }

    /** The persisted erasure request with this id. */
    auditErasureRequest(requestId: string): Promise<Array<ErasureRequestRow>> {
        return this.database.manager.query(AUDIT_ERASURE_REQUEST, [requestId])
    }

    /** The task-complete notifications of one recipient about one task. */
    taskCompleteNotifications(recipientId: string, taskId: string): Promise<Array<NotificationRow>> {
        return this.database.manager.query(TASK_COMPLETE_NOTIFICATIONS, [recipientId, taskId])
    }

    /** The delivery attempts of one notification. */
    deliveryAttemptsOf(notificationId: string): Promise<Array<DeliveryAttemptRow>> {
        return this.database.manager.query(DELIVERY_ATTEMPTS_OF_NOTIFICATION, [notificationId])
    }

    /** The task-complete notifications of one recipient about one task, each with its delivery attempt. */
    taskCompleteWithAttempt(recipientId: string, taskId: string): Promise<Array<NotificationAttemptRow>> {
        return this.database.manager.query(TASK_COMPLETE_WITH_ATTEMPT, [recipientId, taskId])
    }

    /** The subscriptions of one person. */
    subscriptionsOfPerson(personId: string): Promise<Array<SubscriptionRow>> {
        return this.database.manager.query(SUBSCRIPTIONS_OF_PERSON, [personId])
    }

    /** The payment intent with this id (zero or one row). */
    paymentIntentById(paymentIntentId: string): Promise<Array<PaymentIntentRow>> {
        return this.database.manager.query(PAYMENT_INTENT_BY_ID, [paymentIntentId])
    }

    /** The payment intents of one person. */
    paymentIntentsOfPerson(personId: string): Promise<Array<PaymentIntentRow>> {
        return this.database.manager.query(PAYMENT_INTENTS_OF_PERSON, [personId])
    }

    /** The end date of one recurrence rule (zero or one row). */
    ruleEndedAt(ruleId: string): Promise<Array<{ ended_at: string | null }>> {
        return this.database.manager.query(RULE_ENDED_AT, [ruleId])
    }

    /** How many occurrences of one rule sit in each status. */
    occurrenceCountsByStatus(ruleId: string): Promise<Array<OccurrenceStatusCountRow>> {
        return this.database.manager.query(OCCURRENCE_COUNTS_BY_STATUS, [ruleId])
    }

    /** How many occurrences of one rule are dated after a local date. */
    occurrenceCountAfter(ruleId: string, localDate: string): Promise<number> {
        return this.count(OCCURRENCE_COUNT_AFTER, [ruleId, localDate])
    }

    /** The persisted invitation with this id (zero or one row). */
    invitationById(invitationId: string): Promise<Array<InvitationRow>> {
        return this.database.manager.query(INVITATION_BY_ID, [invitationId])
    }

    /** The persisted upload with this id (zero or one row). */
    uploadById(uploadId: string): Promise<Array<UploadRow>> {
        return this.database.manager.query(UPLOAD_BY_ID, [uploadId])
    }

    /** How many uploads carry this id. */
    uploadCountById(uploadId: string): Promise<number> {
        return this.count(UPLOAD_COUNT_BY_ID, [uploadId])
    }

    /** How many outbox messages have given up. */
    outboxDeadCount(): Promise<number> {
        return this.count(OUTBOX_DEAD_COUNT, [])
    }

    private async count(statement: Statement, parameters: ReadonlyArray<string>): Promise<number> {
        const rows: Array<CountRow> = await this.database.manager.query(statement, [...parameters])
        return rows[0]?.count ?? 0
    }
}
