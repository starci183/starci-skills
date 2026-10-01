/** The response shapes the public doors answer with, as the specs read them (output types are named `<Action>Type`). */

/** What the `signIn` door answers with, before the data envelope wraps it. */
export interface SignInAnswer {
    sessionToken: string
    personId: string
}

/** The `data` member of a `signIn` mutation response, as a spec reads it. */
export interface SignInData {
    signIn: SignInAnswer
}

/** What the `signOut` door answers with, before the data envelope wraps it. */
export interface SignOutAnswer {
    signedOut: boolean
}

/** The `data` member of a `signOut` mutation response, as a spec reads it. */
export interface SignOutData {
    signOut: SignOutAnswer
}

/** One task as the tasks query answers it. */
export interface TaskEntry {
    taskId: string
    title: string
    complete: boolean
}

/** What the `createTask` door answers with, before the data envelope wraps it. */
export interface CreateTaskAnswer {
    taskId: string
    title: string
}

/** The `data` member of a `createTask` mutation response, as a spec reads it. */
export interface CreateTaskData {
    createTask: CreateTaskAnswer
}

/** The `data` member of a `tasks` query response, as a spec reads it. */
export interface TasksData {
    tasks: Array<TaskEntry>
}

/** What the `taskCounts` door answers with, before the data envelope wraps it. */
export interface TaskCountsAnswer {
    open: number
    complete: number
}

/** The `data` member of a `taskCounts` query response, as a spec reads it. */
export interface TaskCountsData {
    taskCounts: TaskCountsAnswer
}

/** The completeTask and reopenTask answer. */
export interface TaskCompletionAnswer {
    taskId: string
    complete: boolean
}

/** The `data` member of a `completeTask` mutation response, as a spec reads it. */
export interface CompleteTaskData {
    completeTask: TaskCompletionAnswer
}

/** The `data` member of a `reopenTask` mutation response, as a spec reads it. */
export interface ReopenTaskData {
    reopenTask: TaskCompletionAnswer
}

/** What the `deleteTask` door answers with, before the data envelope wraps it. */
export interface DeleteTaskAnswer {
    deleted: boolean
}

/** The `data` member of a `deleteTask` mutation response, as a spec reads it. */
export interface DeleteTaskData {
    deleteTask: DeleteTaskAnswer
}

/** One invitation as the invite, acceptInvitation, revokeCollaborator and collaborators doors answer with it. */
export interface InvitationEntry {
    invitationId: string
    email: string
    role: string
    status: string
}

/** The invite answer: the invitation and the task it is for. */
export interface InviteAnswer extends InvitationEntry {
    taskId: string
}

/** The `data` member of a `invite` mutation response, as a spec reads it. */
export interface InviteData {
    invite: InviteAnswer
}

/** What the `acceptInvitation` door answers with, before the data envelope wraps it. */
export interface AcceptInvitationAnswer {
    invitationId: string
    role: string
    status: string
}

/** The `data` member of a `acceptInvitation` mutation response, as a spec reads it. */
export interface AcceptInvitationData {
    acceptInvitation: AcceptInvitationAnswer
}

/** What the `revokeCollaborator` door answers with, before the data envelope wraps it. */
export interface RevokeCollaboratorAnswer {
    invitationId: string
    status: string
}

/** The `data` member of a `revokeCollaborator` mutation response, as a spec reads it. */
export interface RevokeCollaboratorData {
    revokeCollaborator: RevokeCollaboratorAnswer
}

/** The `data` member of a `collaborators` query response, as a spec reads it. */
export interface CollaboratorsData {
    collaborators: Array<InvitationEntry>
}

/** One audit line as the auditLog and exportMyData doors answer with it: never an actor, a key id or a chain position. */
export interface AuditLineEntry {
    at: string
    action: string
    target: string | null
}

/** The `data` member of a `auditLog` query response, as a spec reads it. */
export interface AuditLogData {
    auditLog: Array<AuditLineEntry>
}

/** The `data` member of a `exportMyData` query response, as a spec reads it. */
export interface ExportMyDataData {
    exportMyData: Array<AuditLineEntry>
}

/** The requestErasure and completeErasure answer. */
export interface ErasureAnswer {
    requestId: string
    state: string
}

/** The `data` member of a `requestErasure` mutation response, as a spec reads it. */
export interface RequestErasureData {
    requestErasure: ErasureAnswer
}

/** The `data` member of a `completeErasure` mutation response, as a spec reads it. */
export interface CompleteErasureData {
    completeErasure: ErasureAnswer
}

/** The notification preferences answer of the query and of the update mutation. */
export interface NotificationPreferencesAnswer {
    channel: string
    unsubscribed: boolean
    digestWindowMinutes: number | null
}

/** The `data` member of a `notificationPreferences` query response, as a spec reads it. */
export interface NotificationPreferencesData {
    notificationPreferences: NotificationPreferencesAnswer
}

/** The `data` member of a `updateNotificationPreferences` mutation response, as a spec reads it. */
export interface UpdateNotificationPreferencesData {
    updateNotificationPreferences: NotificationPreferencesAnswer
}

/** What the `unsubscribe` door answers with, before the data envelope wraps it. */
export interface UnsubscribeAnswer {
    channel: string
    unsubscribed: boolean
}

/** The `data` member of a `unsubscribe` mutation response, as a spec reads it. */
export interface UnsubscribeData {
    unsubscribe: UnsubscribeAnswer
}

/** What the `planUsage` door answers with, before the data envelope wraps it. */
export interface PlanUsageAnswer {
    plan: string
    cap: number | null
    activeCount: number
}

/** The `data` member of a `planUsage` query response, as a spec reads it. */
export interface PlanUsageData {
    planUsage: PlanUsageAnswer
}

/** What the `upgradePlan` door answers with, before the data envelope wraps it. */
export interface UpgradePlanAnswer {
    subscriptionId: string
    paymentIntentId: string
    checkoutUrl: string
    status: string
}

/** The `data` member of a `upgradePlan` mutation response, as a spec reads it. */
export interface UpgradePlanData {
    upgradePlan: UpgradePlanAnswer
}

/** What the `downgradePlan` door answers with, before the data envelope wraps it. */
export interface DowngradePlanAnswer {
    subscriptionId: string
    plan: string
    status: string
}

/** The `data` member of a `downgradePlan` mutation response, as a spec reads it. */
export interface DowngradePlanData {
    downgradePlan: DowngradePlanAnswer
}

/** The answer of the SePay webhook door: ignored, or what the confirmation changed. */
export interface SepayWebhookBody {
    ignored: boolean
    applied?: boolean
    subscriptionStatus?: string
}

/** What the `makeRecurring` door answers with, before the data envelope wraps it. */
export interface MakeRecurringAnswer {
    ruleId: string
    title: string
    frequency: string
    timeZone: string
    time: string
    startDate: string
}

/** The `data` member of a `makeRecurring` mutation response, as a spec reads it. */
export interface MakeRecurringData {
    makeRecurring: MakeRecurringAnswer
}

/** What the `editRecurrence` door answers with, before the data envelope wraps it. */
export interface EditRecurrenceAnswer {
    ruleId: string
    frequency: string
    timeZone: string
    time: string
}

/** The `data` member of a `editRecurrence` mutation response, as a spec reads it. */
export interface EditRecurrenceData {
    editRecurrence: EditRecurrenceAnswer
}

/** What the `endRecurrence` door answers with, before the data envelope wraps it. */
export interface EndRecurrenceAnswer {
    ruleId: string
    endedAt: string
    orphanedCount: number
}

/** The `data` member of a `endRecurrence` mutation response, as a spec reads it. */
export interface EndRecurrenceData {
    endRecurrence: EndRecurrenceAnswer
}

/** One materialised occurrence of a rule. */
export interface OccurrenceEntry {
    occurrenceId: string
    localDate: string
    dueAtUtc: string
    status: string
}

/** What the `upcomingOccurrences` door answers with, before the data envelope wraps it. */
export interface UpcomingOccurrencesAnswer {
    ruleId: string
    materialised: Array<OccurrenceEntry>
    previewDates: Array<string>
}

/** The `data` member of a `upcomingOccurrences` query response, as a spec reads it. */
export interface UpcomingOccurrencesData {
    upcomingOccurrences: UpcomingOccurrencesAnswer
}

/** One upload as the GraphQL control plane and the REST byte plane answer with it. */
export interface UploadEntry {
    uploadId: string
    taskId: string | null
    filename: string
    mime: string
    sizeBytes: number
    status: string
    createdAt: string
}

/** One header of a presigned request. */
export interface UploadHeaderEntry {
    name: string
    value: string
}

/** The createUploadIntent answer: a presigned PUT the caller fulfils on the byte plane. */
export interface CreateUploadIntentAnswer {
    uploadId: string
    method: string
    url: string
    headers: Array<UploadHeaderEntry>
    expiresAt: string
}

/** The `data` member of a `createUploadIntent` mutation response, as a spec reads it. */
export interface CreateUploadIntentData {
    createUploadIntent: CreateUploadIntentAnswer
}

/** The `data` member of a `attachUpload` mutation response, as a spec reads it. */
export interface AttachUploadData {
    attachUpload: UploadEntry
}

/** The `data` member of a `taskUploads` query response, as a spec reads it. */
export interface TaskUploadsData {
    taskUploads: Array<UploadEntry>
}

/** What the `deleteUpload` door answers with, before the data envelope wraps it. */
export interface DeleteUploadAnswer {
    uploadId: string
    deleted: boolean
}

/** The `data` member of a `deleteUpload` mutation response, as a spec reads it. */
export interface DeleteUploadData {
    deleteUpload: DeleteUploadAnswer
}

/** The body a REST door answers a refusal with: the declared code, the kind and the localized message. */
export interface RestErrorBody {
    code: string
    kind: string
    message: string
}
