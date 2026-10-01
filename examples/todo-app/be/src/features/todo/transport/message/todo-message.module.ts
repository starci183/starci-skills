import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectConsumerRegistry } from "@modules/platform/messaging"
import type { ConsumerRegistry } from "@modules/platform/messaging"
import { TodoModule } from "../../todo.module"
import { AuditAppendConsumer } from "./audit-append.consumer"
import { NotifyAdmitConsumer } from "./notify-admit.consumer"
import { NotifyDispatchConsumer } from "./notify-dispatch.consumer"

@Module({
    imports: [TodoModule],
    providers: [AuditAppendConsumer, NotifyAdmitConsumer, NotifyDispatchConsumer],
})
/** The message transport of the todo feature: registers its consumers with the messaging capability; only the worker composes it. */
export class TodoMessageModule implements OnModuleInit {
    constructor(
        @InjectConsumerRegistry() private readonly registry: ConsumerRegistry,
        private readonly auditAppendConsumer: AuditAppendConsumer,
        private readonly notifyAdmitConsumer: NotifyAdmitConsumer,
        private readonly notifyDispatchConsumer: NotifyDispatchConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.auditAppendConsumer)
        this.registry.add(this.notifyAdmitConsumer)
        this.registry.add(this.notifyDispatchConsumer)
    }
}
