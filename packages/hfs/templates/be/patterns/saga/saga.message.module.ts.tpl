import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { @@Saga@@Module } from "../../@@saga@@.module"
import { @@Done@@Consumer } from "./@@done@@.consumer"
import { @@Failed@@Consumer } from "./@@failed@@.consumer"
import { ConfigurableModuleClass } from "./@@saga@@-message.module-definition"

@Module({ imports: [@@Saga@@Module.register({})], providers: [@@Done@@Consumer, @@Failed@@Consumer] })
/** The message transport of the @@saga@@ saga: registers its consumers with the event bus. */
export class @@Saga@@MessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly @@doneCamel@@Consumer: @@Done@@Consumer,
        private readonly @@failedCamel@@Consumer: @@Failed@@Consumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.@@doneCamel@@Consumer)
        this.registry.add(this.@@failedCamel@@Consumer)
    }
}
