"use client"

import { redirect, useParams } from "next/navigation"

import { LocaleRootPageBase } from "./component"

/** The public props of the locale root route: the route hands it nothing. */
export type LocaleRootPageProps = Record<never, never>

/**
 * The `[lang]` root's connected half. It owns no UI of its own: a reader landing on `/en` or `/vi`
 * belongs on the sign-in screen, in the language the address already states. Writing the segment
 * out here is honest rather than a shortcut - adding the language to a path IS this page's whole
 * job, and the hook already holds the language it must add.
 */
export const LocaleRootPage = (props: LocaleRootPageProps) => {
    void props
    const { lang } = useParams<{ readonly lang: string }>()
    if (typeof lang === "string") redirect(`/${lang}/sign-in`)
    return <LocaleRootPageBase state="redirecting" props={{}} on={{}} />
}
