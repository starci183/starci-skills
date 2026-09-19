/*
 * v3-9 lane helper: inserts an authored JSDoc line directly before each
 * `require-export-jsdoc`-flagged export line (doc lands between the last
 * decorator and `export`, exactly where the canon rule wants it).
 * Insertions per file run bottom-up so earlier line numbers stay valid.
 */
const fs = require("fs")
const path = require("path")

const ROOT = "D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend"

// file -> [{ line: <1-based export line at lint time>, doc: "..." }]
const DOCS = {
    "src/features/todo/graphql/graphql.module.ts": [
        {
            line: 66,
            doc: "Composition for the todo GraphQL API: code-first Apollo plus every query and mutation module; the formatError closure above is what carries AbstractException codes onto extensions.code.",
        },
    ],
    "src/features/todo/graphql/session-actor.adapter.ts": [
        {
            line: 36,
            doc: "Resolves the request's `Authorization: Bearer` token through SessionService.findActive and returns the session's personId - the actor every resolver puts on its command or query.",
        },
    ],
    "src/features/todo/http/health/health.controller.ts": [
        {
            line: 17,
            doc: "GET /health - the api's one anonymous door: answers ok only when the primary postgres dependency answers, so an orchestrator's probe sees a real readiness signal.",
        },
    ],
    "src/features/todo/http/health/health.module.ts": [
        {
            line: 16,
            doc: "Mounts HealthController beside its feature and registers the primary postgres module the probe injects - see the boundary note above.",
        },
    ],
    "src/features/todo/http/webhooks/sepay/sepay-webhook.controller.ts": [
        {
            line: 36,
            doc: "POST /webhooks/sepay - the gateway's signed intake door; an unauthorized delivery is ignored with a 200, never propagated (see the boundary rationale above).",
        },
    ],
    "src/features/todo/http/webhooks/sepay/sepay-webhook.module.ts": [
        {
            line: 27,
            doc: "Mounts SepayWebhookController and registers SepayModule because the controller injects SepayClient directly - see the boundary note above.",
        },
    ],

    // -- audit ---------------------------------------------------------------
    "src/features/todo/graphql/mutations/audit/complete-erasure/complete-erasure.module.ts": [
        {
            line: 18,
            doc: "completeErasure's module: mounts CompleteErasureResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/audit/complete-erasure/complete-erasure.resolver.ts": [
        {
            line: 25,
            doc: "The fr.audit.erasure.complete door: finishes the caller's verified erasure request - the key is crypto-shredded and the request row anonymized in the same call.",
        },
    ],
    "src/features/todo/graphql/mutations/audit/complete-erasure/graphql-types/response.ts": [
        {
            line: 6,
            doc: "completeErasure's payload: the requestId and its now-'complete' state.",
        },
    ],
    "src/features/todo/graphql/mutations/audit/request-erasure/request-erasure.module.ts": [
        {
            line: 20,
            doc: "requestErasure's module: mounts RequestErasureResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/audit/request-erasure/request-erasure.resolver.ts": [
        {
            line: 24,
            doc: "The fr.audit.erasure.request door: opens the caller's erasure request and verifies it in the same call - returns the requestId the completion mutation later takes.",
        },
    ],
    "src/features/todo/graphql/mutations/audit/request-erasure/graphql-types/response.ts": [
        {
            line: 6,
            doc: "requestErasure's payload: the new requestId and its already-'verified' state.",
        },
    ],
    "src/features/todo/graphql/queries/audit/audit-log/audit-log.module.ts": [
        {
            line: 18,
            doc: "auditLog's module: mounts AuditLogResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/audit/audit-log/audit-log.resolver.ts": [
        {
            line: 28,
            doc: "The fr.audit.log.read door: returns the caller's own audit lines, decrypted under their per-person key.",
        },
    ],
    "src/features/todo/graphql/queries/audit/audit-log/graphql-types/response.ts": [
        {
            line: 6,
            doc: "One decrypted audit line: at, action, target - the actor and keyId stay server-side.",
        },
    ],
    "src/features/todo/graphql/queries/audit/export-my-data/export-my-data.module.ts": [
        {
            line: 18,
            doc: "exportMyData's module: mounts ExportMyDataResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/audit/export-my-data/export-my-data.resolver.ts": [
        {
            line: 22,
            doc: "The fr.audit.export door: the caller's audit lines as a portable export - the same decrypted lines auditLog reads.",
        },
    ],
    "src/features/todo/graphql/queries/audit/export-my-data/graphql-types/response.ts": [
        {
            line: 6,
            doc: "One exported audit line: at, action, target - the same shape auditLog returns.",
        },
    ],

    // -- notify --------------------------------------------------------------
    "src/features/todo/graphql/mutations/notify/unsubscribe/unsubscribe.module.ts": [
        {
            line: 18,
            doc: "unsubscribe's module: mounts UnsubscribeResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/unsubscribe/unsubscribe.resolver.ts": [
        {
            line: 24,
            doc: "The fr.notify.unsubscribe door: marks the caller's channel unsubscribed so later events are suppressed at admission - before any digest window or transport attempt.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/unsubscribe/graphql-types/input.ts": [
        {
            line: 9,
            doc: "unsubscribe's argument: the one channel the caller unsubscribes from.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/unsubscribe/graphql-types/response.ts": [
        {
            line: 6,
            doc: "unsubscribe's payload: the channel and its now-true unsubscribed flag.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/update-notification-preferences/update-notification-preferences.module.ts": [
        {
            line: 20,
            doc: "updateNotificationPreferences' module: mounts UpdateNotificationPreferencesResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/update-notification-preferences/update-notification-preferences.resolver.ts": [
        {
            line: 25,
            doc: "The fr.notify.preferences.update door: writes the caller's channel subscription state and optional digest window - honored by the next admission.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/update-notification-preferences/graphql-types/input.ts": [
        {
            line: 9,
            doc: "The preference write: channel plus the fields to change - unsubscribed flag and/or digestWindowMinutes.",
        },
    ],
    "src/features/todo/graphql/mutations/notify/update-notification-preferences/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The channel's stored preferences after the write: unsubscribed flag and digest window.",
        },
    ],
    "src/features/todo/graphql/queries/notify/notification-preferences/notification-preferences.module.ts": [
        {
            line: 18,
            doc: "notificationPreferences' module: mounts NotificationPreferencesResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/notify/notification-preferences/notification-preferences.resolver.ts": [
        {
            line: 23,
            doc: "The fr.notify.preferences.read door: the caller's subscription state and digest window for one channel - defaults when no row was ever written.",
        },
    ],
    "src/features/todo/graphql/queries/notify/notification-preferences/graphql-types/response.ts": [
        {
            line: 6,
            doc: "One channel's stored preferences: unsubscribed flag and digest window.",
        },
    ],

    // -- plan ----------------------------------------------------------------
    "src/features/todo/graphql/mutations/plan/downgrade-plan/downgrade-plan.module.ts": [
        {
            line: 19,
            doc: "downgradePlan's module: mounts DowngradePlanResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/downgrade-plan/downgrade-plan.resolver.ts": [
        {
            line: 21,
            doc: "The fr.plan.downgrade door: flips the subscription back to free immediately - accept-and-freeze, so the cap guard simply resumes refusing creates from the real count.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/downgrade-plan/graphql-types/response.ts": [
        {
            line: 6,
            doc: "downgradePlan's payload: the subscriptionId and its free plan/status after the flip.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/reconcile-payment/reconcile-payment.module.ts": [
        {
            line: 19,
            doc: "reconcilePayment's module: mounts ReconcilePaymentResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/reconcile-payment/reconcile-payment.resolver.ts": [
        {
            line: 27,
            doc: "The fr.plan.reconcile door: asks the gateway for a payment intent's live state and applies the confirmed transition when one arrives - the pull-side of webhook delivery.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/reconcile-payment/graphql-types/input.ts": [
        {
            line: 9,
            doc: "reconcilePayment's argument object - empty today: the caller's pending intent is resolved server-side.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/reconcile-payment/graphql-types/response.ts": [
        {
            line: 6,
            doc: "What the gateway said plus what it caused: gatewayStatus, applied, subscriptionStatus.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/upgrade-plan/upgrade-plan.module.ts": [
        {
            line: 21,
            doc: "upgradePlan's module: mounts UpgradePlanResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/upgrade-plan/upgrade-plan.resolver.ts": [
        {
            line: 21,
            doc: "The fr.plan.upgrade door: starts checkout - writes the pending subscription and payment intent, returns the gateway's checkout URL for the caller to pay through.",
        },
    ],
    "src/features/todo/graphql/mutations/plan/upgrade-plan/graphql-types/response.ts": [
        {
            line: 6,
            doc: "Checkout's opening state: subscriptionId, paymentIntentId, the gateway's checkoutUrl, status 'pending'.",
        },
    ],
    "src/features/todo/graphql/queries/plan/plan-usage/plan-usage.module.ts": [
        {
            line: 23,
            doc: "usage's module: mounts PlanUsageResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/plan/plan-usage/plan-usage.resolver.ts": [
        {
            line: 23,
            doc: "The fr.plan.usage door: the caller's effective plan, its active-task cap (null while paid) and the current active count.",
        },
    ],
    "src/features/todo/graphql/queries/plan/plan-usage/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The caller's plan snapshot: plan name, active-task cap (null on paid), current activeCount.",
        },
    ],

    // -- recur ---------------------------------------------------------------
    "src/features/todo/graphql/mutations/recur/edit-recurrence/edit-recurrence.module.ts": [
        {
            line: 18,
            doc: "editRecurrence's module: mounts EditRecurrenceResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/edit-recurrence/edit-recurrence.resolver.ts": [
        {
            line: 24,
            doc: "The fr.recur.edit door: rewrites a rule's cadence/time for future occurrences while already-materialised history stays byte-identical.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/edit-recurrence/graphql-types/input.ts": [
        {
            line: 12,
            doc: "The rule patch: ruleId plus any of frequency/n/dayOfMonth/timeZone/time - absent fields keep their current value.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/edit-recurrence/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The rule's new shape after the edit: ruleId, frequency, timeZone, time.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/end-recurrence/end-recurrence.module.ts": [
        {
            line: 18,
            doc: "endRecurrence's module: mounts EndRecurrenceResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/end-recurrence/end-recurrence.resolver.ts": [
        {
            line: 24,
            doc: "The fr.recur.end door: ends a rule at a date - occurrences on-or-after it orphan, earlier history is preserved.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/end-recurrence/graphql-types/input.ts": [
        {
            line: 9,
            doc: "endRecurrence's argument: ruleId and the local date the rule ends at.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/end-recurrence/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The end's outcome: ruleId, endedAt, and how many occurrences the end orphaned.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/make-recurring/make-recurring.module.ts": [
        {
            line: 20,
            doc: "makeRecurring's module: mounts MakeRecurringResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/make-recurring/make-recurring.resolver.ts": [
        {
            line: 24,
            doc: "The fr.recur.make door: turns a title into a recurrence rule - cadence, time zone, local fire time and start date.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/make-recurring/graphql-types/input.ts": [
        {
            line: 24,
            doc: "The new rule's shape: title, frequency (plus n/dayOfMonth when the cadence needs them), timeZone, local time, startDate.",
        },
        {
            line: 8,
            doc: "The cadence choices a rule accepts; each member's doc says what choosing it schedules.",
        },
    ],
    "src/features/todo/graphql/mutations/recur/make-recurring/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The created rule: ruleId plus the stored cadence fields.",
        },
    ],
    "src/features/todo/graphql/queries/recur/upcoming-occurrences/upcoming-occurrences.module.ts": [
        {
            line: 18,
            doc: "upcomingOccurrences' module: mounts UpcomingOccurrencesResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/recur/upcoming-occurrences/upcoming-occurrences.resolver.ts": [
        {
            line: 23,
            doc: "The fr.recur.upcoming door: a rule's materialised occurrences plus the live-computed preview dates the rule would still fire on.",
        },
    ],
    "src/features/todo/graphql/queries/recur/upcoming-occurrences/graphql-types/response.ts": [
        {
            line: 28,
            doc: "A rule's occurrence picture: materialised rows plus live-computed previewDates.",
        },
        {
            line: 6,
            doc: "One materialised occurrence: occurrenceId (the task it spawned), localDate, dueAtUtc, status.",
        },
    ],

    // -- session -------------------------------------------------------------
    "src/features/todo/graphql/mutations/session/sign-in/sign-in.module.ts": [
        {
            line: 20,
            doc: "signIn's module: mounts SignInResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-in/sign-in.resolver.ts": [
        {
            line: 23,
            doc: "The fr.login.sign-in door: email+password in, a Postgres-backed session token and personId out - the one anonymous mutation.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-in/graphql-types/input.ts": [
        {
            line: 11,
            doc: "signIn's credentials: account email and password, validated at the transport boundary.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-in/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The new session: the token clients present as `Authorization: Bearer`, and the personId it resolves to.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-out/sign-out.module.ts": [
        {
            line: 18,
            doc: "signOut's module: mounts SignOutResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-out/sign-out.resolver.ts": [
        {
            line: 21,
            doc: "The fr.login.sign-out door: destroys the presented session row so the token stops resolving to an actor.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-out/graphql-types/input.ts": [
        {
            line: 9,
            doc: "signOut's argument: the sessionToken the caller wants destroyed.",
        },
    ],
    "src/features/todo/graphql/mutations/session/sign-out/graphql-types/response.ts": [
        {
            line: 6,
            doc: "signOut's payload: signedOut - true once the session row is gone.",
        },
    ],

    // -- share ---------------------------------------------------------------
    "src/features/todo/graphql/mutations/share/accept-invitation/accept-invitation.module.ts": [
        {
            line: 18,
            doc: "acceptInvitation's module: mounts AcceptInvitationResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/share/accept-invitation/accept-invitation.resolver.ts": [
        {
            line: 24,
            doc: "The fr.share.accept door: the invitee names its own email, binding personId to the invitation and activating the role in the same call.",
        },
    ],
    "src/features/todo/graphql/mutations/share/accept-invitation/graphql-types/input.ts": [
        {
            line: 9,
            doc: "acceptInvitation's argument: the invitationId plus the invitee's own email - the accept call binds them together.",
        },
    ],
    "src/features/todo/graphql/mutations/share/accept-invitation/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The invitation after accept: id, role, status 'accepted'.",
        },
    ],
    "src/features/todo/graphql/mutations/share/invite/invite.module.ts": [
        {
            line: 20,
            doc: "invite's module: mounts InviteResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/share/invite/invite.resolver.ts": [
        {
            line: 27,
            doc: "The fr.share.invite door: the owner creates a pending invitation on one of their tasks, addressed to an email with a role.",
        },
    ],
    "src/features/todo/graphql/mutations/share/invite/graphql-types/input.ts": [
        {
            line: 9,
            doc: "invite's argument: taskId, the invitee's email and the role to grant on accept.",
        },
    ],
    "src/features/todo/graphql/mutations/share/invite/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The created invitation: id, taskId, email, role, status 'pending'.",
        },
    ],
    "src/features/todo/graphql/mutations/share/revoke-collaborator/revoke-collaborator.module.ts": [
        {
            line: 18,
            doc: "revokeCollaborator's module: mounts RevokeCollaboratorResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/share/revoke-collaborator/revoke-collaborator.resolver.ts": [
        {
            line: 24,
            doc: "The fr.share.revoke door: flips the invitation to revoked and evicts the collaborator cache entry in the same call - access ends immediately, not by sweep.",
        },
    ],
    "src/features/todo/graphql/mutations/share/revoke-collaborator/graphql-types/input.ts": [
        {
            line: 9,
            doc: "revokeCollaborator's argument: the invitationId the owner revokes.",
        },
    ],
    "src/features/todo/graphql/mutations/share/revoke-collaborator/graphql-types/response.ts": [
        {
            line: 6,
            doc: "The invitation after revoke: id and status 'revoked'.",
        },
    ],
    "src/features/todo/graphql/queries/share/collaborators/collaborators.module.ts": [
        {
            line: 18,
            doc: "collaborators' module: mounts CollaboratorsResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/share/collaborators/collaborators.resolver.ts": [
        {
            line: 23,
            doc: "The fr.share.collaborators door: the invitations attached to a task - readable by its owner or a bound collaborator.",
        },
    ],
    "src/features/todo/graphql/queries/share/collaborators/graphql-types/response.ts": [
        {
            line: 6,
            doc: "One invitation on the task: id, email, role, status.",
        },
    ],

    // -- task ----------------------------------------------------------------
    "src/features/todo/graphql/mutations/task/complete-task/complete-task.module.ts": [
        {
            line: 20,
            doc: "completeTask's module: mounts CompleteTaskResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/task/complete-task/complete-task.resolver.ts": [
        {
            line: 21,
            doc: "The fr.task.complete door: marks the caller's task complete and stamps its completed timestamp.",
        },
    ],
    "src/features/todo/graphql/mutations/task/complete-task/graphql-types/response.ts": [
        {
            line: 6,
            doc: "completeTask's payload: the taskId and its now-true complete flag.",
        },
    ],
    "src/features/todo/graphql/mutations/task/create-task/create-task.module.ts": [
        {
            line: 28,
            doc: "createTask's module: mounts CreateTaskResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/task/create-task/create-task.resolver.ts": [
        {
            line: 24,
            doc: "The fr.task.create door: creates a task for the caller - refused when the effective plan's active-task cap is already full.",
        },
    ],
    "src/features/todo/graphql/mutations/task/create-task/graphql-types/input.ts": [
        {
            line: 9,
            doc: "createTask's argument: the new task's title - the only field the door takes.",
        },
    ],
    "src/features/todo/graphql/mutations/task/create-task/graphql-types/response.ts": [
        {
            line: 6,
            doc: "createTask's payload: the created task's id and title.",
        },
    ],
    "src/features/todo/graphql/mutations/task/delete-task/delete-task.module.ts": [
        {
            line: 18,
            doc: "deleteTask's module: mounts DeleteTaskResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/task/delete-task/delete-task.resolver.ts": [
        {
            line: 21,
            doc: "The fr.task.delete door: removes the caller's task row.",
        },
    ],
    "src/features/todo/graphql/mutations/task/delete-task/graphql-types/response.ts": [
        {
            line: 6,
            doc: "deleteTask's payload: deleted - true once the row is gone.",
        },
    ],
    "src/features/todo/graphql/mutations/task/reopen-task/reopen-task.module.ts": [
        {
            line: 18,
            doc: "reopenTask's module: mounts ReopenTaskResolver; the command handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/mutations/task/reopen-task/reopen-task.resolver.ts": [
        {
            line: 21,
            doc: "The fr.task.reopen door: flips a completed task back to open and clears its completed timestamp.",
        },
    ],
    "src/features/todo/graphql/mutations/task/reopen-task/graphql-types/response.ts": [
        {
            line: 6,
            doc: "reopenTask's payload: the taskId and its now-false complete flag.",
        },
    ],
    "src/features/todo/graphql/queries/task/list-tasks/list-tasks.module.ts": [
        {
            line: 18,
            doc: "tasks' module: mounts ListTasksResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/task/list-tasks/list-tasks.resolver.ts": [
        {
            line: 23,
            doc: "The fr.task.list door: the caller's own tasks - ownership only, sharing never widens this list.",
        },
    ],
    "src/features/todo/graphql/queries/task/list-tasks/graphql-types/response.ts": [
        {
            line: 6,
            doc: "One task in the list: taskId, title, complete.",
        },
    ],
    "src/features/todo/graphql/queries/task/task-counts/task-counts.module.ts": [
        {
            line: 18,
            doc: "taskCounts' module: mounts TaskCountsResolver; the query handler is discovered app-wide through CqrsModule.",
        },
    ],
    "src/features/todo/graphql/queries/task/task-counts/task-counts.resolver.ts": [
        {
            line: 25,
            doc: "The fr.task.counts door: the caller's open and complete task counts.",
        },
    ],
    "src/features/todo/graphql/queries/task/task-counts/graphql-types/response.ts": [
        {
            line: 9,
            doc: "taskCounts' payload: open and complete counts for the caller's own tasks.",
        },
    ],
}

let touched = 0
for (const [rel, entries] of Object.entries(DOCS)) {
    const file = path.join(ROOT, rel)
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    const sorted = [...entries].sort((a, b) => b.line - a.line)
    for (const { line, doc } of sorted) {
        const target = lines[line - 1] || ""
        if (!/\bexport\b/.test(target)) {
            console.error(`SKIP ${rel}:${line} - no export on that line: ${target.trim()}`)
            continue
        }
        lines.splice(line - 1, 0, `/** ${doc} */`)
        touched++
    }
    fs.writeFileSync(file, lines.join("\n"))
}
console.log(`inserted ${touched} doc blocks`)
