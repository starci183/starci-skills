import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { SUPABASE_ACCESS_TOKEN_VERIFIER } from "@modules/integrations/supabase"
import { AuthGuard } from "./auth.guard"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"

@Module({})
/** The identity capability: its default-deny guard admits only public doors or a verified Supabase principal. */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers identity once per app with the verifier parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: SUPABASE_ACCESS_TOKEN_VERIFIER,
                    useValue: options.verifyAccessToken,
                },
                AuthGuard,
            ],
            exports: [AuthGuard],
        }
    }
}
