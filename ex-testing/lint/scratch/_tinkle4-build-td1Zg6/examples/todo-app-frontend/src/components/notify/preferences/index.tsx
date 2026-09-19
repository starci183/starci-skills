"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { useSessionToken } from "@/hooks/auth"
import { clearToken } from "@/modules/session"
import { endSession, readNotificationPreferences, unsubscribeFromEmail, updateNotificationPreferences } from "../api"
import { NotifyPreferencesView, type NotifyPreferencesState } from "./component"

/** NotifyPreferencesBlock takes no external props; the query, mutations and draft state are its own. */
export type NotifyPreferencesBlockProps = Record<never, never>

/**
 * The connected owner of ui.notify.preferences: it owns the notificationPreferences read, the
 * updateNotificationPreferences and unsubscribe writes, and the unsaved toggle draft, resolves the
 * one state NotifyPreferencesView renders, and hands every render path to the pure view in
 * ./component.tsx. The toggle edits a draft only - `updateNotificationPreferences` persists it, and
 * a refused save drops the draft so the control shows the pre-save value the record demands. It
 * lives under `src/components/notify/` rather than `src/components/blocks/` because this lane's
 * write ceiling is `src/components/notify/**`.
 */
export const NotifyPreferencesBlock = (props: NotifyPreferencesBlockProps) => {
    void props
    const t = useTranslations("notify.preferences")
    const tShell = useTranslations("shell")
    const token = useSessionToken()
    const router = useRouter()
    const [hydrated, setHydrated] = useState(false)
    const [draft, setDraft] = useState<boolean | null>(null)
    const [saveRefusal, setSaveRefusal] = useState<string | null>(null)
    const [pending, setPending] = useState<"save" | "unsubscribe" | null>(null)

    // The session store settles on mount; until then the signed-out reading cannot be told from the
    // first client frame, so only the mounted value may decide a session refusal.
    useEffect(() => setHydrated(true), [])

    const preferencesQuery = useSWR(
        token ? (["notification-preferences", token] as const) : null,
        ([, activeToken]) => readNotificationPreferences(activeToken),
    )

    const server = preferencesQuery.data
    const subscribed = server === undefined ? null : (draft ?? !server.unsubscribed)
    const refusal =
    saveRefusal ??
    (hydrated && token === null
        ? t("sessionEnded")
        : preferencesQuery.error !== undefined && server === undefined
            ? t("loadRefusal")
            : null)

    const state: NotifyPreferencesState =
    pending === "save"
        ? "saving"
        : refusal !== null
            ? "refused"
            : subscribed === null
                ? "loading"
                : subscribed
                    ? "subscribed"
                    : "unsubscribed"

    const onToggle = () => {
        if (server === undefined || pending !== null) return
        setDraft(current => !(current ?? !server.unsubscribed))
    }

    const onSave = async () => {
        if (token === null || subscribed === null || pending !== null) return
        setPending("save")
        setSaveRefusal(null)
        try {
            const saved = await updateNotificationPreferences(token, !subscribed)
            void preferencesQuery.mutate(saved)
            setDraft(null)
        } catch {
            setDraft(null)
            setSaveRefusal(t("saveRefusal"))
        } finally {
            setPending(null)
        }
    }

    const onUnsubscribe = async () => {
        if (token === null || pending !== null) return
        setPending("unsubscribe")
        setSaveRefusal(null)
        try {
            await unsubscribeFromEmail(token)
            void preferencesQuery.mutate(current => (current === undefined ? current : { ...current, unsubscribed: true }))
            setDraft(null)
        } catch {
            setSaveRefusal(t("saveRefusal"))
        } finally {
            setPending(null)
        }
    }

    const onSignOut = async () => {
        if (token !== null) await endSession(token)
        clearToken()
        router.push("/sign-in")
    }

    return (
        <NotifyPreferencesView
            state={state}
            subscribed={subscribed}
            refusal={refusal}
            pending={pending}
            copy={{
                brand: tShell("brand"),
                accountName: tShell("accountName"),
                signOut: tShell("signOut"),
                navLabel: tShell("navPrimary"),
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
                backToTasks: tShell("backToTasks"),
                breadcrumbLabel: tShell("breadcrumb"),
                mainLabel: t("mainLabel"),
                breadcrumb: t("breadcrumb"),
                heading: t("heading"),
                tagline: t("tagline"),
                digestHeading: t("digestHeading"),
                digestTagline: t("digestTagline"),
                on: t("on"),
                off: t("off"),
                turnOn: t("turnOn"),
                turnOff: t("turnOff"),
                unsubscribedNote: t("unsubscribedNote"),
                save: t("save"),
                saving: t("saving"),
                unsubscribe: t("unsubscribe"),
                unsubscribeHint: t("unsubscribeHint"),
            }}
            onToggle={onToggle}
            onSave={onSave}
            onUnsubscribe={onUnsubscribe}
            onSignOut={onSignOut}
        />
    )
}
