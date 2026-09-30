/**
 * The public transport contract and nothing else: every user-facing call is one GraphQL operation to the api single
 * /graphql door. These are the operations the resolvers under src/features/todo/transport/graphql register; every
 * operation takes its arguments as one `request` (the argument name clients keep), and errors carry the declared code on
 * `errors[].extensions.code`. A spec names an operation by its key here.
 */
export const TODO_OPERATIONS = {
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    signOut: "mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }",
    createTask: "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }",
    tasks: "query { tasks { taskId title complete } }",
    taskCounts: "query { taskCounts { open complete } }",
    completeTask:
        "mutation CompleteTask($input: CompleteTaskInput!) { completeTask(input: $input) { taskId complete } }",
    reopenTask: "mutation ReopenTask($input: ReopenTaskInput!) { reopenTask(input: $input) { taskId complete } }",
    deleteTask: "mutation DeleteTask($input: DeleteTaskInput!) { deleteTask(input: $input) { deleted } }",
    invite: "mutation Invite($input: InviteInput!) { invite(input: $input) { invitationId taskId email role status } }",
    acceptInvitation:
        "mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { invitationId role status } }",
    revokeCollaborator:
        "mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(input: $input) { invitationId status } }",
    collaborators:
        "query Collaborators($input: ListCollaboratorsInput!) { collaborators(input: $input) { invitationId email role status } }",
    auditLog: "query { auditLog { at action target } }",
    exportMyData: "query { exportMyData { at action target } }",
    requestErasure: "mutation { requestErasure { requestId state } }",
    completeErasure:
        "mutation CompleteErasure($input: CompleteErasureInput!) { completeErasure(input: $input) { requestId state } }",
    notificationPreferences:
        "query Prefs($input: NotificationPreferencesInput) { notificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }",
    updateNotificationPreferences:
        "mutation UpdatePrefs($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }",
    unsubscribe:
        "mutation Unsubscribe($input: UnsubscribeInput!) { unsubscribe(input: $input) { channel unsubscribed } }",
    planUsage: "query { planUsage { plan cap activeCount } }",
    upgradePlan: "mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }",
    downgradePlan: "mutation { downgradePlan { subscriptionId plan status } }",
    makeRecurring:
        "mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }",
    editRecurrence:
        "mutation EditRecurrence($input: EditRecurrenceInput!) { editRecurrence(input: $input) { ruleId frequency timeZone time } }",
    endRecurrence:
        "mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }",
    upcomingOccurrences:
        "query Upcoming($input: UpcomingOccurrencesInput!) { upcomingOccurrences(input: $input) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }",
    createUploadIntent:
        "mutation CreateUploadIntent($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { uploadId method url headers { name value } expiresAt } }",
    attachUpload:
        "mutation AttachUpload($input: AttachUploadInput!) { attachUpload(input: $input) { uploadId taskId filename mime sizeBytes status createdAt } }",
    taskUploads:
        "query TaskUploads($input: TaskUploadsInput!) { taskUploads(input: $input) { uploadId taskId filename mime sizeBytes status createdAt } }",
    deleteUpload:
        "mutation DeleteUpload($input: DeleteUploadInput!) { deleteUpload(input: $input) { uploadId deleted } }",
} as const

/** The name of one operation of the todo api. */
export type TodoOperation = keyof typeof TODO_OPERATIONS
