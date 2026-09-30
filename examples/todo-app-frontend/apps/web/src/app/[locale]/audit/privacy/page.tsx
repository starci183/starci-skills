import { PrivacyPage } from "@/features/pages/PrivacyPage"
import { pageMetadata } from "@/modules/meta"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("privacy")

/**
 * The route adapter that mounts the privacy page (ui.audit.privacy) and nothing else. This lane's
 * write ceiling is `src/app/audit/**`, so the served path is /audit/privacy rather than the
 * direction's declared /privacy; the deviation is recorded on impl.audit.todo-app-frontend.privacy.
 */
const Page = () => <PrivacyPage />

export default Page
