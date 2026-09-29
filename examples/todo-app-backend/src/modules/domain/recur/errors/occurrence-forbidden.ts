import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a complete/skip attempt made by someone other than the occurrence's owner. */
export interface RecurOccurrenceForbiddenExceptionMetadata extends DomainErrorMetadata {
  /** The occurrence id the actor attempted to mutate. */
  occurrenceId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** br.recur.occurrence.owned-by-rule-owner: only the rule's owner may complete or skip its occurrence. */
export class RecurOccurrenceForbiddenException extends DomainError {
    constructor({ occurrenceId, actorId, ...metadata }: RecurOccurrenceForbiddenExceptionMetadata = {
    }) {
        super("RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION",
            "Not the owner.",
            {
                metadata: {
                    occurrenceId, actorId, ...metadata 
                } 
            })
    }
}
