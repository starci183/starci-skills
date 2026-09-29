import { PlanRootPage } from "@/features/pages/PlanRootPage"

/** The plan index's thin shell; the page component owns the redirect to the usage screen. */
type PageProps = { readonly params: Promise<{ readonly locale: string }> }
const Page = async ({ params }: PageProps) => (
    <PlanRootPage lang={(await params).locale} />
)

export default Page
