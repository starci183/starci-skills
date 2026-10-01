"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"

/** Props for {@link Providers}. */
export interface ProvidersProps {
    /** The locale resolved on the server, so both providers agree on one answer. */
    readonly locale: string
    /** The resolved message catalogue for that locale. */
    readonly messages: Record<string, unknown>
    /** Everything rendered under the contexts - in practice, the whole shell. */
    readonly children: ReactNode
}

/**
 * The two contexts that sit above every route, and nothing else.
 *
 * VENDOR LOCALE - `I18nProvider`. Grammar's controls are built on React Aria, which resolves
 * dates, numbers and its own built-in strings against a LOCALE. Without a provider each control
 * reads the browser's locale independently, so a server render and the browser that hydrates it
 * can disagree - the classic hydration mismatch that only appears on somebody else's machine.
 *
 * PRODUCT COPY - `NextIntlClientProvider`. The same locale, resolved once on the server in
 * `modules/i18n/request.ts`, handed to the client tree so a component can ask for a string. The two
 * providers take the SAME locale deliberately: a page whose sentences are Vietnamese while its
 * date picker names months in English is one product speaking two languages at once.
 */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={PRODUCT_TIME_ZONE}>
        <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
    </NextIntlClientProvider>
)
