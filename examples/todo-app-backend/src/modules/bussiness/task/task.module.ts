import { DynamicModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './task.module-definition';
import { TaskService } from './task.service';
import { TaskCreationPolicyRegistry } from './creation-policy.providers';
import { CompletionAuthorityRegistry } from './completion-authority.providers';
import { CreateTaskHandler } from './create-task.handler';
import { CompleteTaskHandler } from './complete-task.handler';
import { ReopenTaskHandler } from './reopen-task.handler';
import { DeleteTaskHandler } from './delete-task.handler';
import { ListTasksHandler } from './list-tasks.handler';

/**
 * The `task` capability module, under nivo's `modules/bussiness/<capability>` shape (renamed from the
 * former `modules/domain/task` + five separate `features/<action>` folders). Owns TaskService, the two
 * seam registries (TaskCreationPolicyRegistry, CompletionAuthorityRegistry - unchanged and still exported
 * so a future `plan` or `share` capability can register into them without importing this module's
 * commands), and every task CQRS command/query handler. The GraphQL transport
 * (`features/todo/graphql/{mutations,queries}/task/**`) depends only on `@nestjs/cqrs`'s CommandBus/
 * QueryBus, never on this module's providers directly.
 *
 * No `TypeOrmModule.forFeature(...)` here: `TaskService` reaches `TaskEntity` through
 * `@InjectPrimaryEntityManager()` (the databases module's own decorator over the named
 * `POSTGRESQL_PRIMARY` connection), not a per-entity repository token, so this capability declares no
 * persistence wiring of its own - nivo's own convention, `@InjectRepository` appears nowhere outside
 * `modules/platform/databases/**`. `PlatformEventsModule` is not imported here either: it is registered
 * globally from `app.module.ts`.
 */
@Module({})
export class TaskModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [CqrsModule],
      providers: [
        ...(base.providers ?? []),
        TaskService,
        TaskCreationPolicyRegistry,
        CompletionAuthorityRegistry,
        CreateTaskHandler,
        CompleteTaskHandler,
        ReopenTaskHandler,
        DeleteTaskHandler,
        ListTasksHandler,
      ],
      exports: [TaskService, TaskCreationPolicyRegistry, CompletionAuthorityRegistry],
    };
  }
}
