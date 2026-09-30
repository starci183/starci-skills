/** The response shapes the public doors answer with, as the specs read them (output types are named `<Action>Type`). */

/** The signIn mutation data. */
export interface SignInData {
    signIn: { sessionToken: string; personId: string }
}

/** The signOut mutation data. */
export interface SignOutData {
    signOut: { signedOut: boolean }
}

/** One task as the tasks query answers it. */
export interface TaskView {
    taskId: string
    title: string
    complete: boolean
}

/** The createTask mutation data. */
export interface CreateTaskData {
    createTask: { taskId: string; title: string }
}

/** The tasks query data. */
export interface TasksData {
    tasks: Array<TaskView>
}

/** The taskCounts query data. */
export interface TaskCountsData {
    taskCounts: { open: number; complete: number }
}

/** The completeTask mutation data. */
export interface CompleteTaskData {
    completeTask: { taskId: string; complete: boolean }
}

/** The reopenTask mutation data. */
export interface ReopenTaskData {
    reopenTask: { taskId: string; complete: boolean }
}

/** The deleteTask mutation data. */
export interface DeleteTaskData {
    deleteTask: { deleted: boolean }
}

/** One invitation as the invite, acceptInvitation, revokeCollaborator and collaborators doors answer with it. */
export interface InvitationView {
    invitationId: string
    email: string
    role: string
    status: string
}

/** The invite mutation data. */
export interface InviteData {
    invite: InvitationView & { taskId: string }
}

/** The acceptInvitation mutation data. */
export interface AcceptInvitationData {
    acceptInvitation: { invitationId: string; role: string; status: string }
}

/** The revokeCollaborator mutation data. */
export interface RevokeCollaboratorData {
    revokeCollaborator: { invitationId: string; status: string }
}

/** The collaborators query data. */
export interface CollaboratorsData {
    collaborators: Array<InvitationView>
}

/** One audit line as the auditLog and exportMyData doors answer with it: never an actor, a key id or a chain position. */
export interface AuditLineView {
    at: string
    action: string
    target: string | null
}

/** The auditLog query data. */
export interface AuditLogData {
    auditLog: Array<AuditLineView>
}

/** The exportMyData query data. */
export interface ExportMyDataData {
    exportMyData: Array<AuditLineView>
}

/** The requestErasure mutation data. */
export interface RequestErasureData {
    requestErasure: { requestId: string; state: string }
}

/** The completeErasure mutation data. */
export interface CompleteErasureData {
    completeErasure: { requestId: string; state: string }
}

/** The notificationPreferences query data. */
export interface NotificationPreferencesData {
    notificationPreferences: { channel: string; unsubscribed: boolean; digestWindowMinutes: number | null }
}

/** The updateNotificationPreferences mutation data. */
export interface UpdateNotificationPreferencesData {
    updateNotificationPreferences: { channel: string; unsubscribed: boolean; digestWindowMinutes: number | null }
}

/** The unsubscribe mutation data. */
export interface UnsubscribeData {
    unsubscribe: { channel: string; unsubscribed: boolean }
}

/** The planUsage query data. */
export interface PlanUsageData {
    planUsage: { plan: string; cap: number | null; activeCount: number }
}

/** The upgradePlan mutation data. */
export interface UpgradePlanData {
    upgradePlan: { subscriptionId: string; paymentIntentId: string; checkoutUrl: string; status: string }
}

/** The downgradePlan mutation data. */
export interface DowngradePlanData {
    downgradePlan: { subscriptionId: string; plan: string; status: string }
}

/** The answer of the SePay webhook door: ignored, or what the confirmation changed. */
export interface SepayWebhookBody {
    ignored: boolean
    applied?: boolean
    subscriptionStatus?: string
}

/** The makeRecurring mutation data. */
export interface MakeRecurringData {
    makeRecurring: { ruleId: string; title: string; frequency: string; timeZone: string; time: string; startDate: string }
}

/** The editRecurrence mutation data. */
export interface EditRecurrenceData {
    editRecurrence: { ruleId: string; frequency: string; timeZone: string; time: string }
}

/** The endRecurrence mutation data. */
export interface EndRecurrenceData {
    endRecurrence: { ruleId: string; endedAt: string; orphanedCount: number }
}

/** One materialised occurrence of a rule. */
export interface OccurrenceView {
    occurrenceId: string
    localDate: string
    dueAtUtc: string
    status: string
}

/** The upcomingOccurrences query data. */
export interface UpcomingOccurrencesData {
    upcomingOccurrences: { ruleId: string; materialised: Array<OccurrenceView>; previewDates: Array<string> }
}

/** One upload as the GraphQL control plane and the REST byte plane answer with it. */
export interface UploadView {
    uploadId: string
    taskId: string | null
    filename: string
    mime: string
    sizeBytes: number
    status: string
    createdAt: string
}

/** The createUploadIntent mutation data: a presigned PUT the caller fulfils on the byte plane. */
export interface CreateUploadIntentData {
    createUploadIntent: {
        uploadId: string
        method: string
        url: string
        headers: Array<{ name: string; value: string }>
        expiresAt: string
    }
}

/** The attachUpload mutation data. */
export interface AttachUploadData {
    attachUpload: UploadView
}

/** The taskUploads query data. */
export interface TaskUploadsData {
    taskUploads: Array<UploadView>
}

/** The deleteUpload mutation data. */
export interface DeleteUploadData {
    deleteUpload: { uploadId: string; deleted: boolean }
}

/** The body a REST door answers a refusal with: the declared code, the kind and the localized message. */
export interface RestErrorBody {
    code: string
    kind: string
    message: string
}
