import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a create refused over the free plan's cap. */
export interface PlanCapExceededExceptionMetadata extends AbstractExceptionMetadata {
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
export class PlanCapExceededException extends AbstractException {
  constructor({ cap, upgradePath, ...metadata }: PlanCapExceededExceptionMetadata = {}) {
    super(
      `The free plan holds at most ${cap ?? 20} active tasks. Upgrade at ${upgradePath ?? '/plan/upgrade'} to create more.`,
      'PLAN_CAP_EXCEEDED',
      { cap, upgradePath, ...metadata },
    );
  }
}
