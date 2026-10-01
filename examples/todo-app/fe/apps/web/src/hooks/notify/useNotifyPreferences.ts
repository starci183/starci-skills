import { useState } from "react"
import useSWR from "swr"
import { useSessionToken } from "@/hooks/auth"
import { useHydrated } from "@/hooks/hydration"
import { readNotificationPreferences, unsubscribeFromEmail, updateNotificationPreferences } from "@/modules/notify"

/** Which preference failure the screen reports, if any. */
type PreferencesRefusal = "sessionEnded" | "loadRefusal" | "saveRefusal"

/** The failures the refusal is read from. */
type PreferencesFailures = {
    readonly saveRefused: boolean
    readonly sessionEnded: boolean
    readonly loadRefused: boolean
}

/** The one refusal the screen owes the reader: a refused save first, then an ended session, then a refused read. */
const refusalOf = (failures: PreferencesFailures): PreferencesRefusal | null => {
    if (failures.saveRefused) return "saveRefusal"
    if (failures.sessionEnded) return "sessionEnded"
    if (failures.loadRefused) return "loadRefusal"
    return null
}

/**
 * ui.notify.preferences' world state: the notificationPreferences read, the updateNotificationPreferences
 * and unsubscribe writes, and the unsaved toggle draft. The toggle edits a draft only -
 * `updateNotificationPreferences` persists it, and a refused save drops the draft so the control shows
 * the pre-save value the record demands.
 *
 * `refusal` names which sentence the screen owes the reader (the words are the dictionary's):
 * `sessionEnded`, `loadRefusal` or `saveRefusal`; `null` means none.
 */
export const useNotifyPreferences = () => {
    const token = useSessionToken()
    const [draft, setDraft] = useState<boolean | null>(null)
    const [saveRefused, setSaveRefused] = useState(false)
    const [pending, setPending] = useState<"save" | "unsubscribe" | null>(null)

    // Until the client has mounted the signed-out reading cannot be told from the first client frame, so
    // only the mounted value may decide a session refusal.
    const hydrated = useHydrated()

    const preferencesQuery = useSWR(token ? (["notification-preferences", token] as const) : null, ([, activeToken]) =>
        readNotificationPreferences(activeToken),
    )

    const server = preferencesQuery.data
    const subscribed = server === undefined ? null : (draft ?? !server.unsubscribed)
    const refusal = refusalOf({
        saveRefused,
        sessionEnded: hydrated && token === null,
        loadRefused: preferencesQuery.error !== undefined && server === undefined,
    })

    const toggle = () => {
        if (server === undefined || pending !== null) return
        setDraft((current) => !(current ?? !server.unsubscribed))
    }

    const save = async () => {
        if (token === null || subscribed === null || pending !== null) return
        setPending("save")
        setSaveRefused(false)
        try {
            const saved = await updateNotificationPreferences(token, !subscribed)
            void preferencesQuery.mutate(saved)
            setDraft(null)
        } catch {
            setDraft(null)
            setSaveRefused(true)
        } finally {
            setPending(null)
        }
    }

    const unsubscribe = async () => {
        if (token === null || pending !== null) return
        setPending("unsubscribe")
        setSaveRefused(false)
        try {
            await unsubscribeFromEmail(token)
            void preferencesQuery.mutate((current) =>
                current === undefined ? current : { ...current, unsubscribed: true },
            )
            setDraft(null)
        } catch {
            setSaveRefused(true)
        } finally {
            setPending(null)
        }
    }

    return { subscribed, refusal, pending, toggle, save, unsubscribe }
}
