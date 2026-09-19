"use client"

import { redirect, useParams } from "next/navigation"

import { ROUTES } from "../../../modules/routes"
import { ShopRootPageBase } from "./component"

/** The public props of the shop root route: the route hands it nothing. */
export type ShopRootPageProps = Record<never, never>

/**
 * The `[lang]` root's connected half. It owns no UI of its own: a reader landing on `/en` or `/vi`
 * belongs on the catalogue, in the language the address already states. Writing the segment out
 * here is honest rather than a shortcut - adding the language to a path IS this page's whole job,
 * and the hook already holds the language it must add.
 */
export const ShopRootPage = (props: ShopRootPageProps) => {
    void props
    const { lang } = useParams<{ readonly lang: string }>()
    if (typeof lang === "string") redirect(`/${lang}${ROUTES.browse}`)
    return <ShopRootPageBase state="redirecting" props={{}} on={{}} />
}
