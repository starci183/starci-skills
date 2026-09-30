/**
 * One GraphQL error as the spec observes it: the message plus the extensions the door's
 * formatError stamped - `code` carries the full *_EXCEPTION code and the refusal metadata
 * sits beside it.
 */
export interface GraphqlErrorObserved {
  readonly message?: string;
  readonly extensions?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

/**
 * What one GraphQL call came back with: the parsed data (or the refusal's error code and
 * message off errors[0].extensions.code) alongside the transport facts - status, raw
 * envelope, wall time - so a spec can assert on the business outcome without losing the
 * wire's own evidence. Refusals resolve rather than reject: a GraphQL error is data.
 */
export interface GraphqlObserved<TData = Record<string, unknown>> {
  readonly httpStatus: number;
  readonly data: TData | null;
  readonly errors: ReadonlyArray<GraphqlErrorObserved> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly raw: unknown;
  readonly durationMs: number;
}

/**
 * The knobs a single GraphQL call takes: the operation's variables, and which session's
 * bearer the call rides on - omitting token makes the call anonymous.
 */
export interface GraphqlCallOptions {
  readonly variables?: Record<string, unknown>;
  readonly token?: string;
}

/**
 * Folds one GraphQL-over-HTTP response into the observed envelope: the HTTP status stays
 * visible beside the parsed data/errors, and a body that is not an object degrades into an
 * `unparsableBody` note instead of failing the fold.
 */
export function graphqlEnvelopeOf<TData = Record<string, unknown>>(
    httpStatus: number,
    body: unknown,
    startedAt: number,
): GraphqlObserved<TData> {
    const envelope = typeof body === "object" && body !== null
        ? body as Record<string, unknown>
        : {
            unparsableBody: String(body).slice(0,
                2000) 
        }
    const errors = Array.isArray(envelope.errors) ? (envelope.errors as Array<GraphqlErrorObserved>) : null
    const firstExtensions = (errors?.[0]?.extensions ?? {
    }) as Record<string, unknown>
    return {
        httpStatus,
        data: (envelope.data ?? null) as TData | null,
        errors,
        errorCode: (firstExtensions.code as string) ?? null,
        errorMessage: (errors?.[0]?.message as string) ?? null,
        raw: envelope,
        durationMs: Date.now() - startedAt,
    }
}
