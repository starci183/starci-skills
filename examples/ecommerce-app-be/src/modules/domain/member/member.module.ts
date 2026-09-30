import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MemberProfileService } from "./member-profile.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./member.module-definition"

@Module({})
/** The member capability: the profile of a member, read through the cache from the identity provider. */
export class MemberModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), MemberProfileService],
            exports: [MemberProfileService],
        }
    }
}
