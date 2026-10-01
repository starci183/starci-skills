import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MessageRunnerService } from "./message-runner.service"
import { CONSUMER_REGISTRY } from "./messaging.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messaging.module-definition"

@Module({})
/** The messaging capability: the runner that delivers to the consumers transport modules register. */
export class MessagingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                MessageRunnerService,
                { provide: CONSUMER_REGISTRY, useExisting: MessageRunnerService },
            ],
            exports: [CONSUMER_REGISTRY],
        }
    }
}
