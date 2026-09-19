"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { FeKitI18nProvider } from "@fe-kit/i18n/i18n-context"
import { ThemeProvider } from "@fe-kit/theme/theme-context"
import { i18n, PRODUCT_TIME_ZONE } from "@shared/i18n/config"
import { Link, usePathname, useRouter } from "@shared/i18n/navigation"

/**
 * The three contexts that sit above every route - the same stack starci-academy-fe mounts, minus
 * the toast store this product does not use:
 *
 * PRODUCT COPY - `NextIntlClientProvider`. The locale resolved once on the server in the shared
 * request config, handed to the client tree so a component can ask for a string.
 *
 * VENDOR LOCALE - `I18nProvider`. Grammar's controls are built on HeroUI, which resolves dates,
 * numbers and its own built-in strings against a locale; without a provider a server render and
 * the browser that hydrates it can disagree. Both providers take the SAME locale on purpose.
 *
 * THEME - `ThemeProvider` from `@starci-examples/fe-kit`. It paints `.light`/`.dark` on the root
 * and feeds GrammarRoot's own `data-grammar-theme` answer through `useTheme`.
 *
 * FE-KIT I18N - `FeKitI18nProvider`. The kit's display leaves need this product's created
 * navigation and its locale list, and neither can cross a server boundary as props - so they ride
 * in context, mounted here beside the theme provider.
 */
export type AppProvidersProps = {
    /** The locale resolved on the server, so both providers agree on one answer. */
    readonly locale: string
    /** The resolved message catalogue for that locale. */
    readonly messages: Record<string, unknown>
    /** Everything rendered under the contexts - in practice, the whole shell. */
    readonly children: ReactNode
}

/** The created-navigation pieces the kit's i18n leaves reach through `FeKitI18nProvider`. */
const FE_KIT_NAVIGATION = { Link, usePathname, useRouter }

/** Mount the copy, vendor-locale and theme contexts around the routed tree. */
export const AppProviders = (props: AppProvidersProps) => (
    <NextIntlClientProvider
        locale={props.locale}
        messages={props.messages}
        timeZone={PRODUCT_TIME_ZONE}
    >
        <I18nProvider locale={props.locale}>
            <ThemeProvider>
                <FeKitI18nProvider locales={i18n.LOCALES} navigation={FE_KIT_NAVIGATION}>
                    {props.children}
                </FeKitI18nProvider>
            </ThemeProvider>
        </I18nProvider>
    </NextIntlClientProvider>
)
