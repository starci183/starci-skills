import { PrivacyBlock } from "@/components/audit/privacy"

/** Props for {@link PrivacyPageBase}. */
export type PrivacyPageProps = {
    /** Whole-screen situations this surface settles; the screen owns its own session gate. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the privacy screen; the block owns the audit log and the retention read. */
export const PrivacyPageBase = (props: PrivacyPageProps) => {
    void props
    return <PrivacyBlock {...{}} />
}
