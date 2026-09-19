import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getMetadataArgsStorage 
} from "typeorm"
import {
    AuditErasureRequestEntity 
} from "./audit-erasure-request.entity"
import {
    AuditKeyEntity 
} from "./audit-key.entity"
import {
    AuditLogLineEntity 
} from "./audit-log-line.entity"
import {
    NotifyDeliveryAttemptEntity 
} from "./notify-delivery-attempt.entity"
import {
    NotifyDigestWindowEntity 
} from "./notify-digest-window.entity"
import {
    NotifyNotificationEntity 
} from "./notification.entity"
import {
    NotifyPreferenceEntity 
} from "./notify-preference.entity"
import {
    OccurrenceEntity 
} from "./occurrence.entity"
import {
    PaymentIntentEntity 
} from "./payment-intent.entity"
import {
    RuleEntity 
} from "./rule.entity"
import {
    SessionEntity 
} from "./session.entity"
import {
    ShareInvitationEntity 
} from "./share-invitation.entity"
import {
    SubscriptionEntity 
} from "./subscription.entity"
import {
    TaskEntity 
} from "./task.entity"

type EntityClass = new () => object;

interface EntitySpecRow {
  entity: EntityClass;
  table: string;
  /** [dbColumnName, columnType] pairs in declaration order. */
  columns: Array<readonly [string, string]>;
  primary: Array<string>;
  nullable: Array<string>;
  unique: Array<string>;
  defaults: Record<string, unknown>;
}

const ENTITY_SCHEMA: Array<EntitySpecRow> = [
    {
        entity: SessionEntity,
        table: "sessions",
        columns: [
            ["token",
                "text"],
            ["person_id",
                "text"],
            ["issued_at",
                "timestamptz"],
            ["expires_at",
                "timestamptz"],
        ],
        primary: ["token"],
        nullable: [],
        unique: [],
        defaults: {
        },
    },
    {
        entity: TaskEntity,
        table: "tasks",
        columns: [
            ["id",
                "text"],
            ["owner",
                "text"],
            ["title",
                "text"],
            ["complete",
                "boolean"],
            ["completed_at",
                "timestamptz"],
        ],
        primary: ["id"],
        nullable: ["completed_at"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: ShareInvitationEntity,
        table: "invitations",
        columns: [
            ["id",
                "text"],
            ["task_id",
                "text"],
            ["owner_id",
                "text"],
            ["email",
                "text"],
            ["role",
                "text"],
            ["status",
                "text"],
            ["sent_at",
                "timestamptz"],
            ["accepted_at",
                "timestamptz"],
            ["revoked_at",
                "timestamptz"],
            ["person_id",
                "text"],
        ],
        primary: ["id"],
        nullable: ["accepted_at",
            "revoked_at",
            "person_id"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: RuleEntity,
        table: "recurrence_rules",
        columns: [
            ["id",
                "text"],
            ["owner",
                "text"],
            ["title",
                "text"],
            ["frequency",
                "text"],
            ["n",
                "integer"],
            ["day_of_month",
                "integer"],
            ["time_zone",
                "text"],
            ["time",
                "text"],
            ["start_date",
                "text"],
            ["ended_at",
                "text"],
        ],
        primary: ["id"],
        nullable: ["n",
            "day_of_month",
            "ended_at"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: OccurrenceEntity,
        table: "occurrences",
        columns: [
            ["id",
                "text"],
            ["rule_id",
                "text"],
            ["window_key",
                "text"],
            ["local_date",
                "text"],
            ["due_at_utc",
                "timestamptz"],
            ["status",
                "text"],
        ],
        primary: ["id"],
        nullable: [],
        unique: [],
        defaults: {
        },
    },
    {
        entity: NotifyNotificationEntity,
        table: "notify_notifications",
        columns: [
            ["id",
                "text"],
            ["kind",
                "text"],
            ["recipient_id",
                "text"],
            ["payload",
                "jsonb"],
            ["digest_group_id",
                "text"],
            ["created_at",
                "timestamptz"],
        ],
        primary: ["id"],
        nullable: ["digest_group_id"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: NotifyDeliveryAttemptEntity,
        table: "notify_delivery_attempts",
        columns: [
            ["notification_id",
                "text"],
            ["state",
                "text"],
            ["attempt",
                "integer"],
            ["failure_class",
                "text"],
            ["started_at",
                "timestamptz"],
            ["ended_at",
                "timestamptz"],
            ["history",
                "jsonb"],
        ],
        primary: ["notification_id"],
        nullable: ["failure_class",
            "started_at",
            "ended_at"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: NotifyPreferenceEntity,
        table: "notify_preferences",
        columns: [
            ["person_id",
                "text"],
            ["channel",
                "text"],
            ["unsubscribed",
                "boolean"],
            ["digest_window_minutes",
                "integer"],
        ],
        primary: ["person_id",
            "channel"],
        nullable: ["digest_window_minutes"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: NotifyDigestWindowEntity,
        table: "notify_digest_windows",
        columns: [
            ["id",
                "text"],
            ["person_id",
                "text"],
            ["channel",
                "text"],
            ["opens_at",
                "timestamptz"],
            ["closes_at",
                "timestamptz"],
            ["flushed_at",
                "timestamptz"],
        ],
        primary: ["id"],
        nullable: ["flushed_at"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: AuditLogLineEntity,
        table: "audit_log_lines",
        columns: [
            ["id",
                "bigint"],
            ["at",
                "timestamptz"],
            ["action",
                "text"],
            ["target",
                "text"],
            ["key_id",
                "text"],
            ["actor",
                "text"],
            ["prev_hash",
                "text"],
            ["hash",
                "text"],
        ],
        primary: ["id"],
        nullable: ["target"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: AuditKeyEntity,
        table: "audit_keys",
        columns: [
            ["person_id",
                "text"],
            ["key_id",
                "text"],
            ["key",
                "text"],
            ["created_at",
                "timestamptz"],
        ],
        primary: ["person_id"],
        nullable: [],
        unique: ["key_id"],
        defaults: {
        },
    },
    {
        entity: AuditErasureRequestEntity,
        table: "audit_erasure_requests",
        columns: [
            ["request_id",
                "text"],
            ["person_id",
                "text"],
            ["state",
                "text"],
            ["requested_at",
                "timestamptz"],
            ["verified_at",
                "timestamptz"],
            ["refused_at",
                "timestamptz"],
            ["executing_at",
                "timestamptz"],
            ["completed_at",
                "timestamptz"],
        ],
        primary: ["request_id"],
        nullable: ["person_id",
            "verified_at",
            "refused_at",
            "executing_at",
            "completed_at"],
        unique: [],
        defaults: {
        },
    },
    {
        entity: SubscriptionEntity,
        table: "subscriptions",
        columns: [
            ["id",
                "text"],
            ["person_id",
                "text"],
            ["plan",
                "text"],
            ["status",
                "text"],
            ["period_end",
                "timestamptz"],
            ["gateway_customer_id",
                "text"],
        ],
        primary: ["id"],
        nullable: ["period_end",
            "gateway_customer_id"],
        unique: ["person_id"],
        defaults: {
            plan: "free", status: "free" 
        },
    },
    {
        entity: PaymentIntentEntity,
        table: "payment_intents",
        columns: [
            ["id",
                "text"],
            ["subscription_id",
                "text"],
            ["gateway",
                "text"],
            ["gateway_intent_id",
                "text"],
            ["amount",
                "integer"],
            ["currency",
                "text"],
            ["status",
                "text"],
            ["applied_at",
                "timestamptz"],
        ],
        primary: ["id"],
        nullable: ["applied_at"],
        unique: [],
        defaults: {
            gateway: "sepay", currency: "VND", status: "pending" 
        },
    },
]

/**
 * The entities' decorators are the whole contract capability code is compiled against: a drifted table
 * name, a dropped `nullable`, or a changed column type compiles fine and only fails once a real query
 * runs. Migrations pin the DDL in ../migrations/migrations.spec.ts; this spec pins the ORM side of the
 * same schema from the decorator metadata, so the two halves cannot silently disagree.
 */
describe("primary entities",
    () => {
        const storage = getMetadataArgsStorage()
        const columnsOf = (entity: EntityClass) => storage.columns.filter(c => c.target === entity)
        const dbName = (column: (typeof storage.columns)[number]) => column.options.name ?? column.propertyName
        let moduleRef: TestingModule

        beforeAll(async () => {
            moduleRef = await Test.createTestingModule({
                providers: ENTITY_SCHEMA.map(row => row.entity),
            }).compile()
        })

        afterAll(async () => {
            await moduleRef.close()
        })

        it("every entity class instantiates through the Nest container",
            () => {
                for (const { entity } of ENTITY_SCHEMA) {
                    expect(moduleRef.get(entity)).toBeInstanceOf(entity)
                }
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: @Entity name matches the migration-owned table",
            (_table, row) => {
                expect(storage.tables.find(t => t.target === row.entity)?.name).toBe(row.table)
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: columns are declared in order with their SQL types",
            (_table, row) => {
                expect(columnsOf(row.entity).map(c => [dbName(c),
                    c.options.type] as const)).toEqual(row.columns)
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: primary key columns match the migration primary key",
            (_table, row) => {
                const primary = columnsOf(row.entity)
                    .filter(c => c.options.primary)
                    .map(dbName)
                expect(primary).toEqual(row.primary)
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: exactly the declared columns are nullable",
            (_table, row) => {
                const nullable = columnsOf(row.entity)
                    .filter(c => c.options.nullable)
                    .map(dbName)
                    .sort()
                expect(nullable).toEqual([...row.nullable].sort())
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: exactly the declared columns are unique",
            (_table, row) => {
                const unique = columnsOf(row.entity)
                    .filter(c => c.options.unique)
                    .map(dbName)
                expect(unique).toEqual(row.unique)
            })

        it.each(ENTITY_SCHEMA.map(row => [row.table,
            row] as const))("%s: column defaults back the declared free-tier/gateway values",
            (_table, row) => {
                const defaults = Object.fromEntries(
                    columnsOf(row.entity)
                        .filter(c => c.options.default !== undefined)
                        .map(c => [dbName(c),
                            c.options.default]),
                )
                expect(defaults).toEqual(row.defaults)
            })

        it("audit_log_lines.id is the only generated column, an incrementing bigint - the hash chain ordering key",
            () => {
                const generated = storage.generations.filter(g =>
                    ENTITY_SCHEMA.some(row => row.entity === g.target),
                )

                expect(generated).toEqual([
                    expect.objectContaining({
                        target: AuditLogLineEntity, propertyName: "id", strategy: "increment" 
                    }),
                ])
                expect(columnsOf(AuditLogLineEntity).find(c => c.propertyName === "id")?.options.type).toBe("bigint")
            })
    })
