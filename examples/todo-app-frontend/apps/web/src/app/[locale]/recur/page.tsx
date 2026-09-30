import { RecurPage } from "@/features/pages/RecurPage"
import { pageMetadata } from "@/modules/meta"

type PageProps = { readonly searchParams: Promise<{ readonly task?: string }> }

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("recur")

/**
 * The recur route's thin shell; it hands the task the query names to the page component.
 *
 * ui.recur.schedule's surface route is the task's own schedule; the example backend's
 * makeRecurring contract identifies the task by its title (there is no taskId-to-rule lookup),
 * so the route binds it as ?task=<title> rather than inventing an id the API cannot resolve.
 */
const Page = async (props: PageProps) => <RecurPage task={(await props.searchParams).task} />

export default Page
