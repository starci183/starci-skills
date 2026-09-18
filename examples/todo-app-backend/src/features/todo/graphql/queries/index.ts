import { DynamicModule } from '@nestjs/common';
import { ListTasksSingleQueryModule } from './task/list-tasks/list-tasks.module';
import { PlanUsageSingleQueryModule } from './plan/plan-usage/plan-usage.module';

/** Every GraphQL query module the todo API exposes, gathered exactly like nivo's own
 * `queries/index.ts` gathers `QUERY_MODULES`. */
export const QUERY_MODULES: Array<DynamicModule | (new () => unknown)> = [
  ListTasksSingleQueryModule.register({}),
  PlanUsageSingleQueryModule.register({}),
];
