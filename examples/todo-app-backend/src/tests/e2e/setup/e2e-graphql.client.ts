import { createE2EGraphqlTransport } from "@e2e-kit/integrations/graphql/e2e-graphql-transport"
import type { GraphqlCallOptions, GraphqlObserved } from "@e2e-kit/integrations/graphql/graphql-envelope"
import type { E2EStack } from "./e2e-stack.service"

/**
 * The public transport contract and nothing else: every user-facing call is one GraphQL operation to the api single
 * /graphql door. These are the operations the resolvers under src/features/todo/transport/graphql register; every
 * operation takes its arguments as one `request` (the argument name clients keep), and errors carry the declared code
 * on `errors[].extensions.code`.
 */
export const GRAPHQL_DOCUMENTS = {
    signIn: "mutation SignIn($input: SignInInput!) { signIn(request: $input) { sessionToken personId } }",
    signOut: "mutation SignOut($input: SignOutInput!) { signOut(request: $input) { signedOut } }",
    createTask: "mutation CreateTask($input: CreateTaskInput!) { createTask(request: $input) { taskId title } }",
    tasks: "query { tasks { taskId title complete } }",
    taskCounts: "query { taskCounts { open complete } }",
    completeTask: "mutation CompleteTask($input: CompleteTaskInput!) { completeTask(request: $input) { taskId complete } }",
    reopenTask: "mutation ReopenTask($input: ReopenTaskInput!) { reopenTask(request: $input) { taskId complete } }",
    deleteTask: "mutation DeleteTask($input: DeleteTaskInput!) { deleteTask(request: $input) { deleted } }",
    invite: "mutation Invite($input: InviteInput!) { invite(request: $input) { invitationId taskId email role status } }",
    acceptInvitation:
        "mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(request: $input) { invitationId role status } }",
    revokeCollaborator:
        "mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(request: $input) { invitationId status } }",
    collaborators:
        "query Collaborators($input: ListCollaboratorsInput!) { collaborators(request: $input) { invitationId email role status } }",
    auditLog: "query { auditLog { at action target } }",
    exportMyData: "query { exportMyData { at action target } }",
    requestErasure: "mutation { requestErasure { requestId state } }",
    completeErasure:
        "mutation CompleteErasure($input: CompleteErasureInput!) { completeErasure(request: $input) { requestId state } }",
    notificationPreferences:
        "query Prefs($input: NotificationPreferencesInput) { notificationPreferences(request: $input) { channel unsubscribed digestWindowMinutes } }",
    updateNotificationPreferences:
        "mutation UpdatePrefs($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(request: $input) { channel unsubscribed digestWindowMinutes } }",
    unsubscribe: "mutation Unsubscribe($input: UnsubscribeInput!) { unsubscribe(request: $input) { channel unsubscribed } }",
    planUsage: "query { planUsage { plan cap activeCount } }",
    upgradePlan: "mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }",
    downgradePlan: "mutation { downgradePlan { subscriptionId plan status } }",
    makeRecurring:
        "mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(request: $input) { ruleId title frequency timeZone time startDate } }",
    editRecurrence:
        "mutation EditRecurrence($input: EditRecurrenceInput!) { editRecurrence(request: $input) { ruleId frequency timeZone time } }",
    endRecurrence:
        "mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(request: $input) { ruleId endedAt orphanedCount } }",
    upcomingOccurrences:
        "query Upcoming($input: UpcomingOccurrencesInput!) { upcomingOccurrences(request: $input) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }",
    createUploadIntent:
        "mutation CreateUploadIntent($input: CreateUploadIntentInput!) { createUploadIntent(request: $input) { uploadId method url headers { name value } expiresAt } }",
    attachUpload:
        "mutation AttachUpload($input: AttachUploadInput!) { attachUpload(request: $input) { uploadId taskId filename mime sizeBytes status createdAt } }",
    taskUploads:
        "query TaskUploads($input: TaskUploadsInput!) { taskUploads(request: $input) { uploadId taskId filename mime sizeBytes status createdAt } }",
    deleteUpload: "mutation DeleteUpload($input: DeleteUploadInput!) { deleteUpload(request: $input) { uploadId deleted } }",
}

/** The GraphQL handle a spec drives: reads and mutations answer an observed envelope, so a refusal is data a spec asserts. */
export interface E2EGraphqlHandle {
    /** Sends a query: `document` is a key of GRAPHQL_DOCUMENTS or a document string. */
    read<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** Sends a mutation. */
    mutate<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
}

/** One GraphQL client per bearer, bound to the port this run allocated for the api. */
export class E2EGraphql {
    private readonly transport = createE2EGraphqlTransport({ documents: GRAPHQL_DOCUMENTS })

    constructor(private readonly stack: E2EStack) {}

    /** A client bound to the api, optionally carrying a bearer token; omitting it makes every call anonymous. */
    client(bearerToken?: string): E2EGraphqlHandle {
        const baseUrl = this.stack.baseUrl
        return {
            read: (document, callOptions) => this.transport.call(baseUrl, "query", document, { ...callOptions, token: bearerToken }),
            mutate: (document, callOptions) => this.transport.call(baseUrl, "mutate", document, { ...callOptions, token: bearerToken }),
        }
    }
}
