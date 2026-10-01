import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { NotifySmtpClient } from "./notify-smtp.client"
import { NOTIFY_SMTP_CLIENT } from "./notify-smtp.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./notify-smtp.module-definition"

@Module({})
/** The notify-smtp integration: the one client that speaks SMTP to the mail host. */
export class NotifySmtpModule extends ConfigurableModuleClass {
    /** Registers the integration once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: NOTIFY_SMTP_CLIENT, useClass: NotifySmtpClient }],
            exports: [NOTIFY_SMTP_CLIENT],
        }
    }
}
