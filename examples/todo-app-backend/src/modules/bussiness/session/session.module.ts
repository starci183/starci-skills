import { DynamicModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { KeycloakModule } from '../../integrations/keycloak';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './session.module-definition';
import { SessionService } from './session.service';
import { SignInHandler } from './sign-in.handler';
import { SignOutHandler } from './sign-out.handler';

/**
 * The `session` capability module, under nivo's `modules/bussiness/<capability>` shape (renamed from the
 * former `modules/domain/session` + two separate `features/sign-in|sign-out` folders). Owns
 * SessionService and the sign-in/sign-out CQRS handlers; imports KeycloakModule itself, exactly as the
 * former SignInModule/SignOutModule did, so the cross-capability orchestration moves into this module
 * without changing which modules the app composes it against.
 *
 * No `TypeOrmModule.forFeature(...)` here: `SessionService` reaches `SessionEntity` through
 * `@InjectPrimaryEntityManager()`, not a per-entity repository token - this capability has no
 * repository file and declares no persistence wiring of its own. `ConfigModule`/`PlatformEventsModule`
 * are not imported here either: both are registered globally from `app.module.ts`.
 */
@Module({})
export class SessionModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [CqrsModule, KeycloakModule.register()],
      providers: [...(base.providers ?? []), SessionService, SignInHandler, SignOutHandler],
      exports: [SessionService],
    };
  }
}
