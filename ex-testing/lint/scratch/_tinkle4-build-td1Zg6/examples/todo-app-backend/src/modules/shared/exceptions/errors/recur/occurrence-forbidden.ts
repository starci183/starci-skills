import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a complete/skip attempt made by someone other than the occurrence's owner. */
export interface RecurOccurrenceForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  /** The occurrence id the actor attempted to mutate. */
  occurrenceId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** br.recur.occurrence.owned-by-rule-owner: only the rule's owner may complete or skip its occurrence. */
export class RecurOccurrenceForbiddenException extends AbstractException {
    constructor({ occurrenceId, actorId, ...metadata }: RecurOccurrenceForbiddenExceptionMetadata = {
    }) {
        super("Not the owner.",
            "RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION",
            {
                occurrenceId, actorId, ...metadata 
            })
    }
}
