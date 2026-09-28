"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useCollaborators, useInviteCollaborator, useRevokeCollaborator, useTaskTitle } from "@/hooks/share"
import { useSignOut } from "@/hooks/auth"
import type { ShareRole } from "@/modules/api/share"
import { ShareInviteView, type ShareInviteState } from "./component"

const EMAIL_FIELD_CODES = new Set(["SHARE_INVALID_EMAIL", "SHARE_INVITATION_ALREADY_EXISTS"])

const messageOf = (error: unknown): string | null => (error instanceof Error ? error.message : null)
const codeOf = (error: unknown): string | null =>
    error instanceof Error && error.cause instanceof Error ? error.cause.message : null

/** ShareInviteBlock's only external input: the task this screen shares, from the route's own params. */
export type ShareInviteBlockProps = {
  readonly taskId: string;
};

/**
 * The connected owner of ui.share.invite: it owns the collaborators query, the invite and revoke
 * mutations, the email/role draft, resolves the one state ShareInviteView renders, and hands the
 * only render path to the pure ShareInviteView in ./component.tsx.
 */
export const ShareInviteBlock = (props: ShareInviteBlockProps) => {
    const taskId = props.taskId
    const t = useTranslations("share")
    const tShell = useTranslations("shell")
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
    const refusal = collaboratorsQuery.error
        ? t("sessionEnded")
        : invite.error
            ? inviteCode === "SHARE_INVALID_EMAIL"
                ? t("invalidEmail")
                : messageOf(invite.error)
            : messageOf(revoke.error)
    const refusalTarget: "email" | "form" = inviteCode !== null && EMAIL_FIELD_CODES.has(inviteCode) ? "email" : "form"

    const state: ShareInviteState = collaboratorsQuery.error || invite.error || revoke.error
        ? "refused"
        : invite.isMutating
            ? "inviting"
            : collaborators.some(collaborator => collaborator.status === "accepted")
                ? "accepted"
                : collaborators.length > 0
                    ? "pending-list"
                    : "empty"

    const onInvite = () => {
        void invite
            .trigger({ email: email.trim(), role })
            .then(() => setEmail(""))
            .catch(() => {})
    }

    const onRevoke = (invitationId: string, collaboratorEmail: string) => {
        if (!window.confirm(t("revokeConfirm", { email: collaboratorEmail }))) return
        setRevokingId(invitationId)
        void revoke
            .trigger({ invitationId })
            .catch(() => {})
            .finally(() => setRevokingId(null))
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
                brand: tShell("brand"),
                accountName: tShell("accountName"),
                signOut: tShell("signOut"),
                navLabel: tShell("navPrimaryDestinations"),
                breadcrumbLabel: tShell("breadcrumb"),
                destinations: {
                    tasks: tShell("destinations.tasks"),
                    notifications: tShell("destinations.notifications"),
                    plan: tShell("destinations.plan"),
                    privacy: tShell("destinations.privacy"),
                },
                legal: {
                    privacyPolicy: tShell("legal.privacyPolicy"),
                    terms: tShell("legal.terms"),
                },
                backToTask: tShell("backToTask"),
                mainLabel: t("mainLabel"),
                breadcrumbSharing: t("breadcrumbSharing"),
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
