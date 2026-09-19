import {
    DynamicModule, FactoryProvider, Provider 
} from "@nestjs/common"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    TypeOrmModuleOptions 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    ConfigModule 
} from "@modules/platform/config/config.module"
import {
    POSTGRESQL_PRIMARY 
} from "./constants/connection"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    PostgresqlPrimaryModule 
} from "./primary.module"
import {
    AuditErasureRequestEntity 
} from "./entities/audit-erasure-request.entity"
import {
    AuditKeyEntity 
} from "./entities/audit-key.entity"
import {
    AuditLogLineEntity 
} from "./entities/audit-log-line.entity"
import {
    NotifyDeliveryAttemptEntity 
} from "./entities/notify-delivery-attempt.entity"
import {
    NotifyDigestWindowEntity 
} from "./entities/notify-digest-window.entity"
import {
    NotifyNotificationEntity 
} from "./entities/notification.entity"
import {
    NotifyPreferenceEntity 
} from "./entities/notify-preference.entity"
import {
    OccurrenceEntity 
} from "./entities/occurrence.entity"
import {
    PaymentIntentEntity 
} from "./entities/payment-intent.entity"
import {
    RuleEntity 
} from "./entities/rule.entity"
import {
    SessionEntity 
} from "./entities/session.entity"
import {
    ShareInvitationEntity 
} from "./entities/share-invitation.entity"
import {
    SubscriptionEntity 
} from "./entities/subscription.entity"
import {
    TaskEntity 
} from "./entities/task.entity"

/**
 * PostgresqlPrimaryModule.register() cannot be compiled in a unit spec - TypeOrmCoreModule would open
 * a real connection - so this spec asserts on the DynamicModule shape it returns instead: the named
 * connection token, the ConfigModule injection boundary, and the options its useFactory produces.
 */
describe("PostgresqlPrimaryModule",
    () => {
        const findCoreModule = (registered: DynamicModule): DynamicModule => {
            const typeOrmModule = (registered.imports ?? []).find(
                (entry): entry is DynamicModule =>
                    typeof entry === "object" && entry !== null && (entry as DynamicModule).module?.name === "TypeOrmModule",
            )
            if (!typeOrmModule) throw new Error("TypeOrmModule dynamic module not found in imports")
            const coreModule = (typeOrmModule.imports ?? []).find(
                (entry): entry is DynamicModule =>
                    typeof entry === "object" && entry !== null && (entry as DynamicModule).module?.name === "TypeOrmCoreModule",
            )
            if (!coreModule) throw new Error("TypeOrmCoreModule dynamic module not found in imports")
            return coreModule
        }

        const findOptionsProvider = (coreModule: DynamicModule): FactoryProvider => {
            const provider = (coreModule.providers ?? []).find(
                (candidate): candidate is FactoryProvider =>
                    typeof candidate === "object" &&
        candidate !== null &&
        "useFactory" in candidate &&
        ((candidate as FactoryProvider).inject ?? []).includes(AppConfigService),
            )
            if (!provider) throw new Error("TypeOrmModule options factory provider not found")
            return provider
        }

        it("register() returns the module itself, provides and exports PostgresPrimaryClient, and is non-global by default",
            () => {
                const registered = PostgresqlPrimaryModule.register()

                expect(registered.module).toBe(PostgresqlPrimaryModule)
                expect(registered.providers).toContain(PostgresPrimaryClient)
                expect(registered.exports).toContain(PostgresPrimaryClient)
                expect(registered.global).toBeFalsy()
                expect(PostgresqlPrimaryModule.register({
                    isGlobal: true 
                }).global).toBe(true)
            })

        it("threads the POSTGRESQL_PRIMARY name into the data-source and entity-manager provider tokens",
            () => {
                const coreModule = findCoreModule(PostgresqlPrimaryModule.register())
                const tokens = (coreModule.providers ?? []).map(
                    (provider: Provider) => (typeof provider === "object" && provider !== null && "provide" in provider ? provider.provide : provider),
                )

                expect(tokens).toContain(getDataSourceToken(POSTGRESQL_PRIMARY))
                expect(tokens).toContain(getEntityManagerToken(POSTGRESQL_PRIMARY))
                expect(getDataSourceToken(POSTGRESQL_PRIMARY)).toBe("postgresql-primaryDataSource")
            })

        it("injects AppConfigService into the options factory and imports ConfigModule for it",
            () => {
                const coreModule = findCoreModule(PostgresqlPrimaryModule.register())

                expect(coreModule.imports).toContain(ConfigModule)
                expect(findOptionsProvider(coreModule).inject).toEqual([AppConfigService])
            })

        it("builds TypeORM options from the configured database URL with migrations on and synchronize off",
            () => {
                const provider = findOptionsProvider(findCoreModule(PostgresqlPrimaryModule.register()))
                const config = {
                    getDatabaseUrl: () => "postgres://spec-host:5432/specdb" 
                } as AppConfigService

                const options = provider.useFactory(config) as TypeOrmModuleOptions & { url?: string }
                const migrations = options.migrations as unknown as Array<unknown>

                expect(options.type).toBe("postgres")
                expect(options.url).toBe("postgres://spec-host:5432/specdb")
                expect(options.synchronize).toBe(false)
                expect(options.migrationsRun).toBe(true)
                expect(String(migrations[0])).toMatch(/migrations[/\\]\*\.\{js,ts\}$/)
                expect(options.entities).toEqual([
                    SessionEntity,
                    TaskEntity,
                    ShareInvitationEntity,
                    RuleEntity,
                    OccurrenceEntity,
                    NotifyNotificationEntity,
                    NotifyDeliveryAttemptEntity,
                    NotifyPreferenceEntity,
                    NotifyDigestWindowEntity,
                    AuditLogLineEntity,
                    AuditKeyEntity,
                    AuditErasureRequestEntity,
                    SubscriptionEntity,
                    PaymentIntentEntity,
                ])
            })
    })
