import { hasLocale } from "next-intl"
import { DEFAULT_LOCALE, redirect, routing } from "@/modules/i18n"
import { ROUTES } from "@/modules/routes"
import { PlanRootPageBase } from "./component"

/** The public props of the plan index route: the language the address states. */
type PlanRootPageProps = { readonly lang: string }

/**
 * The plan index's connected half. The plan feature's one surface is the usage screen; this page
 * owns no UI of its own and only sends the reader there, keeping the language the address states.
 */
export const PlanRootPage = (props: PlanRootPageProps) => {
    redirect({ href: ROUTES.planUsage, locale: hasLocale(routing.locales, props.lang) ? props.lang : DEFAULT_LOCALE })
    return <PlanRootPageBase state="redirecting" props={{}} on={{}} />
}
