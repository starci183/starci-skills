/** The actor asking to create a task. */
export interface CreateTaskPrincipal {
  readonly actorId: string;
}

/** What they are asking to create. */
export interface CreateTaskInput {
  readonly title: string;
}

/**
 * sds.plan.cap-guard (appliesTo: fr.task.create) plugs into this seam: a future `plan` feature registers
 * a policy that refuses creation once some capacity limit is reached. `assertMayCreate` throws an
 * AbstractException subclass to refuse; returning (or resolving) means the policy has nothing to say
 * against this creation.
 */
/** A policy either resolves with nothing to say, or never resolves because it threw a refusal. */
export type TaskCreationPolicyOutcome = Promise<void>;

export interface TaskCreationPolicy {
  assertMayCreate(principal: CreateTaskPrincipal, input: CreateTaskInput): TaskCreationPolicyOutcome;
}
