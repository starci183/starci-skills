import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DedupeService } from "./dedupe.service"
import { DeliveryService } from "./delivery.service"
import { DigestService } from "./digest.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./notify.module-definition"
import { NotifyService } from "./notify.service"
import { PreferencesService } from "./preferences.service"

@Module({})
/** The notify capability: telling a person something happened outside the product. The handlers that orchestrate it live in the todo feature. */
export class NotifyModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                DedupeService,
                DigestService,
                DeliveryService,
                PreferencesService,
                NotifyService,
            ],
            exports: [NotifyService, PreferencesService],
        }
    }
}
