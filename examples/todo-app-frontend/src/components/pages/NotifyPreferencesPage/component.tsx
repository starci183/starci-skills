import { NotifyPreferencesBlock } from "@/components/notify/preferences"

/** Props for {@link NotifyPreferencesPageBase}. */
export type NotifyPreferencesPageProps = {
    /** Whole-screen situations this surface settles; the screen owns its own session gate. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the notification preferences screen; the block owns the toggles and their session state. */
export const NotifyPreferencesPageBase = (props: NotifyPreferencesPageProps) => {
    void props
    return <NotifyPreferencesBlock {...{}} />
}
