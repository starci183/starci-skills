import { NotifyPreferencesPageBase } from "./component"

/** The public props of the notify preferences route: the route hands it nothing. */
export type NotifyPreferencesPageProps = Record<never, never>

/**
 * The notification preferences route's connected half (ui.notify.preferences); the screen owns
 * its own session gate, so the page's whole situation space is "ready".
 */
export const NotifyPreferencesPage = (props: NotifyPreferencesPageProps) => {
    void props
    return <NotifyPreferencesPageBase state="ready" props={{}} on={{}} />
}
