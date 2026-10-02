/**
 * The capability sets of the order product as module factories for a modules world: the real capability modules an
 * integration spec exercises, registered as the app root registers them (global, with the options of the run). A modules
 * spec spreads a set, or picks factories one by one; the spec itself never writes `isGlobal`.
 */
import type { ModuleFactory } from "@starci/test-world"
import { CatalogModule } from "@modules/domain/catalog"
import { CacheModule } from "@modules/integrations/cache"
import { IdentityApiModule } from "@modules/integrations/identity-api"
import { KeycloakModule } from "@modules/integrations/keycloak"
import { KeycloakAdminModule } from "@modules/integrations/keycloak-admin"
import { OrderApiModule } from "@modules/integrations/order-api"
import { ReceiptStorageModule } from "@modules/integrations/receipt-storage"
import { BILLING_ENTITY_MANAGER, ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { EventBusModule } from "@modules/platform/event-bus"
import { InboxModule } from "@modules/platform/inbox"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule } from "@modules/platform/queue"
import { RealtimeModule } from "@modules/platform/realtime"
import { OrderSummaryModule } from "@modules/projections/order-summary"
import type { QueueSchedulerDefinition } from "@modules/platform/queue"
import {
    cacheOptionsOf,
    eventBusOptionsOf,
    identityApiOptionsOf,
    keycloakAdminOptionsOf,
    keycloakOptionsOf,
    orderApiOptionsOf,
    queueOptionsOf,
    receiptStorageOptionsOf,
} from "./test-apps.options"
import { ProbeQueue, PROBE_QUEUE } from "../fixtures/queues/probe.queue"
import { ProbeConsumerModule } from "./probe-consumer.module"
import { ProbeJobModule } from "./probe-job.module"
import { ProbeQueueModule } from "./probe-queue.module"

/** The catalog capability over the order database: stock, reservations. */
export const CATALOG_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    () => CatalogModule.register({ isGlobal: true }),
]

/** The cache client over the run's Redis. */
export const CACHE_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => CacheModule.register({ isGlobal: true, ...cacheOptionsOf(w) }),
]

/** The event bus over the run's Kafka and the outbox of the order database (publisher, relay, consumer registry), the inbox of the billing database, and the consumer of the probe event. */
export const EVENT_BUS_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) =>
        EventBusModule.register({
            isGlobal: true,
            ...eventBusOptionsOf(w, "probe"),
            connections: [ORDER_ENTITY_MANAGER],
        }),
    () => InboxModule.register({ isGlobal: true, connection: BILLING_ENTITY_MANAGER }),
    () => ({ module: ProbeConsumerModule }),
]

/** The realtime hub of one app instance: the push channel of the realtime kind. */
export const REALTIME_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    () => RealtimeModule.register({ isGlobal: true }),
]

/** The order-summary projection over the order database. */
export const ORDER_SUMMARY_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    () => OrderSummaryModule.register({ isGlobal: true }),
]

/** The password-grant client over the run's realm. */
export const KEYCLOAK_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => KeycloakModule.register({ isGlobal: true, ...keycloakOptionsOf(w) }),
]

/** The Keycloak admin client over the run's realm. */
export const KEYCLOAK_ADMIN_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => KeycloakAdminModule.register({ isGlobal: true, ...keycloakAdminOptionsOf(w) }),
]

/** The order api client over the real order app (the world boots it beside the modules). */
export const ORDER_API_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => OrderApiModule.register({ isGlobal: true, ...orderApiOptionsOf(w) }),
]

/** The identity api client over the real identity app (the world boots it beside the modules). */
export const IDENTITY_API_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => IdentityApiModule.register({ isGlobal: true, ...identityApiOptionsOf(w) }),
]

/** The receipt archive over the run's bucket of the stack's MinIO. */
export const RECEIPT_STORAGE_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => ReceiptStorageModule.register({ isGlobal: true, ...receiptStorageOptionsOf(w) }),
]

/** The scheduler of the probe queue, declared twice under one id on purpose: BullMQ upserts it by id, so it still ticks once per interval. */
const TICK: QueueSchedulerDefinition = {
    queue: PROBE_QUEUE,
    id: "probe-tick",
    everyMs: 1000,
    payload: { note: "tick" },
}

/** The queue capability over the run's Redis and the outbox of the order database, with the probe queue's worker and producer, and a scheduler that ticks the probe queue. */
export const QUEUE_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) =>
        QueueModule.register({
            isGlobal: true,
            ...queueOptionsOf(w, `q${w.kafka.topicPrefix.replace(/\W/g, "")}`),
            connections: [ORDER_ENTITY_MANAGER],
            schedulers: [TICK, TICK],
        }),
    () => ({ module: ProbeQueueModule, providers: [ProbeQueue], exports: [ProbeQueue] }),
]

/** The fenced jobs over the order database, on top of the queue capability, with the probe processor. */
export const JOBS_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    ...QUEUE_CAPABILITY_MODULES,
    () =>
        JobsModule.register({
            isGlobal: true,
            connection: ORDER_ENTITY_MANAGER,
            workerId: "probe-worker",
            leaseMs: 1500,
        }),
    () => ({ module: ProbeJobModule }),
]
