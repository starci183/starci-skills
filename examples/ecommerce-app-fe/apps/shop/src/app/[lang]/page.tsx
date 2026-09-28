import { redirect } from "next/navigation"
import { ShopRootRedirectPath } from "../../features/pages/ShopRootRedirect"

/** The locale root has no visual surface; send the reader to the catalogue in that locale. */
type ShopRootRouteProps = { readonly params: Promise<{ readonly lang: string }> }

const Page = async ({ params }: ShopRootRouteProps) => {
    const { lang } = await params
    redirect(ShopRootRedirectPath(lang))
}

export default Page
