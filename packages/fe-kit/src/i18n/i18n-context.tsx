"use client"

import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from "react"
import type { FeKitLinkProps, FeKitNavigation } from "./navigation"

/**
 * THE PIECES A LEAF CANNOT IMPORT.
 *
 * A created navigation - `Link`, `usePathname`, `useRouter` - exists only where the app's routing
 * object exists, which is app code the kit may not import. And a server layout cannot hand those
 * pieces down as props, because functions do not survive the server/client boundary. Context is
 * the remaining channel: the app's client providers file mounts ONE {@link FeKitI18nProvider}
 * with its own navigation and locales, and every kit leaf below it reads the pair back.
 */

/** The app-bound i18n runtime the provider carries: which locales exist and how to move between them. */
export type FeKitI18nRuntime<L extends string = string> = {
    /** The locales the app ships, from its `defineI18nConfig` result. */
    readonly locales: ReadonlyArray<L>;
    /** The app's created navigation - the locale-aware `Link`, `usePathname` and `useRouter`. */
    readonly navigation: FeKitNavigation<L>;
};

const I18nRuntimeContext = createContext<FeKitI18nRuntime | null>(null)

/** The provider's props: the app-bound runtime plus the tree that reads it. */
export type FeKitI18nProviderProps<L extends string = string> = FeKitI18nRuntime<L> & {
    /** The routed tree whose leaves consume the runtime. */
    readonly children: ReactNode;
};

/**
 * Hand the kit's i18n leaves their app-bound runtime. Mounted once in the app's client providers
 * file, beside the theme provider: both are "contexts above every route", and this one exists for
 * exactly the reason the theme provider does - the thing it carries cannot be imported or passed
 * through a server component.
 *
 * @param props - {@link FeKitI18nProviderProps}
 */
export const FeKitI18nProvider = <L extends string>(props: FeKitI18nProviderProps<L>) => {
    /*
     * The context is stored at `string` level: the leaves read locale codes, not the app's literal
     * union. `usePathname`/`useRouter` widen for free (their `locale` sits in a method parameter,
     * which is bivariant); `Link` is contravariant in the locale prop, so it is wrapped once into a
     * `string`-typed component rather than cast - an erasure the compiler could no longer check.
     */
    const value = useMemo<FeKitI18nRuntime>(() => {
        const AppLink = props.navigation.Link
        const Link: ComponentType<FeKitLinkProps> = (linkProps: FeKitLinkProps) => (
            <AppLink {...linkProps} locale={linkProps.locale as L} />
        )
        return {
            locales: props.locales,
            navigation: {
                Link,
                usePathname: props.navigation.usePathname,
                useRouter: props.navigation.useRouter,
            },
        }
    }, [props.locales, props.navigation])
    return <I18nRuntimeContext.Provider value={value}>{props.children}</I18nRuntimeContext.Provider>
}

/**
 * Read the app-bound i18n runtime inside a kit leaf. Throws rather than returning `undefined`:
 * a leaf mounted without the provider is a wiring mistake, and a missing context rendered as a
 * quiet English-only switcher would be found by a reader, not a build.
 */
export const useFeKitI18n = (): FeKitI18nRuntime => {
    const runtime = useContext(I18nRuntimeContext)
    if (runtime === null) {
        throw new Error("fe-kit i18n leaf rendered without FeKitI18nProvider")
    }
    return runtime
}
