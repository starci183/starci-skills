import { DynamicModule, Module } from '@nestjs/common';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './notify-smtp.module-definition';
import { NotifySmtpClient } from './notify-smtp.client';
import { NotifySmtpPort } from './notify-smtp.contracts';

/**
 * integration.notify.smtp: the one real SMTP client, registered against its own port (`NotifySmtpPort`)
 * the way `KeycloakModule` registers `KeycloakClient` - `NotifyModule` depends on the port, never on
 * this concrete class, so a spec can substitute `FakeNotifySmtpClient` without touching this module.
 */
@Module({})
export class NotifySmtpModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      providers: [...(base.providers ?? []), { provide: NotifySmtpPort, useClass: NotifySmtpClient }],
      exports: [NotifySmtpPort],
    };
  }
}
