import { Injectable } from "@nestjs/common"
import type { AcceptLanguage, Locale } from "./i18n.contracts"
import type { RequestLocale } from "./i18n.port"

const DEFAULT_LOCALE: Locale = "vi"

@Injectable()
/** Picks Vietnamese or English from Accept-Language, Vietnamese by default (this example stores no user preference). */
export class AcceptLanguageLocaleService implements RequestLocale {
    /** The first listed language that is Vietnamese or English, Vietnamese when none is. */
    of(acceptLanguage: AcceptLanguage): Locale {
        const header = typeof acceptLanguage === "string" ? acceptLanguage : (acceptLanguage ?? []).join(",")
        for (const part of header.split(",")) {
            const language = part.trim().slice(0, 2).toLowerCase()
            if (language === "vi" || language === "en") return language
        }
        return DEFAULT_LOCALE
    }
}
