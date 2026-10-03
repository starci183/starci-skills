import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the calendars capability. */
export enum CalendarsErrorCode {
    /** No row owned by the authenticated principal has the requested id. */
    NotFound = "CALENDARS_NOT_FOUND",
}

/** How each calendars code travels. */
export const CALENDARS_ERROR_KINDS: Record<CalendarsErrorCode, ErrorKind> = {
    [CalendarsErrorCode.NotFound]: "not-found",
}

/** The one error class of the calendars capability. */
export class CalendarsError extends DomainError<CalendarsErrorCode> {}
