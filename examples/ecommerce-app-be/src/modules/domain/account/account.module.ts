import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./account.module-definition"
import { AccountService } from "./account.service"

@Module({})
/** The account capability: credential checking, registration and account reads over the identity database. */
export class AccountModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AccountService], exports: [AccountService] }
    }
}
