import { Injectable } from "@nestjs/common"
import type { Locale, MessageParams } from "./i18n.contracts"
import { InjectI18nOptions } from "./i18n.decorators"
import type { I18nOptions } from "./i18n.options"
import type { MessageCatalog } from "./i18n.port"

const PLACEHOLDER = /\{\{(\w+)\}\}/g

@Injectable()
/** The catalog over the bundles of I18nOptions: later bundles never override earlier ones, keys are owned by one bundle. */
export class BundleMessageCatalogService implements MessageCatalog {
    private readonly texts: Readonly<Record<Locale, ReadonlyMap<string, string>>>

    constructor(@InjectI18nOptions() options: I18nOptions) {
        this.texts = {
            vi: new Map(options.bundles.flatMap((bundle) => Object.entries(bundle.vi))),
            en: new Map(options.bundles.flatMap((bundle) => Object.entries(bundle.en))),
        }
    }

    /** The text of `key` in `locale` with placeholders filled; a placeholder without a value stays as written. */
    get(key: string, params: MessageParams, locale: Locale): string {
        const text = this.texts[locale].get(key)
        if (text === undefined) return key
        return text.replace(PLACEHOLDER, (placeholder, name: string) => {
            const value = params[name]
            return value === undefined ? placeholder : String(value)
        })
    }
}
