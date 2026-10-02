import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./@@provider@@-inbox.module-definition"
import { @@Provider@@InboxService } from "./@@provider@@-inbox.service"

@Module({})
/** The durable, provider-specific inbox composed once by the API app. */
export class @@Provider@@InboxModule extends ConfigurableModuleClass {
    /** Registers the @@provider@@ inbox and exposes its intake to the webhook door. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), @@Provider@@InboxService], exports: [@@Provider@@InboxService] }
    }
}
