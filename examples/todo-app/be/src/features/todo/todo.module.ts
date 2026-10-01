import { Module } from "@nestjs/common"
import { AcceptInvitationHandler } from "./application/accept-invitation.handler"
import { AcceptUploadContentHandler } from "./application/accept-upload-content.handler"
import { AdmitNotificationHandler } from "./application/admit-notification.handler"
import { AppendLogLineHandler } from "./application/append-log-line.handler"
import { AttachUploadHandler } from "./application/attach-upload.handler"
import { AuditLogHandler } from "./application/audit-log.handler"
import { CompleteErasureHandler } from "./application/complete-erasure.handler"
import { CompleteOccurrenceHandler } from "./application/complete-occurrence.handler"
import { CompleteTaskHandler } from "./application/complete-task.handler"
import { ConfirmPaymentHandler } from "./application/confirm-payment.handler"
import { CreateDirectUploadHandler } from "./application/create-direct-upload.handler"
import { CreateTaskHandler } from "./application/create-task.handler"
import { CreateUploadIntentHandler } from "./application/create-upload-intent.handler"
import { DeleteTaskHandler } from "./application/delete-task.handler"
import { DeleteUploadHandler } from "./application/delete-upload.handler"
import { DispatchNotificationGroupHandler } from "./application/dispatch-notification-group.handler"
import { DowngradePlanHandler } from "./application/downgrade-plan.handler"
import { EditRecurrenceHandler } from "./application/edit-recurrence.handler"
import { EndRecurrenceHandler } from "./application/end-recurrence.handler"
import { ExportMyDataHandler } from "./application/export-my-data.handler"
import { GenerateRecurrencesHandler } from "./application/generate-recurrences.handler"
import { InviteHandler } from "./application/invite.handler"
import { ListCollaboratorsHandler } from "./application/list-collaborators.handler"
import { ListTaskUploadsHandler } from "./application/list-task-uploads.handler"
import { ListTasksHandler } from "./application/list-tasks.handler"
import { MakeRecurringHandler } from "./application/make-recurring.handler"
import { NotificationPreferencesHandler } from "./application/notification-preferences.handler"
import { PlanUsageHandler } from "./application/plan-usage.handler"
import { PurgeLapsedSessionsHandler } from "./application/purge-lapsed-sessions.handler"
import { ReadUploadContentHandler } from "./application/read-upload-content.handler"
import { ReconcilePaymentHandler } from "./application/reconcile-payment.handler"
import { ReopenTaskHandler } from "./application/reopen-task.handler"
import { RequestErasureHandler } from "./application/request-erasure.handler"
import { RevokeCollaboratorHandler } from "./application/revoke-collaborator.handler"
import { SignInHandler } from "./application/sign-in.handler"
import { SignOutHandler } from "./application/sign-out.handler"
import { SkipOccurrenceHandler } from "./application/skip-occurrence.handler"
import { TaskCountsHandler } from "./application/task-counts.handler"
import { UnsubscribeHandler } from "./application/unsubscribe.handler"
import { UpcomingOccurrencesHandler } from "./application/upcoming-occurrences.handler"
import { UpdateNotificationPreferencesHandler } from "./application/update-notification-preferences.handler"
import { UpgradePlanHandler } from "./application/upgrade-plan.handler"

@Module({
    providers: [
        AcceptInvitationHandler,
        AcceptUploadContentHandler,
        AdmitNotificationHandler,
        AppendLogLineHandler,
        AttachUploadHandler,
        AuditLogHandler,
        CompleteErasureHandler,
        CompleteOccurrenceHandler,
        CompleteTaskHandler,
        ConfirmPaymentHandler,
        CreateDirectUploadHandler,
        CreateTaskHandler,
        CreateUploadIntentHandler,
        DeleteTaskHandler,
        DeleteUploadHandler,
        DispatchNotificationGroupHandler,
        DowngradePlanHandler,
        EditRecurrenceHandler,
        EndRecurrenceHandler,
        ExportMyDataHandler,
        GenerateRecurrencesHandler,
        InviteHandler,
        ListCollaboratorsHandler,
        ListTaskUploadsHandler,
        ListTasksHandler,
        MakeRecurringHandler,
        NotificationPreferencesHandler,
        PlanUsageHandler,
        PurgeLapsedSessionsHandler,
        ReadUploadContentHandler,
        ReconcilePaymentHandler,
        ReopenTaskHandler,
        RequestErasureHandler,
        RevokeCollaboratorHandler,
        SignInHandler,
        SignOutHandler,
        SkipOccurrenceHandler,
        TaskCountsHandler,
        UnsubscribeHandler,
        UpcomingOccurrencesHandler,
        UpdateNotificationPreferencesHandler,
        UpgradePlanHandler,
    ],
})
/** The todo feature application: every command and query handler; the transports import it, no app does. */
export class TodoModule {}
