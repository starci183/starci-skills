import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ShopRootRedirect } from "../../features/pages/ShopRootRedirect"
import { SHOP_NAMESPACE } from "../../modules/i18n"

type PageProps = { readonly params: Promise<{ readonly locale: string }> }

/** The document title of the shop, from the catalog of the requested locale. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations(SHOP_NAMESPACE)
    return { title: t("title"), description: t("description") }
}

/** The locale root has no visual surface; the page component sends the reader to the catalogue in that locale. */
const Page = async (props: PageProps) => <ShopRootRedirect lang={(await props.params).locale} />

export default Page
