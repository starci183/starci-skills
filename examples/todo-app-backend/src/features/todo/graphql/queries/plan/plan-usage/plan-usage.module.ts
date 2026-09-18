import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './plan-usage.module-definition';
import { PlanUsageResolver } from './plan-usage.resolver';

/** Neither SessionService nor PlanModule is imported here: SessionModule is registered globally from
 * app.module.ts (create-task.module.ts's own comment), and PlanModule is registered once from
 * app.module.ts too - its @QueryHandler(PlanUsageQuery) is discovered by @nestjs/cqrs's app-wide
 * explorer once PlanModule is anywhere in the compiled module graph, exactly how list-tasks.module.ts
 * reaches ListTasksHandler without importing TaskModule itself. */
@Module({
  imports: [CqrsModule],
  providers: [PlanUsageResolver],
})
export class PlanUsageSingleQueryModule extends ConfigurableModuleClass {}
