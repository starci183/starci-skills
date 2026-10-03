import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CqrsLogEvent } from "./cqrs.log-events"

/**
 * The template every command and query handler extends. `execute` is what `@nestjs/cqrs` calls: it delegates to the
 * handler `process` and, when that throws, logs `OperationFailed` with the operation name and rethrows. A handler
 * implements `process` and never overrides `execute`. It does not `implements ICommandHandler`: since `@nestjs/cqrs` 11
 * that type is conditional on the message result type, which a class cannot implement; `@CommandHandler` and
 * `@QueryHandler` check the shape where they are applied.
 */
export abstract class ICQRSHandler<TMessage, TResult> {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** The bus entry point. */
    async execute(message: TMessage): Promise<TResult> {
        try {
            return await this.process(message)
        } catch (error) {
            this.logger.error(CqrsLogEvent.OperationFailed, error, { operation: this.constructor.name })
            throw error
        }
    }

    /** The one call of the handler: it hands the mapped message to one method of one service and returns the answer. */
    protected abstract process(message: TMessage): Promise<TResult>
}
