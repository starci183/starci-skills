import { NotifyPreferencesPageBase } from "./component"

/**
 * The notification preferences route's connected half (ui.notify.preferences); the screen owns
 * its own session gate, so the page's whole situation space is "ready".
 */
export const NotifyPreferencesPage = () => {
    return <NotifyPreferencesPageBase state="ready" props={{}} on={{}} />
}
