import { PlanRootPage } from "@/features/pages/PlanRootPage"
import { pageMetadata } from "@/modules/meta"

type PageProps = { readonly params: Promise<{ readonly locale: string }> }

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("planUsage")

/** The plan index's thin shell; the page component owns the redirect to the usage screen. */
const Page = async (props: PageProps) => <PlanRootPage lang={(await props.params).locale} />

export default Page
