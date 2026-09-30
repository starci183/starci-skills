import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AccessService } from "./access.service"
import { InvitationService } from "./invitation.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./share.module-definition"

@Module({})
/** The share capability: the invitation rows, their lifecycle and the access rule for completing a shared task. The handlers live in the todo feature. */
export class ShareModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), InvitationService, AccessService],
            exports: [InvitationService, AccessService],
        }
    }
}
