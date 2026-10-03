import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { SignInForm } from "@/components/blocks/SignInForm"
import { SignOutButton } from "@/components/blocks/SignOutButton"
import { readSession } from "@/modules/db"
import { AppHomePageBase } from "./component"

/** The document title of the home page. */
export const appHomeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app.home")
    return { title: t("title") }
}

/** The front door: sign-in for an anonymous request, otherwise the verified principal. */
export const AppHomePage = async () => {
    const session = await readSession()
    if (session.kind !== "ok") return <SignInForm />
    const t = await getTranslations("app.home")
    return (
        <>
            <AppHomePageBase
                props={{
                    title: t("title"),
                    principal: session.value.email ?? t("signedIn"),
                }}
            />
            <SignOutButton />
        </>
    )
}
