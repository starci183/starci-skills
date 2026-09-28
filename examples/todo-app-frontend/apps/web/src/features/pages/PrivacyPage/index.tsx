import { PrivacyPageBase } from "./component"

/** The public props of the privacy route: the route hands it nothing. */
export type PrivacyPageProps = Record<never, never>

/**
 * The privacy route's connected half (ui.audit.privacy). This lane's write ceiling is
 * `src/app/audit/**`, so the served path is /audit/privacy rather than the direction's declared
 * /privacy; the deviation is recorded on impl.audit.todo-app-frontend.privacy.
 */
export const PrivacyPage = (props: PrivacyPageProps) => {
    void props
    return <PrivacyPageBase state="ready" props={{}} on={{}} />
}
