import { DynamicModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './audit.module-definition';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditErasureService } from './audit-erasure.service';
import { AuditEventSubscriber } from './audit-event.subscriber';
import { AuditOperatorGuard } from './audit-operator.guard';
import { AuditOperatorService } from './audit-operator.service';
import { AppendLogLineHandler } from './append-log-line.handler';
import { RequestErasureHandler } from './request-erasure.handler';
import { CompleteErasureHandler } from './complete-erasure.handler';
import { AuditLogHandler } from './audit-log.handler';
import { ExportMyDataHandler } from './export-my-data.handler';

/**
 * The `audit` capability module, under nivo's `modules/bussiness/<capability>` shape - impl.audit
 * .todo-app-backend.log and impl.audit.todo-app-backend.erasure's real home, closing
 * gap.audit.unbuilt-module. Owns AuditKeystoreService, AuditLogService, AuditErasureService,
 * AuditEventSubscriber and every audit CQRS handler.
 *
 * No `TypeOrmModule.forFeature(...)` here, same as `bussiness/task`/`bussiness/session`: every service
 * reaches its entities through `@InjectPrimaryEntityManager()`. `PlatformEventsModule` is not imported
 * either - it is registered globally from `app.module.ts`, and `AuditEventSubscriber` injects
 * `PlatformEventBus` directly, exactly as `bussiness/session`'s sign-in/sign-out handlers inject it to
 * publish rather than subscribe.
 */
@Module({})
export class AuditModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [CqrsModule],
      providers: [
        ...(base.providers ?? []),
        AuditKeystoreService,
        AuditLogService,
        AuditErasureService,
        AuditEventSubscriber,
        AuditOperatorGuard,
        AuditOperatorService,
        AppendLogLineHandler,
        RequestErasureHandler,
        CompleteErasureHandler,
        AuditLogHandler,
        ExportMyDataHandler,
      ],
      exports: [AuditLogService, AuditErasureService, AuditKeystoreService],
    };
  }
}
