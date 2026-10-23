import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import type { AbstractIntlMessages } from "next-intl"
import { locale as routeLocale } from "next/root-params"

/**
 * WHERE COPY COMES FROM, resolved once per request on the server.
 *
 * Every string a reader sees is a key in the app's own `messages/*.json`, and a component
 * receives it already resolved. THE LOCALE COMES FROM THE ROUTE: the `[locale]` segment read through
 * `next/root-params` (`experimental.rootParams` in the app's next.config.ts), never the deprecated
 * `requestLocale`; it is checked against the shipped vocabulary before it
 * reaches the message loader.
 *
 * THE ZONE IS FIXED, NOT INFERRED, and that is the point. Left unset, next-intl formats on the
 * server in the server's zone and on the client in the reader's - a markup mismatch React does
 * not patch up. One honest answer to "what day is it" is written down once, in the app's config.
 */

/** `next/root-params` is typed only after Next generates its types, so the reader is checked before it is called. */
const isLocaleReader = (value: unknown): value is () => Promise<unknown> => typeof value === "function"

const readRouteLocale = async (): Promise<unknown> => {
    const reader: unknown = routeLocale
    return isLocaleReader(reader) ? reader() : undefined
}

/** One message catalogue per shipped locale; the loader keeps the app's own `messages/` path. */
export type FeKitMessageLoaders = Record<string, () => Promise<{ default: AbstractIntlMessages }>>;

/** What `createRequestConfig` needs: the app's routing object, timezone and message loaders. */
export type FeKitRequestOptions = {
    /** The routing object created from the app's i18n config - locales and default are all it reads. */
    readonly routing: {
        readonly locales: ReadonlyArray<string>;
        readonly defaultLocale: string;
    };
    /** The product timezone, from the app's `defineI18nConfig` result. */
    readonly timeZone: string;
    /** Per-locale dynamic imports of the app's own message catalogues. */
    readonly messages: FeKitMessageLoaders;
};

/**
 * Build the app's request config for next-intl's plugin. The factory closes over the routing,
 * timezone and message map the app declared, so the default export in the app's `i18n/request.ts`
 * is a one-line binding and the resolution logic lives here once.
 *
 * @param options - {@link FeKitRequestOptions}
 */
export const createRequestConfig = (options: FeKitRequestOptions) =>
    getRequestConfig(async () => {
        const requested = await readRouteLocale()
        const locale = hasLocale(options.routing.locales, requested) ? requested : options.routing.defaultLocale
        const load = options.messages[locale] ?? options.messages[options.routing.defaultLocale]
        if (load === undefined) throw new Error(`No message loader for ${locale} or the default locale ${options.routing.defaultLocale}`)
        return {
            locale,
            timeZone: options.timeZone,
            messages: (await load()).default,
        }
    })
