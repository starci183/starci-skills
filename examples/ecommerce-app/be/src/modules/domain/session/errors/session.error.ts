import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the session capability. */
export enum SessionErrorCode {
    /** No live session answers the presented token. */
    Invalid = "SESSION_INVALID",
}

/** How each session code travels. */
export const SESSION_ERROR_KINDS: Record<SessionErrorCode, ErrorKind> = {
    [SessionErrorCode.Invalid]: "unauthenticated",
}

/** The one error class of the session capability. */
export class SessionError extends DomainError<SessionErrorCode> {}
