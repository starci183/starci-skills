import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./commission.module-definition"
import { CommissionService } from "./commission.service"

@Module({})
/** The commission capability: the referral commission rows and the accrual rule of a paid plan purchase. */
export class CommissionModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), CommissionService],
            exports: [MODULE_OPTIONS_TOKEN, CommissionService],
        }
    }
}
