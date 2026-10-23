import type { AbstractIntlMessages } from "next-intl"

const isMessages = (value: unknown): value is AbstractIntlMessages => typeof value === "object" && value !== null

/**
 * The namespaces of the loaded catalog the client provider needs. `getMessages()` types the catalog `any`, so it is read as `unknown`
 * and checked; a namespace the catalog lacks is left out, and next-intl names it where a component reads it.
 */
export const clientMessages = (messages: unknown, namespaces: ReadonlyArray<string>): AbstractIntlMessages => {
    if (!isMessages(messages)) return {}
    return Object.fromEntries(Object.entries(messages).filter(([namespace]) => namespaces.includes(namespace)))
}
