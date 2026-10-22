import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INVOICE_SERVICE } from "./invoice.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./invoice.module-definition"
import { InvoiceService } from "./invoice.service"

@Module({})
/** The invoice capability over the billing database; the inbox and the messaging it uses are registered by the app. */
export class InvoiceModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                InvoiceService,
                { provide: INVOICE_SERVICE, useExisting: InvoiceService },
            ],
            exports: [InvoiceService, INVOICE_SERVICE],
        }
    }
}
