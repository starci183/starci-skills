import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BullmqMessagingClient } from "./bullmq-messaging.client"
import { CONSUMER_REGISTRY, MESSAGE_PUBLISHER } from "./messaging.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messaging.module-definition"

@Module({})
/** The messaging capability: publishing to the queues of the Redis of the stack and the worker that feeds the consumers transport modules register. */
export class MessagingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that publishes or consumes messages. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                BullmqMessagingClient,
                { provide: MESSAGE_PUBLISHER, useExisting: BullmqMessagingClient },
                { provide: CONSUMER_REGISTRY, useExisting: BullmqMessagingClient },
            ],
            exports: [MESSAGE_PUBLISHER, CONSUMER_REGISTRY],
        }
    }
}
