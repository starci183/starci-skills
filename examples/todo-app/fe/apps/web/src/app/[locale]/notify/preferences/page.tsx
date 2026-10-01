import { NotifyPreferencesPage } from "@/features/pages/NotifyPreferencesPage"
import { pageMetadata } from "@/modules/meta"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("notifyPreferences")

/** The route adapter that mounts the notification preferences page (ui.notify.preferences) and nothing else. */
const Page = () => <NotifyPreferencesPage />

export default Page
