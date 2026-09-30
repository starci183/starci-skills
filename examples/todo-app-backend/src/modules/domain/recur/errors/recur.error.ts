import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the recur capability, also the refusals of the recur operations. */
export enum RecurErrorCode {
    /** The fields of the rule do not fit its frequency; the `reason` param names which. */
    RuleInvalid = "RECUR_RULE_INVALID",
    /** The configured generation cron is not five valid fields; an operator mistake, never a person's. */
    TickCronInvalid = "RECUR_TICK_CRON_INVALID",
    /** The rule belongs to somebody else. */
    RuleForbidden = "RECUR_RULE_FORBIDDEN",
    /** The rule does not exist. */
    RuleNotFound = "RECUR_RULE_NOT_FOUND",
    /** The occurrence belongs to somebody else. */
    OccurrenceForbidden = "RECUR_OCCURRENCE_FORBIDDEN",
    /** The occurrence does not exist. */
    OccurrenceNotFound = "RECUR_OCCURRENCE_NOT_FOUND",
}

/** How each recur code travels. */
export const RECUR_ERROR_KINDS: Record<RecurErrorCode, ErrorKind> = {
    [RecurErrorCode.RuleInvalid]: "invalid",
    [RecurErrorCode.TickCronInvalid]: "internal",
    [RecurErrorCode.RuleForbidden]: "forbidden",
    [RecurErrorCode.RuleNotFound]: "not-found",
    [RecurErrorCode.OccurrenceForbidden]: "forbidden",
    [RecurErrorCode.OccurrenceNotFound]: "not-found",
}

/** The one error class of the recur capability. */
export class RecurError extends DomainError<RecurErrorCode> {}
