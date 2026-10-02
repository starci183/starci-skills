"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"

/** What the provider stack takes: the locale resolved on the server, its catalog, the product time zone and the tree it wraps. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/**
 * The two contexts above every route: next-intl's copy context and React Aria's locale for the grammar's controls. Both take the
 * same locale, so the sentences and the controls of a page speak one language.
 */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
    </NextIntlClientProvider>
)
