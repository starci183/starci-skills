import { NotifyUnsubscribePageBase } from "./component"

/** The public props of the unsubscribe route: the route hands it nothing. */
export type NotifyUnsubscribePageProps = Record<never, never>

/**
 * The unsubscribe route's connected half (the unsubscribe-link projection in
 * ui.notify.preferences' coverage map). The surface is signed-out - it renders whether or not a
 * token exists - so the page's whole situation space is "ready".
 */
export const NotifyUnsubscribePage = (props: NotifyUnsubscribePageProps) => {
    void props
    return <NotifyUnsubscribePageBase state="ready" props={{}} on={{}} />
}
