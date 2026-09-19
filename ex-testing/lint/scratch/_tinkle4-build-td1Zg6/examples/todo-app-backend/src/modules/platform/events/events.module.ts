import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    PlatformEventBus 
} from "./event-bus.providers"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./events.module-definition"

/**
 * The platform events module: every feature that produces or consumes a domain event imports this module
 * and depends only on the exported PlatformEventBus port, never on another feature's module.
 */
@Module({
})
/** Nest module wiring the events capability's providers; the app composition root registers it - other modules never import it. */
export class PlatformEventsModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base, providers: [...(base.providers ?? []),
                PlatformEventBus], exports: [PlatformEventBus] 
        }
    }
}
