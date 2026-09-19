import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./notify-queue.module-definition"
import {
    NotifyQueueClient 
} from "./notify-queue.client"
import {
    NotifyQueuePort 
} from "./notify-queue.contracts"

/** integration.notify.queue: the one real Redis-backed queue client, registered against its own port
 * (`NotifyQueuePort`) so `NotifyModule` never depends on the concrete Redis client directly. */
@Module({
})
/** Nest module wiring the notify-queue capability's providers; the app composition root registers it - other modules never import it. */
export class NotifyQueueModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                {
                    provide: NotifyQueuePort, useClass: NotifyQueueClient 
                }],
            exports: [NotifyQueuePort],
        }
    }
}
