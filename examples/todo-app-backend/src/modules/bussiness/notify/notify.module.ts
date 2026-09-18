import { DynamicModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './notify.module-definition';
import { NotifySmtpModule } from '../../integrations/notify-smtp';
import { NotifyQueueModule } from '../../integrations/notify-queue';
import { DedupeService } from './dedupe.service';
import { DigestService } from './digest.service';
import { PreferencesService } from './preferences.service';
import { DeliveryService } from './delivery.service';
import { NotifyService } from './notify.service';
import { NotifyScheduler } from './notify.scheduler';
import { NotifyEventSubscriber } from './notify-event.subscriber';
import { UpdateNotificationPreferencesHandler } from './update-notification-preferences.handler';
import { UnsubscribeHandler } from './unsubscribe.handler';
import { NotificationPreferencesHandler } from './notification-preferences.handler';

/**
 * The `notify` capability module, closing gap.notify.unbuilt-module: telling a person something
 * happened, outside the product. Owns every notify service (DedupeService, DigestService,
 * PreferencesService, DeliveryService, NotifyService), the two GraphQL-facing CQRS write handlers
 * (UpdateNotificationPreferencesHandler, UnsubscribeHandler), the one read handler
 * (NotificationPreferencesHandler), the real-timer wiring (NotifyScheduler) and the PlatformEventBus
 * subscription (NotifyEventSubscriber). Persistence is only through `@InjectPrimaryEntityManager()`
 * inside each service - no repository files, no `@InjectRepository`, matching `bussiness/task` and
 * `bussiness/session`. `NotifySmtpModule` and `NotifyQueueModule` provide the two integration ports
 * (`NotifySmtpPort`, `NotifyQueuePort`) `DeliveryService`/`NotifyService` depend on; this module never
 * imports their concrete client classes directly, so a spec can substitute the fakes under
 * `integrations/notify-smtp/testing` and `integrations/notify-queue/testing` without touching this
 * module at all. `PlatformEventsModule` is not imported here either: it is registered globally from
 * `app.module.ts`, the same as every other capability module in this codebase.
 */
@Module({})
export class NotifyModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [CqrsModule, NotifySmtpModule.register(), NotifyQueueModule.register()],
      providers: [
        ...(base.providers ?? []),
        DedupeService,
        DigestService,
        PreferencesService,
        DeliveryService,
        NotifyService,
        NotifyScheduler,
        NotifyEventSubscriber,
        UpdateNotificationPreferencesHandler,
        UnsubscribeHandler,
        NotificationPreferencesHandler,
      ],
      exports: [NotifyService, PreferencesService],
    };
  }
}
