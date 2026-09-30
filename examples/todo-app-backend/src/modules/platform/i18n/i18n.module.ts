import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BundleMessageCatalogService } from "./bundle-message-catalog.service"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "./i18n.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./i18n.module-definition"
import { AcceptLanguageLocaleService } from "./request-locale.service"

@Module({})
/** Provides the MessageCatalog and RequestLocale ports. */
export class I18nModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the bundles of every owner it composes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: MESSAGE_CATALOG, useClass: BundleMessageCatalogService },
                { provide: REQUEST_LOCALE, useClass: AcceptLanguageLocaleService },
            ],
            exports: [MESSAGE_CATALOG, REQUEST_LOCALE],
        }
    }
}
