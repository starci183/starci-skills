import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './downgrade-plan.module-definition';
import { DowngradePlanResolver } from './downgrade-plan.resolver';

/** PlanModule is not imported here; see upgrade-plan.module.ts's comment. */
@Module({
  imports: [CqrsModule],
  providers: [DowngradePlanResolver],
})
export class DowngradePlanSingleMutationModule extends ConfigurableModuleClass {}
