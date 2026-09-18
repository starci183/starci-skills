import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './reconcile-payment.module-definition';
import { ReconcilePaymentResolver } from './reconcile-payment.resolver';

/** PlanModule is not imported here; see upgrade-plan.module.ts's comment. */
@Module({
  imports: [CqrsModule],
  providers: [ReconcilePaymentResolver],
})
export class ReconcilePaymentSingleMutationModule extends ConfigurableModuleClass {}
