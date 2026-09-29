import { LocaleRootPage } from "@/features/pages/LocaleRootPage"

/** The bare locale root's thin shell; the page component owns the redirect decision. */
type PageProps = { readonly params: Promise<{ readonly locale: string }> }
const Page = async ({ params }: PageProps) => (
    <LocaleRootPage lang={(await params).locale} />
)

export default Page
