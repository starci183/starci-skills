import { hasLocale } from "next-intl"
import { DEFAULT_LOCALE, redirect, routing } from "@/modules/i18n"
import { ROUTES } from "@/modules/routes"
import { LocaleRootPageBase } from "./component"

/** The public props of the locale root route: the language the address states. */
type LocaleRootPageProps = { readonly lang: string }

/**
 * The `[locale]` root's connected half. It owns no UI of its own: a reader landing on `/en` or `/vi`
 * belongs on the sign-in screen, in the language the address already states, and the locale-aware
 * `redirect` keeps that language.
 */
export const LocaleRootPage = (props: LocaleRootPageProps) => {
    redirect({ href: ROUTES.signIn, locale: hasLocale(routing.locales, props.lang) ? props.lang : DEFAULT_LOCALE })
    return <LocaleRootPageBase state="redirecting" props={{}} on={{}} />
}
