/** The languages a catalog carries: Vietnamese and English, both complete. */
export type Locale = "vi" | "en"

/** Values that fill the `{{name}}` placeholders of a message. */
export type MessageParams = Readonly<Record<string, string | number>>

/** What an owner writes in its `messages/<owner>.messages.ts`: one flat key to text map per language, the same keys in each. */
export interface MessageBundle {
    /** Vietnamese texts by key. */
    readonly vi: Readonly<Record<string, string>>
    /** English texts by key. */
    readonly en: Readonly<Record<string, string>>
}
