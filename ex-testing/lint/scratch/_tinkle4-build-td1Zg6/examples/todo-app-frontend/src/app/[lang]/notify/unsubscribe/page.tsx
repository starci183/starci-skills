import { NotifyUnsubscribePage } from "@/components/pages/NotifyUnsubscribePage"

/**
 * The route adapter that mounts the signed-out email unsubscribe surface (the unsubscribe-link
 * projection in ui.notify.preferences' coverage map) and nothing else. The Suspense boundary the
 * block's query read needs lives inside the page component.
 */
const Page = () => <NotifyUnsubscribePage />

export default Page
