import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { BookingForm } from "@/components/blocks/BookingForm"
import { SignInForm } from "@/components/blocks/SignInForm"
import { SignOutButton } from "@/components/blocks/SignOutButton"
import { readBookings, readResources, readSession } from "@/modules/db"
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
    const [resources, bookings] = await Promise.all([readResources(), readBookings()])
    const t = await getTranslations("app.home")
    return (
        <>
            <AppHomePageBase
                props={{
                    title: t("title"),
                    principal: session.value.email ?? t("signedIn"),
                    resources: t("resources", {
                        count: resources.kind === "ok" ? resources.value.length : t("unavailable"),
                    }),
                    bookings: t("bookings", {
                        count: bookings.kind === "ok" ? bookings.value.length : t("unavailable"),
                    }),
                }}
            />
            <SignOutButton />
            <BookingForm />
        </>
    )
}
