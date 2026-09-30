import { PrivacyPageBase } from "./component"

/**
 * The privacy route's connected half (ui.audit.privacy). This lane's write ceiling is
 * `src/app/audit/**`, so the served path is /audit/privacy rather than the direction's declared
 * /privacy; the deviation is recorded on impl.audit.todo-app-frontend.privacy.
 */
export const PrivacyPage = () => {
    return <PrivacyPageBase state="ready" props={{}} on={{}} />
}
