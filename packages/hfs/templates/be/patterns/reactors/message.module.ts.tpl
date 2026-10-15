import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { @@Reactor@@Module } from "../../@@reactor@@.module"
import { @@Event@@Consumer } from "./@@event@@.consumer"
import { ConfigurableModuleClass } from "./@@reactor@@-message.module-definition"

@Module({ imports: [@@Reactor@@Module.register({})], providers: [@@Event@@Consumer] })
/** The message transport of the @@reactor@@ reactor: registers its consumers with the event bus; a worker or api app composes it. */
export class @@Reactor@@MessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly @@eventCamel@@Consumer: @@Event@@Consumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.@@eventCamel@@Consumer)
    }
}
