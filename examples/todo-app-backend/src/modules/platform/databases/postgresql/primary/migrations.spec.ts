import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    MigrationInterface, QueryRunner 
} from "typeorm"
import {
    CreateSessionsTable1758160000000 
} from "./migrations/1758160000000-create-sessions-table"
import {
    CreateTasksTable1758160000001 
} from "./migrations/1758160000001-create-tasks-table"
import {
    CreateInvitationsTable1758160000002 
} from "./migrations/1758160000002-create-invitations-table"
import {
    CreatePlanTables1758160000002 
} from "./migrations/1758160000002-create-plan-tables"
import {
    CreateNotifyTables1758210000000 
} from "./migrations/1758210000000-create-notify-tables"
import {
    CreateAuditTables1758246000000 
} from "./migrations/1758246000000-create-audit-tables"
import {
    CreateRecurTables1758246000000 
} from "./migrations/1758246000000-create-recur-tables"
import {
    CreateUploadsTable1758300000000 
} from "./migrations/1758300000000-create-uploads-table"

type MigrationClass = new () => MigrationInterface;

const ALL_MIGRATIONS: Array<MigrationClass> = [
    CreateSessionsTable1758160000000,
    CreateTasksTable1758160000001,
    CreateInvitationsTable1758160000002,
    CreatePlanTables1758160000002,
    CreateNotifyTables1758210000000,
    CreateAuditTables1758246000000,
    CreateRecurTables1758246000000,
    CreateUploadsTable1758300000000,
]

/**
 * The migrations are the schema the entities under ../entities map onto, and the only owners of that
 * schema - this spec pins the exact statements each one issues, in order, so a silent edit (a dropped
 * IF NOT EXISTS guard that breaks a seeded container, a missing UNIQUE index, a down() that drops a
 * parent table before its referencing child) fails loudly here instead of at deploy time.
 */
describe("primary migrations",
    () => {
        const query = jest.fn()

        const boot = async <T extends MigrationInterface>(migrationClass: MigrationClass) => {
            const moduleRef: TestingModule = await Test.createTestingModule({
                providers: [migrationClass],
            }).compile()
            return {
                moduleRef, migration: moduleRef.get<T>(migrationClass) 
            }
        }

        const issuedSql = async (migration: MigrationInterface, direction: "up" | "down"): Promise<Array<string>> => {
            query.mockReset().mockResolvedValue(undefined)
            await migration[direction]({
                query 
            } as unknown as QueryRunner)
            return query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g,
                " ").trim())
        }

        it("every migration names itself after its class, timestamp suffix included",
            async () => {
                for (const migrationClass of ALL_MIGRATIONS) {
                    const { moduleRef, migration } = await boot(migrationClass)
                    try {
                        expect(migration.name).toBe(migrationClass.name)
                        expect(migration.name).toMatch(/[A-Za-z]+\d{13}$/)
                    } finally {
                        await moduleRef.close()
                    }
                }
            })

        it("every statement is written idempotently - each guarded by IF (NOT) EXISTS",
            async () => {
                for (const migrationClass of ALL_MIGRATIONS) {
                    const { moduleRef, migration } = await boot(migrationClass)
                    try {
                        for (const sql of await issuedSql(migration,
                            "up")) {
                            expect(sql).toMatch(/IF (NOT )?EXISTS/)
                        }
                        for (const sql of await issuedSql(migration,
                            "down")) {
                            expect(sql).toMatch(/IF EXISTS/)
                        }
                    } finally {
                        await moduleRef.close()
                    }
                }
            })

        it("CreateSessionsTable: up creates sessions + person index, down drops the table",
            async () => {
                const { moduleRef, migration } = await boot(CreateSessionsTable1758160000000)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS sessions ( token text PRIMARY KEY, person_id text NOT NULL, issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL )",
                        "CREATE INDEX IF NOT EXISTS sessions_person_id_idx ON sessions (person_id)",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual(["DROP TABLE IF EXISTS sessions"])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateTasksTable: up creates tasks + completed_at column + owner index, down removes only the added column",
            async () => {
                const { moduleRef, migration } = await boot(CreateTasksTable1758160000001)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS tasks ( id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, complete boolean NOT NULL DEFAULT false )",
                        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz",
                        "CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner)",
                    ])
                    // down() deliberately keeps the seeded `tasks` table - it only reverses what up() added.
                    expect(await issuedSql(migration,
                        "down")).toEqual([
                        "ALTER TABLE tasks DROP COLUMN IF EXISTS completed_at",
                    ])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateInvitationsTable: up creates invitations + the unique (task_id, email) index backing one-row-per-pair",
            async () => {
                const { moduleRef, migration } = await boot(CreateInvitationsTable1758160000002)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS invitations ( id text PRIMARY KEY, task_id text NOT NULL, owner_id text NOT NULL, email text NOT NULL, role text NOT NULL, status text NOT NULL DEFAULT 'pending', sent_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, person_id text )",
                        "CREATE UNIQUE INDEX IF NOT EXISTS invitations_task_email_idx ON invitations (task_id, email)",
                        "CREATE INDEX IF NOT EXISTS invitations_task_idx ON invitations (task_id)",
                        "CREATE INDEX IF NOT EXISTS invitations_person_idx ON invitations (person_id)",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual(["DROP TABLE IF EXISTS invitations"])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreatePlanTables: up creates subscriptions + payment_intents, down drops the dependent table first",
            async () => {
                const { moduleRef, migration } = await boot(CreatePlanTables1758160000002)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS subscriptions ( id text PRIMARY KEY, person_id text NOT NULL UNIQUE, plan text NOT NULL DEFAULT 'free', status text NOT NULL DEFAULT 'free', period_end timestamptz, gateway_customer_id text )",
                        "CREATE INDEX IF NOT EXISTS subscriptions_person_id_idx ON subscriptions (person_id)",
                        "CREATE TABLE IF NOT EXISTS payment_intents ( id text PRIMARY KEY, subscription_id text NOT NULL, gateway text NOT NULL DEFAULT 'sepay', gateway_intent_id text NOT NULL, amount integer NOT NULL, currency text NOT NULL DEFAULT 'VND', status text NOT NULL DEFAULT 'pending', applied_at timestamptz )",
                        "CREATE INDEX IF NOT EXISTS payment_intents_subscription_id_idx ON payment_intents (subscription_id)",
                        "CREATE INDEX IF NOT EXISTS payment_intents_gateway_intent_id_idx ON payment_intents (gateway_intent_id)",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual([
                        "DROP TABLE IF EXISTS payment_intents",
                        "DROP TABLE IF EXISTS subscriptions",
                    ])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateNotifyTables: up creates all four tables with the partial open-window index, down drops in reverse",
            async () => {
                const { moduleRef, migration } = await boot(CreateNotifyTables1758210000000)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS notify_notifications ( id text PRIMARY KEY, kind text NOT NULL, recipient_id text NOT NULL, payload jsonb NOT NULL, digest_group_id text, created_at timestamptz NOT NULL )",
                        "CREATE INDEX IF NOT EXISTS notify_notifications_recipient_idx ON notify_notifications (recipient_id)",
                        "CREATE INDEX IF NOT EXISTS notify_notifications_digest_group_idx ON notify_notifications (digest_group_id)",
                        "CREATE TABLE IF NOT EXISTS notify_delivery_attempts ( notification_id text PRIMARY KEY REFERENCES notify_notifications (id), state text NOT NULL, attempt integer NOT NULL DEFAULT 0, failure_class text, started_at timestamptz, ended_at timestamptz, history jsonb NOT NULL DEFAULT '[]'::jsonb )",
                        "CREATE INDEX IF NOT EXISTS notify_delivery_attempts_state_idx ON notify_delivery_attempts (state)",
                        "CREATE TABLE IF NOT EXISTS notify_preferences ( person_id text NOT NULL, channel text NOT NULL, unsubscribed boolean NOT NULL DEFAULT false, digest_window_minutes integer, PRIMARY KEY (person_id, channel) )",
                        "CREATE TABLE IF NOT EXISTS notify_digest_windows ( id text PRIMARY KEY, person_id text NOT NULL, channel text NOT NULL, opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL, flushed_at timestamptz )",
                        "CREATE INDEX IF NOT EXISTS notify_digest_windows_open_idx ON notify_digest_windows (person_id, channel) WHERE flushed_at IS NULL",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual([
                        "DROP TABLE IF EXISTS notify_digest_windows",
                        "DROP TABLE IF EXISTS notify_preferences",
                        "DROP TABLE IF EXISTS notify_delivery_attempts",
                        "DROP TABLE IF EXISTS notify_notifications",
                    ])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateAuditTables: up creates log_lines/keys/erasure_requests, down drops them in reverse order",
            async () => {
                const { moduleRef, migration } = await boot(CreateAuditTables1758246000000)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS audit_log_lines ( id bigserial PRIMARY KEY, at timestamptz NOT NULL, action text NOT NULL, target text, key_id text NOT NULL, actor text NOT NULL, prev_hash text NOT NULL, hash text NOT NULL )",
                        "CREATE INDEX IF NOT EXISTS audit_log_lines_key_id_idx ON audit_log_lines (key_id)",
                        "CREATE TABLE IF NOT EXISTS audit_keys ( person_id text PRIMARY KEY, key_id text NOT NULL UNIQUE, key text NOT NULL, created_at timestamptz NOT NULL )",
                        "CREATE TABLE IF NOT EXISTS audit_erasure_requests ( request_id text PRIMARY KEY, person_id text, state text NOT NULL, requested_at timestamptz NOT NULL, verified_at timestamptz, refused_at timestamptz, executing_at timestamptz, completed_at timestamptz )",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual([
                        "DROP TABLE IF EXISTS audit_erasure_requests",
                        "DROP TABLE IF EXISTS audit_keys",
                        "DROP TABLE IF EXISTS audit_log_lines",
                    ])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateRecurTables: up creates recurrence_rules + occurrences with the unique window_key index that makes generation idempotent",
            async () => {
                const { moduleRef, migration } = await boot(CreateRecurTables1758246000000)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS recurrence_rules ( id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, frequency text NOT NULL, n integer, day_of_month integer, time_zone text NOT NULL, time text NOT NULL, start_date text NOT NULL, ended_at text )",
                        "CREATE INDEX IF NOT EXISTS recurrence_rules_owner_idx ON recurrence_rules (owner)",
                        "CREATE TABLE IF NOT EXISTS occurrences ( id text PRIMARY KEY, rule_id text NOT NULL, window_key text NOT NULL, local_date text NOT NULL, due_at_utc timestamptz NOT NULL, status text NOT NULL )",
                        "CREATE UNIQUE INDEX IF NOT EXISTS occurrences_window_key_key ON occurrences (window_key)",
                        "CREATE INDEX IF NOT EXISTS occurrences_rule_id_idx ON occurrences (rule_id)",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual([
                        "DROP TABLE IF EXISTS occurrences",
                        "DROP TABLE IF EXISTS recurrence_rules",
                    ])
                } finally {
                    await moduleRef.close()
                }
            })

        it("CreateUploadsTable: up creates uploads + owner/task indexes, down drops the table",
            async () => {
                const { moduleRef, migration } = await boot(CreateUploadsTable1758300000000)
                try {
                    expect(await issuedSql(migration,
                        "up")).toEqual([
                        "CREATE TABLE IF NOT EXISTS uploads ( id text PRIMARY KEY, owner text NOT NULL, task_id text, filename text NOT NULL, mime text NOT NULL, size_bytes integer NOT NULL, storage_key text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL )",
                        "CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner)",
                        "CREATE INDEX IF NOT EXISTS uploads_task_id_idx ON uploads (task_id)",
                    ])
                    expect(await issuedSql(migration,
                        "down")).toEqual(["DROP TABLE IF EXISTS uploads"])
                } finally {
                    await moduleRef.close()
                }
            })
    })
