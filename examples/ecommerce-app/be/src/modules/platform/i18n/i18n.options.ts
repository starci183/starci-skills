import type { MessageBundle } from "./i18n.contracts"

/** Options of the i18n capability: every owner catalog the app composes. */
export interface I18nOptions {
    /** The bundles to merge; each key belongs to exactly one bundle. */
    readonly bundles: ReadonlyArray<MessageBundle>
}
