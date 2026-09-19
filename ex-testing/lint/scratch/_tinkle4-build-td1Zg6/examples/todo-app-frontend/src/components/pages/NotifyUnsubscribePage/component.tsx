import { Suspense } from "react"

import { NotifyUnsubscribeBlock } from "@/components/notify/unsubscribe"

/** Props for {@link NotifyUnsubscribePageBase}. */
export type NotifyUnsubscribePageProps = {
    /** Whole-screen situations this surface settles; the block owns its own token read. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/**
 * Draw the signed-out unsubscribe screen. The block reads its link token from the query via
 * useSearchParams, so the Suspense boundary lives here with the screen it protects.
 */
export const NotifyUnsubscribePageBase = (props: NotifyUnsubscribePageProps) => {
    void props
    return (
        <Suspense>
            <NotifyUnsubscribeBlock {...{}} />
        </Suspense>
    )
}
