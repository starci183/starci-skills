"use client"

import { I18nProvider } from "@heroui/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { FeKitI18nProvider } from "@fe-kit/i18n/i18n-context"
import { ThemeProvider } from "@fe-kit/theme/theme-context"
import { i18n, PRODUCT_TIME_ZONE } from "@/i18n/config"
import { Link, usePathname, useRouter } from "@/i18n/navigation"

/**
 * The three contexts that sit above every route, and nothing else.
 *
 * None of them decides what a screen looks like, which is why they live beside the root layout
 * rather than in the component tree: no tier owns them. The layout is a server component, and
 * this file is the client boundary that lets them sit above every route without turning the
 * whole shell into client code.
 *
 * VENDOR LOCALE - `I18nProvider`. Grammar's controls are built on React Aria, which resolves
 * dates, numbers and its own built-in strings against a LOCALE. Without a provider each control
 * reads the browser's locale independently, so a server render and the browser that hydrates it
 * can disagree - the classic hydration mismatch that only appears on somebody else's machine.
 *
 * PRODUCT COPY - `NextIntlClientProvider`. The same locale, resolved once on the server in
 * `src/i18n/request.ts`, handed to the client tree so a component can ask for a string. The two
 * providers take the SAME locale deliberately: a page whose sentences are Vietnamese while its
 * date picker names months in English is one product speaking two languages at once.
 *
 * THEME - `ThemeProvider` from `@starci-examples/fe-kit`. `globals.css` and Grammar's token layer
 * answer to `.dark`, so the tokens were ready before anything could switch them. This is the
 * switch.
 *
 * FE-KIT I18N - `FeKitI18nProvider`. The kit's display leaves need this app's created navigation
 * (`Link`, `usePathname`, `useRouter`) and its locale list, and neither can cross a server
 * boundary as props - so they ride in context, mounted here beside the theme provider.
 */

/** The created-navigation pieces the kit's i18n leaves reach through `FeKitI18nProvider`. */
const FE_KIT_NAVIGATION = { Link, usePathname, useRouter }

/** Props for {@link AppProviders}. */
export interface AppProvidersProps {
  /** The locale resolved on the server, so both providers agree on one answer. */
  readonly locale: string;
  /** The resolved message catalogue for that locale. */
  readonly messages: Record<string, unknown>;
  /** Everything rendered under the contexts - in practice, the whole shell. */
  readonly children: ReactNode;
}

/**
 * Mount the contexts above every route.
 *
 * @param props - {@link AppProvidersProps}
 */
export const AppProviders = (props: AppProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={PRODUCT_TIME_ZONE}>
        <I18nProvider locale={props.locale}>
            <ThemeProvider>
                <FeKitI18nProvider locales={i18n.LOCALES} navigation={FE_KIT_NAVIGATION}>
                    {props.children}
                </FeKitI18nProvider>
            </ThemeProvider>
        </I18nProvider>
    </NextIntlClientProvider>
)
