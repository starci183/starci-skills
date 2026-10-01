"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { useNotifyPreferences } from "@/hooks/notify"
import { useAccountShellCopy } from "@/hooks/shell"
import { NotifyPreferencesView, type NotifyPreferencesState } from "./component"

/** The preferences block takes nothing from its page: the screen owns its own session gate. */
type NotifyPreferencesBlockProps = Record<never, never>

/**
 * The connected owner of ui.notify.preferences: it reads the preference, its writes and the unsaved
 * toggle draft from `useNotifyPreferences`, resolves the one state NotifyPreferencesView renders, and
 * hands every render path to the pure view in ./component.tsx. It lives in the notify-preferences block
 * beside its pure render.
 */
export const NotifyPreferencesBlock = (props: NotifyPreferencesBlockProps) => {
    void props
    const t = useTranslations("notify.preferences")
    const shellCopy = useAccountShellCopy("notify.preferences")
    const onSignOut = useSignOut()
    const { subscribed, refusal: refusalKey, pending, toggle, save, unsubscribe } = useNotifyPreferences()

    const refusal = refusalKey === null ? null : t(refusalKey)

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

    return (
        <NotifyPreferencesView
            state={state}
            subscribed={subscribed}
            refusal={refusal}
            pending={pending}
            copy={{
                ...shellCopy,
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
            onToggle={toggle}
            onSave={save}
            onUnsubscribe={unsubscribe}
            onSignOut={onSignOut}
        />
    )
}
