import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a create refused over the free plan's cap. */
export interface PlanCapExceededExceptionMetadata extends DomainErrorMetadata {
  /** The cap the person is at or over, per br.plan.caps.limit. */
  cap?: number;
  /** Where to go to raise the cap, per fr.plan.upgrade. */
  upgradePath?: string;
}

/**
 * br.plan.caps.limit / ac.plan.caps.limit.refuses-over-cap: a free-plan owner at or over the cap has
 * their create refused, naming both the cap and the upgrade path, before anything is written. Thrown by
 * sds.plan.cap-guard's PlanCapGuardPolicy (registered into TaskCreationPolicyRegistry per
 * contract.plan.create-precondition), so a stranded refusal never explains by omission.
 */
export class PlanCapExceededException extends DomainError {
    constructor({ cap, upgradePath, ...metadata }: PlanCapExceededExceptionMetadata = {
    }) {
        super("PLAN_CAP_EXCEEDED_EXCEPTION",
            `The free plan holds at most ${cap ?? 20} active tasks. Upgrade at ${upgradePath ?? "/plan/upgrade"} to create more.`,
            {
                metadata: {
                    cap, upgradePath, ...metadata 
                } 
            })
    }
}
