import type {
    MigrationInterface 
} from "typeorm"
import {
    AuditErasureRequestEntity 
} from "./entities/audit-erasure-request.entity"
import {
    AuditKeyEntity 
} from "./entities/audit-key.entity"
import {
    AuditLogLineEntity 
} from "./entities/audit-log-line.entity"
import {
    NotifyNotificationEntity 
} from "./entities/notification.entity"
import {
    NotifyDeliveryAttemptEntity 
} from "./entities/notify-delivery-attempt.entity"
import {
    NotifyDigestWindowEntity 
} from "./entities/notify-digest-window.entity"
import {
    NotifyPreferenceEntity 
} from "./entities/notify-preference.entity"
import {
    OccurrenceEntity 
} from "./entities/occurrence.entity"
import {
    PaymentIntentEntity 
} from "./entities/payment-intent.entity"
import {
    RuleEntity 
} from "./entities/rule.entity"
import {
    SessionEntity 
} from "./entities/session.entity"
import {
    ShareInvitationEntity 
} from "./entities/share-invitation.entity"
import {
    SubscriptionEntity 
} from "./entities/subscription.entity"
import {
    TaskEntity 
} from "./entities/task.entity"
import {
    UploadEntity 
} from "./entities/upload.entity"
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

export { CONNECTION } from "./connection"
export {
    AuditErasureRequestEntity,
    AuditKeyEntity,
    AuditLogLineEntity,
    NotifyDeliveryAttemptEntity,
    NotifyDigestWindowEntity,
    NotifyNotificationEntity,
    NotifyPreferenceEntity,
    OccurrenceEntity,
    PaymentIntentEntity,
    RuleEntity,
    SessionEntity,
    ShareInvitationEntity,
    SubscriptionEntity,
    TaskEntity,
    UploadEntity,
}

/** Every entity of the connection, listed explicitly so what runs is what was reviewed (no glob). */
export const entities = [
    SessionEntity,
    TaskEntity,
    ShareInvitationEntity,
    RuleEntity,
    OccurrenceEntity,
    NotifyNotificationEntity,
    NotifyDeliveryAttemptEntity,
    NotifyPreferenceEntity,
    NotifyDigestWindowEntity,
    AuditLogLineEntity,
    AuditKeyEntity,
    AuditErasureRequestEntity,
    SubscriptionEntity,
    PaymentIntentEntity,
    UploadEntity,
]

/** Every migration of the connection in the order it runs; only `apps/migrate` applies them. */
export const migrations: ReadonlyArray<new () => MigrationInterface> = [
    CreateSessionsTable1758160000000,
    CreateTasksTable1758160000001,
    CreateInvitationsTable1758160000002,
    CreatePlanTables1758160000002,
    CreateNotifyTables1758210000000,
    CreateAuditTables1758246000000,
    CreateRecurTables1758246000000,
    CreateUploadsTable1758300000000,
]
