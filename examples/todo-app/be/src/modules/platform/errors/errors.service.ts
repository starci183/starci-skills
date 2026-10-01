import { Injectable, NotFoundException } from "@nestjs/common"
import type { GraphQLFormattedError } from "graphql"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { DomainError } from "./domain.error"
import { InjectErrorsOptions } from "./errors.decorators"
import type { ErrorDescription, ErrorKind, ErrorParams } from "./errors.contracts"
import { ERRORS_ERROR_KINDS, ErrorsErrorCode } from "./errors/errors.error"
import { formatGraphqlError } from "./graphql-error.mapper"
import { ErrorsLogEvent } from "./errors.log-events"
import type { ErrorsOptions } from "./errors.options"
import { HTTP_STATUS_BY_KIND } from "./http-status.policy"

@Injectable()
/** Turns any failure into the one description every transport answers with: declared codes keep their code and kind, everything else is masked. */
export class ErrorsService {
    private readonly kinds: ReadonlyMap<string, ErrorKind>

    constructor(
        @InjectErrorsOptions() options: ErrorsOptions,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.kinds = new Map([...options.kinds, ERRORS_ERROR_KINDS].flatMap((table) => Object.entries(table)))
    }

    /**
     * Describes `error`: a DomainError of a composed capability keeps its code; the framework's not-found (no route matches
     * the request) is a plain not-found; anything else is logged and masked as internal.
     */
    describe(error: unknown): ErrorDescription {
        if (error instanceof NotFoundException) return this.build(ErrorsErrorCode.RouteNotFound, "not-found", {})
        if (error instanceof DomainError) {
            const kind = this.kinds.get(error.code)
            if (kind !== undefined) return this.build(error.code, kind, error.params)
        }
        this.logger.error(ErrorsLogEvent.Unhandled, error)
        return this.build(ErrorsErrorCode.Internal, "internal", {})
    }

    /** The one GraphQL error formatter, bound to this service so Apollo can call it detached: resolver failures keep their code, everything else is masked. */
    readonly formatError = (formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError =>
        formatGraphqlError(this, formatted, error)

    /** Describes a malformed operation that failed before any capability ran (syntax or schema validation). */
    describeInvalidOperation(): ErrorDescription {
        return this.build(ErrorsErrorCode.OperationInvalid, "invalid", {})
    }

    /** The display text of a failure code in `locale`; a code without a catalog entry answers the text of the internal error. */
    text(code: string, params: ErrorParams, locale: Locale): string {
        const key = `errors.${code}`
        const text = this.catalog.get(key, params, locale)
        return text === key ? this.catalog.get(`errors.${ErrorsErrorCode.Internal}`, {}, locale) : text
    }

    private build(code: string, kind: ErrorKind, params: ErrorParams): ErrorDescription {
        return { code, kind, status: HTTP_STATUS_BY_KIND[kind], params }
    }
}
