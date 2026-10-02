"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { useAuthRefresh } from "@/hooks/auth"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** The copy and React Aria locale contexts above every route. */
export const Providers = (props: ProvidersProps) => {
    useAuthRefresh()
    return (
        <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
            <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
        </NextIntlClientProvider>
    )
}
