import { redirect } from "next/navigation"
import { ShopRootRedirectPath } from "../../features/pages/ShopRootRedirect"

/** The locale root has no visual surface; send the reader to the catalogue in that locale. */
type ShopRootRouteProps = { readonly params: Promise<{ readonly locale: string }> }

const Page = async ({ params }: ShopRootRouteProps) => {
    const { locale } = await params
    redirect(ShopRootRedirectPath(locale))
}

export default Page
