import { Module } from "@nestjs/common"
import { TodoModule } from "../../todo.module"
import { AcceptInvitationResolver } from "./accept-invitation.resolver"
import { AttachUploadResolver } from "./attach-upload.resolver"
import { AuditLogResolver } from "./audit-log.resolver"
import { CompleteErasureResolver } from "./complete-erasure.resolver"
import { CompleteOccurrenceResolver } from "./complete-occurrence.resolver"
import { CompleteTaskResolver } from "./complete-task.resolver"
import { CreateTaskResolver } from "./create-task.resolver"
import { CreateUploadIntentResolver } from "./create-upload-intent.resolver"
import { DeleteTaskResolver } from "./delete-task.resolver"
import { DeleteUploadResolver } from "./delete-upload.resolver"
import { DowngradePlanResolver } from "./downgrade-plan.resolver"
import { EditRecurrenceResolver } from "./edit-recurrence.resolver"
import { EndRecurrenceResolver } from "./end-recurrence.resolver"
import { ExportMyDataResolver } from "./export-my-data.resolver"
import { InviteResolver } from "./invite.resolver"
import { ListCollaboratorsResolver } from "./list-collaborators.resolver"
import { ListTasksResolver } from "./list-tasks.resolver"
import { MakeRecurringResolver } from "./make-recurring.resolver"
import { NotificationPreferencesResolver } from "./notification-preferences.resolver"
import { PlanUsageResolver } from "./plan-usage.resolver"
import { ReconcilePaymentResolver } from "./reconcile-payment.resolver"
import { ReopenTaskResolver } from "./reopen-task.resolver"
import { RequestErasureResolver } from "./request-erasure.resolver"
import { RevokeCollaboratorResolver } from "./revoke-collaborator.resolver"
import { SignInResolver } from "./sign-in.resolver"
import { SignOutResolver } from "./sign-out.resolver"
import { SkipOccurrenceResolver } from "./skip-occurrence.resolver"
import { TaskCountsResolver } from "./task-counts.resolver"
import { TaskUploadsResolver } from "./task-uploads.resolver"
import { UnsubscribeResolver } from "./unsubscribe.resolver"
import { UpcomingOccurrencesResolver } from "./upcoming-occurrences.resolver"
import { UpdateNotificationPreferencesResolver } from "./update-notification-preferences.resolver"
import { UpgradePlanResolver } from "./upgrade-plan.resolver"

@Module({
    imports: [TodoModule],
    providers: [
        AcceptInvitationResolver,
        AttachUploadResolver,
        AuditLogResolver,
        CompleteErasureResolver,
        CompleteOccurrenceResolver,
        CompleteTaskResolver,
        CreateTaskResolver,
        CreateUploadIntentResolver,
        DeleteTaskResolver,
        DeleteUploadResolver,
        DowngradePlanResolver,
        EditRecurrenceResolver,
        EndRecurrenceResolver,
        ExportMyDataResolver,
        InviteResolver,
        ListCollaboratorsResolver,
        ListTasksResolver,
        MakeRecurringResolver,
        NotificationPreferencesResolver,
        PlanUsageResolver,
        ReconcilePaymentResolver,
        ReopenTaskResolver,
        RequestErasureResolver,
        RevokeCollaboratorResolver,
        SignInResolver,
        SignOutResolver,
        SkipOccurrenceResolver,
        TaskCountsResolver,
        TaskUploadsResolver,
        UnsubscribeResolver,
        UpcomingOccurrencesResolver,
        UpdateNotificationPreferencesResolver,
        UpgradePlanResolver,
    ],
})
/** The GraphQL transport of the todo feature: one module for every resolver. */
export class TodoGraphqlModule {}
