import type { AbstractIntlMessages } from "next-intl"
import en from "./messages/en.json"
import vi from "./messages/vi.json"

/** The copy every app of the product shares: display controls, loading, not-found and error boundaries. */
export const COMMON_MESSAGES: Readonly<Record<string, AbstractIntlMessages>> = { en, vi }

/** One app catalogue loader per shipped locale, as next-intl's request config takes them. */
export type MessageLoaders = Readonly<Record<string, () => Promise<{ readonly default: AbstractIntlMessages }>>>

/**
 * Lay one app's own catalogues over the shared common copy, so an app declares only what is its
 * own (`app.<name>`, its shell and pages) and the boundary and display copy exists once.
 */
export const withCommonMessages = (loaders: MessageLoaders): MessageLoaders =>
    Object.fromEntries(
        Object.entries(loaders).map(([locale, load]) => [
            locale,
            async () => ({ default: { ...COMMON_MESSAGES[locale], ...(await load()).default } }),
        ]),
    )
