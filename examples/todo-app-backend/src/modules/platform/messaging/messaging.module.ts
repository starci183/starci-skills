import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { OutboxMessagePublisher } from "./message-publisher.service"
import { MessageRunner } from "./message-runner.service"
import { CONSUMER_REGISTRY, MESSAGE_PUBLISHER } from "./messaging.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messaging.module-definition"

@Module({})
/** The messaging capability: the publisher port and the runner that delivers to the consumers transport modules register. */
export class MessagingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                MessageRunner,
                { provide: MESSAGE_PUBLISHER, useClass: OutboxMessagePublisher },
                { provide: CONSUMER_REGISTRY, useExisting: MessageRunner },
            ],
            exports: [MESSAGE_PUBLISHER, CONSUMER_REGISTRY],
        }
    }
}
