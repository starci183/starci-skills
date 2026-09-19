import {
    ICommand, ICommandHandler, IQuery, IQueryHandler 
} from "@nestjs/cqrs"

/**
 * The template every command handler plugs into: `@nestjs/cqrs` dispatches through `execute`, which
 * stays final here and delegates to the handler's `process`. A handler overrides `process`, never
 * `execute`, so the next cross-cutting concern added to this template (a timing, a transaction, a
 * retry) reaches every handler at once instead of silently missing the one that bypassed it (CQRS-3).
 */
export abstract class AbstractCommandHandler<TCommand extends ICommand, TResult>
implements ICommandHandler<TCommand, TResult> {
    /** The bus entry point: hands the command to the handler's process step. */
    async execute(command: TCommand): Promise<TResult> {
        return this.process(command)
    }

    protected abstract process(command: TCommand): Promise<TResult>
}

/** The query-side twin of {@link AbstractCommandHandler}: same template, same rule. */
export abstract class AbstractQueryHandler<TQuery extends IQuery, TResult>
implements IQueryHandler<TQuery, TResult> {
    /** The bus entry point: hands the query to the handler's process step. */
    async execute(query: TQuery): Promise<TResult> {
        return this.process(query)
    }

    protected abstract process(query: TQuery): Promise<TResult>
}
