"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { PRODUCT_TIME_ZONE } from "@ecommerce/i18n"

/** What the provider stack takes: the locale resolved on the server, its catalogue and the tree it wraps. */
type ProvidersProps = {
    /** The locale resolved on the server, so both providers agree on one answer. */
    readonly locale: string
    /** The resolved message catalogue for that locale. */
    readonly messages: Record<string, unknown>
    /** Everything rendered under the contexts - in practice, the whole shell. */
    readonly children: ReactNode
}

/**
 * The two contexts that sit above every route: next-intl's copy context, and React Aria's locale for
 * Grammar's controls. Both take the SAME locale on purpose - a page whose sentences are Vietnamese
 * while its date picker names months in English is one product speaking two languages at once.
 */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={PRODUCT_TIME_ZONE}>
        <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
    </NextIntlClientProvider>
)
