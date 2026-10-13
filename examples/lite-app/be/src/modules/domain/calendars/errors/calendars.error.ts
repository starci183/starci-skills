import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the calendars capability. */
export enum CalendarsErrorCode {
    /** No row owned by the authenticated principal has the requested id. */
    NotFound = "CALENDARS_NOT_FOUND",
    /** The database accepted the insert of a new row but answered no id. */
    NotCreated = "CALENDARS_NOT_CREATED",
}

/** How each calendars code travels. */
export const CALENDARS_ERROR_KINDS: Record<CalendarsErrorCode, ErrorKind> = {
    [CalendarsErrorCode.NotFound]: "not-found",
    [CalendarsErrorCode.NotCreated]: "unavailable",
}

/** The one error class of the calendars capability. */
export class CalendarsError extends DomainError<CalendarsErrorCode> {}
