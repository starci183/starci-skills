import {
    DynamicModule 
} from "@nestjs/common"
import {
    SignInSingleMutationModule 
} from "./session/sign-in/sign-in.module"
import {
    SignOutSingleMutationModule 
} from "./session/sign-out/sign-out.module"
import {
    CreateTaskSingleMutationModule 
} from "./task/create-task/create-task.module"
import {
    CompleteTaskSingleMutationModule 
} from "./task/complete-task/complete-task.module"
import {
    ReopenTaskSingleMutationModule 
} from "./task/reopen-task/reopen-task.module"
import {
    DeleteTaskSingleMutationModule 
} from "./task/delete-task/delete-task.module"
import {
    InviteSingleMutationModule 
} from "./share/invite/invite.module"
import {
    AcceptInvitationSingleMutationModule 
} from "./share/accept-invitation/accept-invitation.module"
import {
    RevokeCollaboratorSingleMutationModule 
} from "./share/revoke-collaborator/revoke-collaborator.module"
import {
    MakeRecurringSingleMutationModule 
} from "./recur/make-recurring/make-recurring.module"
import {
    EditRecurrenceSingleMutationModule 
} from "./recur/edit-recurrence/edit-recurrence.module"
import {
    EndRecurrenceSingleMutationModule 
} from "./recur/end-recurrence/end-recurrence.module"
import {
    UpdateNotificationPreferencesSingleMutationModule 
} from "./notify/update-notification-preferences/update-notification-preferences.module"
import {
    UnsubscribeSingleMutationModule 
} from "./notify/unsubscribe/unsubscribe.module"
import {
    RequestErasureSingleMutationModule 
} from "./audit/request-erasure/request-erasure.module"
import {
    CompleteErasureSingleMutationModule 
} from "./audit/complete-erasure/complete-erasure.module"
import {
    UpgradePlanSingleMutationModule 
} from "./plan/upgrade-plan/upgrade-plan.module"
import {
    DowngradePlanSingleMutationModule 
} from "./plan/downgrade-plan/downgrade-plan.module"
import {
    ReconcilePaymentSingleMutationModule 
} from "./plan/reconcile-payment/reconcile-payment.module"

/** Every GraphQL mutation module the todo API exposes, gathered exactly like nivo's own
 * `mutations/index.ts` gathers `MUTATION_MODULES`. */
export const MUTATION_MODULES: Array<DynamicModule | (new () => unknown)> = [
    SignInSingleMutationModule.register({
    }),
    SignOutSingleMutationModule.register({
    }),
    CreateTaskSingleMutationModule.register({
    }),
    CompleteTaskSingleMutationModule.register({
    }),
    ReopenTaskSingleMutationModule.register({
    }),
    DeleteTaskSingleMutationModule.register({
    }),
    InviteSingleMutationModule.register({
    }),
    AcceptInvitationSingleMutationModule.register({
    }),
    RevokeCollaboratorSingleMutationModule.register({
    }),
    MakeRecurringSingleMutationModule.register({
    }),
    EditRecurrenceSingleMutationModule.register({
    }),
    EndRecurrenceSingleMutationModule.register({
    }),
    UpdateNotificationPreferencesSingleMutationModule.register({
    }),
    UnsubscribeSingleMutationModule.register({
    }),
    RequestErasureSingleMutationModule.register({
    }),
    CompleteErasureSingleMutationModule.register({
    }),
    UpgradePlanSingleMutationModule.register({
    }),
    DowngradePlanSingleMutationModule.register({
    }),
    ReconcilePaymentSingleMutationModule.register({
    }),
]
