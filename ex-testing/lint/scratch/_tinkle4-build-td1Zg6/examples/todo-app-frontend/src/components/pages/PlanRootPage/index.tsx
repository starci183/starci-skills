"use client"

import { redirect, useParams } from "next/navigation"

import { PlanRootPageBase } from "./component"

/** The public props of the plan index route: the route hands it nothing. */
export type PlanRootPageProps = Record<never, never>

/**
 * The plan index's connected half. The plan feature's one surface is the usage screen; this page
 * owns no UI of its own and only sends the reader there, keeping the language the address states.
 */
export const PlanRootPage = (props: PlanRootPageProps) => {
    void props
    const { lang } = useParams<{ readonly lang: string }>()
    if (typeof lang === "string") redirect(`/${lang}/plan/usage`)
    return <PlanRootPageBase state="redirecting" props={{}} on={{}} />
}
