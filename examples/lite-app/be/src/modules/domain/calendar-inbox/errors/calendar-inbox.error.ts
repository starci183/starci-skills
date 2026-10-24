import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the calendar inbox capability. */
export enum CalendarInboxErrorCode {
    /** The payload a receipt retained does not read back as a calendar delivery. */
    MalformedPayload = "CALENDAR_INBOX_MALFORMED_PAYLOAD",
}

/** How each calendar inbox code travels. */
export const CALENDAR_INBOX_ERROR_KINDS: Record<CalendarInboxErrorCode, ErrorKind> = {
    [CalendarInboxErrorCode.MalformedPayload]: "internal",
}

/** The one error class of the calendar inbox capability. */
export class CalendarInboxError extends DomainError<CalendarInboxErrorCode> {}
