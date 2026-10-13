import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { SignInForm } from "@/components/blocks/SignInForm"
import { SignOutButton } from "@/components/blocks/SignOutButton"
import { AppHomePageBase } from "./component"

/** The document title of the home page. */
export const appHomeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app.home")
    return { title: t("title") }
}

/** The front door: the sign-in form for a signed-out reader, the reader and sign-out once signed in (the session is client-side). */
export const AppHomePage = async () => {
    const t = await getTranslations("app.home")
    return (
        <AppHomePageBase
            props={{ title: t("title") }}
            session={
                <>
                    <SignInForm />
                    <SignOutButton />
                </>
            }
        />
    )
}
