import { LocaleRootPage } from "@/features/pages/LocaleRootPage"
import { pageMetadata } from "@/modules/meta"

type PageProps = { readonly params: Promise<{ readonly locale: string }> }

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("signIn")

/** The bare locale root's thin shell; the page component owns the redirect decision. */
const Page = async (props: PageProps) => <LocaleRootPage lang={(await props.params).locale} />

export default Page
