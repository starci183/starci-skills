"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useCollaborators, useInviteCollaborator, useRevokeCollaborator, useTaskTitle } from "@/hooks/share"
import { useSignOut } from "@/hooks/auth"
import { useAccountShellCopy } from "@/hooks/shell"
import type { ShareRole } from "@/modules/types"
import { ShareInviteView, type ShareInviteState } from "./component"

const EMAIL_FIELD_CODES = new Set(["SHARE_INVALID_EMAIL", "SHARE_INVITATION_ALREADY_EXISTS"])

/** The backend's stable domain code a failed mutation carries on its `cause`, when it carries one. */
const codeOf = (error: unknown): string | null =>
    error instanceof Error && error.cause instanceof Error ? error.cause.message : null

/** The share namespace's translator, the one the refusal sentences are read from. */
type ShareTranslator = ReturnType<typeof useTranslations<"share">>

/** The three lifecycles whose failures the screen reports, in the order the reader meets them. */
type ShareFailures = {
    readonly read: unknown
    readonly invite: unknown
    readonly revoke: unknown
}

/** The one refusal sentence the screen shows: the collaborators read first, then the invite, then the revoke. */
const refusalOf = (t: ShareTranslator, failures: ShareFailures, inviteCode: string | null): string | null => {
    if (failures.read) return t("sessionEnded")
    if (failures.invite) return inviteCode === "SHARE_INVALID_EMAIL" ? t("invalidEmail") : t("inviteRefusal")
    if (failures.revoke) return t("revokeRefusal")
    return null
}

/** The collaborator fields the state is read from. */
type CollaboratorStatus = {
    readonly status: string
}

/** Which state the view renders: a failure, a running invite, then what the collaborator list holds. */
const stateOf = (
    failures: ShareFailures,
    isInviting: boolean,
    collaborators: ReadonlyArray<CollaboratorStatus>,
): ShareInviteState => {
    if (failures.read || failures.invite || failures.revoke) return "refused"
    if (isInviting) return "inviting"
    if (collaborators.some((collaborator) => collaborator.status === "accepted")) return "accepted"
    return collaborators.length > 0 ? "pending-list" : "empty"
}

/** ShareInviteBlock's only external input: the task this screen shares, from the route's own params. */
type ShareInviteBlockProps = {
    readonly taskId: string
}

/**
 * The connected owner of ui.share.invite: it owns the collaborators query, the invite and revoke
 * mutations, the email/role draft, resolves the one state ShareInviteView renders, and hands the
 * only render path to the pure ShareInviteView in ./component.tsx.
 */
export const ShareInviteBlock = (props: ShareInviteBlockProps) => {
    const taskId = props.taskId
    const t = useTranslations("share")
    const tShell = useTranslations("shell")
    const shellCopy = useAccountShellCopy("share")
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<ShareRole>("viewer")
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const collaboratorsQuery = useCollaborators(taskId)
    const invite = useInviteCollaborator(taskId)
    const revoke = useRevokeCollaborator(taskId)
    const taskTitleQuery = useTaskTitle(taskId)
    const signOut = useSignOut()

    const collaborators = collaboratorsQuery.data ?? []
    const inviteCode = codeOf(invite.error)
    const failures: ShareFailures = { read: collaboratorsQuery.error, invite: invite.error, revoke: revoke.error }
    const refusal = refusalOf(t, failures, inviteCode)
    const refusalTarget: "email" | "form" = inviteCode !== null && EMAIL_FIELD_CODES.has(inviteCode) ? "email" : "form"

    const state = stateOf(failures, invite.isMutating, collaborators)

    const onInvite = () => {
        void invite.trigger({ email: email.trim(), role }, { throwOnError: false }).then((invited) => {
            if (invited !== undefined) setEmail("")
        })
    }

    const onRevoke = (invitationId: string, collaboratorEmail: string) => {
        if (!window.confirm(t("revokeConfirm", { email: collaboratorEmail }))) return
        setRevokingId(invitationId)
        void revoke.trigger({ invitationId }, { throwOnError: false }).then(() => setRevokingId(null))
    }

    return (
        <ShareInviteView
            state={state}
            collaborators={collaborators}
            taskTitle={taskTitleQuery.data ?? null}
            refusal={refusal}
            refusalTarget={refusalTarget}
            email={email}
            role={role}
            revokingId={revokingId}
            copy={{
                ...shellCopy,
                backToTask: tShell("backToTask"),
                heading: t("heading"),
                cardLabel: t("cardLabel"),
                inviteHeading: t("inviteHeading"),
                inviteTagline: t("inviteTagline"),
                emailLabel: t("emailLabel"),
                roleLabel: t("roleLabel"),
                roles: {
                    viewer: t("roles.viewer"),
                    editor: t("roles.editor"),
                },
                roleHint: t("roleHint"),
                sendInvitation: t("sendInvitation"),
                collaborators: t("collaborators"),
                pendingExpiry: t("pendingExpiry"),
                columnPerson: t("columnPerson"),
                columnAccess: t("columnAccess"),
                columnStatus: t("columnStatus"),
                statuses: {
                    pending: t("statuses.pending"),
                    accepted: t("statuses.accepted"),
                    expired: t("statuses.expired"),
                    revoked: t("statuses.revoked"),
                },
                revoke: t("revoke"),
            }}
            onEmailChange={setEmail}
            onRoleChange={setRole}
            onInvite={onInvite}
            onRevoke={onRevoke}
            onSignOut={signOut}
        />
    )
}
