/** The languages a catalog carries: Vietnamese and English, both complete. */
export type Locale = "vi" | "en"

/** The value of an `Accept-Language` request header: one line, several lines, or absent. */
export type AcceptLanguage = string | ReadonlyArray<string> | undefined

/** Values that fill the `{{name}}` placeholders of a message. */
export interface MessageParams {
    readonly [name: string]: string | number
}

/** What an owner writes in its `messages/<owner>.messages.ts`: one flat key to text map per language, the same keys in each. */
export interface MessageBundle {
    /** Vietnamese texts by key. */
    readonly vi: Readonly<Record<string, string>>
    /** English texts by key. */
    readonly en: Readonly<Record<string, string>>
}
