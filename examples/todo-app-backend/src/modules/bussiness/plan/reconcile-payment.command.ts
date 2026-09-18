export interface ReconcilePaymentCommandParams {
  readonly actorId: string;
  /** data.plan.payment-intent's own id, the idempotency key - the reference the owner got back from
   * upgradePlan. */
  readonly paymentIntentId: string;
}

export interface ReconcilePaymentCommandResult {
  /** The gateway's status as polled just now: pending, paid or failed. */
  readonly gatewayStatus: string;
  /** Whether this call is the one that actually applied the intent (false on a no-op: still pending,
   * or already applied/failed by an earlier webhook or reconcile). */
  readonly applied: boolean;
  readonly subscriptionStatus: string;
}

/** fr.plan.reconcile as a CQRS write, dispatched by the GraphQL reconcilePayment mutation resolver (the
 * owner's "check my payment" path) or, in a future revision, by a scheduled sweep - either caller polls
 * the same intent through this one command. */
export class ReconcilePaymentCommand {
  constructor(readonly params: ReconcilePaymentCommandParams) {}
}
