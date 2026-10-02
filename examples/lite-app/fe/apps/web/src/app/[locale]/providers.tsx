"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import { useEffect, type ReactNode } from "react"
import { subscribeToAuthRefresh } from "@/modules/db/browser"
import { navigation } from "@/modules/i18n"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** The copy, React Aria and auth-refresh contexts above every route. */
export const Providers = (props: ProvidersProps) => {
    const router = navigation.useRouter()
    useEffect(() => subscribeToAuthRefresh(() => router.refresh()), [router])
    return (
        <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
            <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
        </NextIntlClientProvider>
    )
}
