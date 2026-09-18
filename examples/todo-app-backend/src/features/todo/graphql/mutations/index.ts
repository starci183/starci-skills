import { DynamicModule } from '@nestjs/common';
import { SignInSingleMutationModule } from './session/sign-in/sign-in.module';
import { SignOutSingleMutationModule } from './session/sign-out/sign-out.module';
import { CreateTaskSingleMutationModule } from './task/create-task/create-task.module';
import { CompleteTaskSingleMutationModule } from './task/complete-task/complete-task.module';
import { ReopenTaskSingleMutationModule } from './task/reopen-task/reopen-task.module';
import { DeleteTaskSingleMutationModule } from './task/delete-task/delete-task.module';
import { UpgradePlanSingleMutationModule } from './plan/upgrade-plan/upgrade-plan.module';
import { DowngradePlanSingleMutationModule } from './plan/downgrade-plan/downgrade-plan.module';
import { ReconcilePaymentSingleMutationModule } from './plan/reconcile-payment/reconcile-payment.module';

/** Every GraphQL mutation module the todo API exposes, gathered exactly like nivo's own
 * `mutations/index.ts` gathers `MUTATION_MODULES`. */
export const MUTATION_MODULES: Array<DynamicModule | (new () => unknown)> = [
  SignInSingleMutationModule.register({}),
  SignOutSingleMutationModule.register({}),
  CreateTaskSingleMutationModule.register({}),
  CompleteTaskSingleMutationModule.register({}),
  ReopenTaskSingleMutationModule.register({}),
  DeleteTaskSingleMutationModule.register({}),
  UpgradePlanSingleMutationModule.register({}),
  DowngradePlanSingleMutationModule.register({}),
  ReconcilePaymentSingleMutationModule.register({}),
];
