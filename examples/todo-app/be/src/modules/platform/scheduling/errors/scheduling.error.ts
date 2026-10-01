import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the scheduling capability. */
export enum SchedulingErrorCode {
    /** A job declared a cron expression that is not five valid fields. */
    CronInvalid = "SCHEDULING_CRON_INVALID",
}

/** How each scheduling code travels. */
export const SCHEDULING_ERROR_KINDS: Record<SchedulingErrorCode, ErrorKind> = {
    [SchedulingErrorCode.CronInvalid]: "internal",
}

/** The one error class of the scheduling capability. */
export class SchedulingError extends DomainError<SchedulingErrorCode> {}
