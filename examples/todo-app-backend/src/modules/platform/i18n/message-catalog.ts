import {
    MessageParamError 
} from "./errors/message-param.error"

/** The languages a catalog carries: Vietnamese and English, both complete. */
export type Locale = "vi" | "en"

/** Values that fill the named placeholders of a message: `{name}` takes `params.name`. */
export type MessageParams = Readonly<Record<string, string | number>>

/** One language's messages, keyed by the capability's own key union. */
export type MessageBundle<Key extends string> = Readonly<Record<Key, string>>

/** What a capability or feature writes in its `messages/`: one bundle per language, the same keys in each. */
export interface MessageSource<Key extends string> {
    readonly vi: MessageBundle<Key>
    readonly en: MessageBundle<Key>
}

/** The messages catalog port: a typed key lookup with named interpolation; a key that does not exist does not compile. */
export interface MessageCatalog<Key extends string> {
    /** The text for `key` in `locale` (the catalog's default when omitted), placeholders filled from `params`. */
    get(key: Key, params?: MessageParams, locale?: Locale): string
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Fills `{name}` placeholders; a placeholder with no value is a defect in the caller, so it stops rather than shipping a hole. */
const interpolate = (key: string, text: string, params: MessageParams): string =>
    text.replace(PLACEHOLDER,
        (_match, name: string) => {
            const value = params[name]
            if (value === undefined) throw new MessageParamError(key,
                name)
            return String(value)
        })

/** Builds the catalog over a capability's vi and en bundles; `defaultLocale` answers a lookup that names no language. */
export const createMessageCatalog = <Key extends string>(
    source: MessageSource<Key>,
    defaultLocale: Locale = "en",
): MessageCatalog<Key> => ({
        get: (key, params = {
        }, locale = defaultLocale) => interpolate(key,
            source[locale][key],
            params),
    })
