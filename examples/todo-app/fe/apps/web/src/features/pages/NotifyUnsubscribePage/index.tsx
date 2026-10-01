import { NotifyUnsubscribePageBase } from "./component"

/** The public props of the unsubscribe route: the link's token, when the address carried one. */
type NotifyUnsubscribePageProps = { readonly token: string | null }

/**
 * The unsubscribe route's connected half (the unsubscribe-link projection in
 * ui.notify.preferences' coverage map). The surface is signed-out - it renders whether or not a
 * token exists - so the page's whole situation space is "ready".
 */
export const NotifyUnsubscribePage = (props: NotifyUnsubscribePageProps) => (
    <NotifyUnsubscribePageBase state="ready" props={{ token: props.token }} on={{}} />
)
