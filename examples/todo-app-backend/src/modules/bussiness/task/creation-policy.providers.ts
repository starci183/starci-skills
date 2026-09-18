import { Injectable } from '@nestjs/common';
import { CreateTaskInputParams, CreateTaskPrincipalParams, TaskCreationPolicy } from './creation-policy.contracts';

/**
 * Empty by default: nothing blocks task creation until a feature registers a policy here from its own
 * Nest module (`registry.register(new SomePolicy())`, typically in that module's constructor or an
 * OnModuleInit hook). create-task consults every registered policy, in registration order, before
 * writing; the first refusal wins and nothing is written.
 */
@Injectable()
export class TaskCreationPolicyRegistry {
  private readonly policies: TaskCreationPolicy[] = [];

  register(policy: TaskCreationPolicy): void {
    this.policies.push(policy);
  }

  async assertMayCreate(principal: CreateTaskPrincipalParams, input: CreateTaskInputParams): Promise<void> {
    for (const policy of this.policies) {
      await policy.assertMayCreate(principal, input);
    }
  }
}
