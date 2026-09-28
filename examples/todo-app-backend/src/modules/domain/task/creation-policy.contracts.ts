/** The actor asking to create a task. */
export interface CreateTaskPrincipalParams {
  readonly actorId: string;
}

/** What they are asking to create. */
export interface CreateTaskInputParams {
  readonly title: string;
}

/** A policy either resolves with nothing to say, or never resolves because it threw a refusal. */
export type TaskCreationPolicyResult = Promise<void>;

/**
 * sds.plan.cap-guard (appliesTo: fr.task.create) plugs into this seam: a future `plan` feature registers
 * a policy that refuses creation once some capacity limit is reached. `assertMayCreate` throws an
 * AbstractException subclass to refuse; returning (or resolving) means the policy has nothing to say
 * against this creation. This is an abstract class rather than an interface so a concrete policy is a
 * real, named, `instanceof`-checkable extension point, matching this codebase's own convention for ports
 * (KeycloakClient, AbstractException) over plain interfaces.
 */
export abstract class TaskCreationPolicy {
  abstract assertMayCreate(principal: CreateTaskPrincipalParams, input: CreateTaskInputParams): TaskCreationPolicyResult;
}
