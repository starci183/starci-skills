import { NotifyUnsubscribePage } from "@/features/pages/NotifyUnsubscribePage"
import { pageMetadata } from "@/modules/meta"

type PageProps = { readonly searchParams: Promise<{ readonly token?: string }> }

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("notifyUnsubscribe")

/**
 * The route adapter that mounts the signed-out email unsubscribe surface (the unsubscribe-link
 * projection in ui.notify.preferences' coverage map): it hands the link's `token` to the page.
 */
const Page = async (props: PageProps) => <NotifyUnsubscribePage token={(await props.searchParams).token ?? null} />

export default Page
