import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './notification-preferences.module-definition';
import { NotificationPreferencesResolver } from './notification-preferences.resolver';

@Module({
  imports: [CqrsModule],
  providers: [NotificationPreferencesResolver],
})
export class NotificationPreferencesSingleQueryModule extends ConfigurableModuleClass {}
