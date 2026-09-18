import { DynamicModule } from '@nestjs/common';
import { ListTasksSingleQueryModule } from './task/list-tasks/list-tasks.module';
import { UpcomingOccurrencesSingleQueryModule } from './recur/upcoming-occurrences/upcoming-occurrences.module';

/** Every GraphQL query module the todo API exposes, gathered exactly like nivo's own
 * `queries/index.ts` gathers `QUERY_MODULES`. */
export const QUERY_MODULES: Array<DynamicModule | (new () => unknown)> = [
  ListTasksSingleQueryModule.register({}),
  UpcomingOccurrencesSingleQueryModule.register({}),
];
