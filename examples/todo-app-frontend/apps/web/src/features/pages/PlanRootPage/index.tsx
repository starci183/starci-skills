"use client"

import { redirect } from "next/navigation"

import { PlanRootPageBase } from "./component"

/** The public props of the plan index route: the route hands it nothing. */
export type PlanRootPageProps = { readonly lang: string }

/**
 * The plan index's connected half. The plan feature's one surface is the usage screen; this page
 * owns no UI of its own and only sends the reader there, keeping the language the address states.
 */
export const PlanRootPage = (props: PlanRootPageProps) => {
    redirect(`/${props.lang}/plan/usage`)
    return <PlanRootPageBase state="redirecting" props={{}} on={{}} />
}
