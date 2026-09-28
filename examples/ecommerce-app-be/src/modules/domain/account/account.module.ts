import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    AccountService 
} from "./account.service"
import {
    PasswordPolicy 
} from "./password.policy"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./account.module-definition"

@Module({
})
/**
 * The `account` capability module: credential checking, registration and the person behind an id.
 * No persistence imports of its own - AccountService injects the primary EntityManager the
 * database module registers app-wide at `apps/identity`
 * (`PostgresqlPrimaryModule.register({ isGlobal: true })`), and this module's own globality is
 * declared there too, so the identity feature's doors never import a capability.
 */
export class AccountModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                AccountService,
                PasswordPolicy],
            exports: [AccountService],
        }
    }
}
