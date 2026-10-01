import { NotifyUnsubscribeBlock } from "@/components/blocks/notify-unsubscribe"

/** Props for {@link NotifyUnsubscribePageBase}. */
export type NotifyUnsubscribePageProps = {
    /** The link's `token` query parameter, or null when the link carries none. */
    readonly props: { readonly token: string | null }
}

/** Draw the signed-out unsubscribe screen; the block reads nothing but the token it is handed. */
export const NotifyUnsubscribePageBase = (props: NotifyUnsubscribePageProps) => (
    <NotifyUnsubscribeBlock token={props.props.token} />
)
