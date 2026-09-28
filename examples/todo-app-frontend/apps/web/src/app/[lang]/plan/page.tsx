import { PlanRootPage } from "@/features/pages/PlanRootPage"

/** The plan index's thin shell; the page component owns the redirect to the usage screen. */
type PageProps = { readonly params: Promise<{ readonly lang: string }> }
const Page = async ({ params }: PageProps) => (
    <PlanRootPage lang={(await params).lang} />
)

export default Page
