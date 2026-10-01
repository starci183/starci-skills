import { SignInPage } from "@/features/pages/SignInPage"
import { pageMetadata } from "@/modules/meta"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("signIn")

/** The route adapter that mounts the sign-in page and nothing else. */
const Page = () => <SignInPage />

export default Page
