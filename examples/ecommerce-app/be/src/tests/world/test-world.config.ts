/**
 * The declaration of the ecommerce test world: selection and overrides only. The service list and the image versions come
 * from the stack definition (`.starcistacks/dev`); the library runs Postgres (one database per connection, seeded with the
 * dev seeds), the Redis of the cache, MinIO with the receipts bucket and Keycloak with the stack's realm real behind toxiproxy, and boots the three real apps
 * in process: identity and order are wired to each other and talk to billing over Kafka, and billing serves the signed webhook door of the bank transfer notifier, which is the one fake at the network edge (the SePay fake of the library, delivering to billing).
 */
import { defineTestWorld } from "@starci/test-world"
import type { IdentityWorld, TestApi } from "@starci/test-world"
import { sepayFake } from "@starci/test-world/fakes"
import { EnvSource } from "@modules/platform/config"
import type { RegisterData, SignInData } from "../fixtures/e2e-views.contracts"
import { AppModule as IdentityApp } from "../../../apps/identity/src/app.module"
import { AppModule as OrderApp } from "../../../apps/order/src/app.module"
import { parseCliAppOptions } from "../../../apps/cli/src/cli.options"
import { migrateConnections, openConnection } from "@features/cli"
import { AppModule as BillingApp } from "../../../apps/billing/src/app.module"
import { EVENT_TOPICS } from "./test-apps.options"
import { ECOMMERCE_OPERATIONS } from "./ecommerce-operations.contracts"
import {
    BILLING_ENTITIES,
    IDENTITY_ENTITIES,
    KEYCLOAK_SIGN_IN_CLIENT,
    ORDER_ENTITIES,
    RECEIPTS_BUCKET,
    billingOptions,
    identityOptions,
    orderOptions,
    platformBase,
} from "./test-apps.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The identity app of a booted world, whose public doors register and sign persons in. */
const identityApi = (world: IdentityWorld): TestApi => {
    const identity = world.apps.identity
    if (identity === undefined) {
        throw new TestWorldError({
            code: TestWorldErrorCode.NotDeclared,
            params: { detail: "registering a person needs the identity app booted" },
        })
    }
    return identity.api
}

export const { useTestWorld, useSandbox } = defineTestWorld({
    stack: ".starcistacks/dev",
    stacks: {
        postgresql: {
            connections: [
                { name: "identity", entities: IDENTITY_ENTITIES, seeds: [".starcistacks/dev/seeds/identity-demo.sql"] },
                { name: "order", entities: ORDER_ENTITIES, seeds: [".starcistacks/dev/seeds/order-catalog.sql"] },
                { name: "billing", entities: BILLING_ENTITIES },
            ],
        },
        redis: {},
        kafka: { topics: EVENT_TOPICS },
        minio: { buckets: [RECEIPTS_BUCKET] },
        keycloak: { realm: ".starcistacks/dev/infra/compose/realm-ecommerce.json", clientId: KEYCLOAK_SIGN_IN_CLIENT },
    },
    fakes: { sepay: sepayFake({ webhookPath: "/webhooks/sepay", webhookStyle: "transaction", webhookApp: "billing" }) },
    apps: {
        identity: { module: IdentityApp, operations: ECOMMERCE_OPERATIONS, options: identityOptions },
        order: { module: OrderApp, operations: ECOMMERCE_OPERATIONS, options: orderOptions },
        billing: { module: BillingApp, rawBody: true, options: billingOptions },
    },
    migrate: {
        // the one migration runner: the cli migrate command's, over the cli app's connections
        module: (env: EnvSource) => migrateConnections(parseCliAppOptions(env).connections, openConnection),
        options: (w) =>
            new EnvSource({
                IDENTITY_DB_URL: w.db.identity.url,
                ORDER_DB_URL: w.db.order.url,
                BILLING_DB_URL: w.db.billing.url,
            }),
    },
    identity: {
        emailDomain: "ecommerce.dev",
        register: async (world, { email, password }) => {
            const registered = await identityApi(world).mutate<RegisterData>("register", {
                variables: { input: { email, password } },
            })
            if (registered.data === null) {
                throw new TestWorldError({
                    code: TestWorldErrorCode.SignInRefused,
                    params: { detail: `register ${email}: ${registered.errorCode ?? "no data"}` },
                })
            }
        },
        signIn: async (world, { email, password }) => {
            const signedIn = await identityApi(world).mutate<SignInData>("signIn", {
                variables: { input: { email, password } },
            })
            if (signedIn.data === null) {
                throw new TestWorldError({
                    code: TestWorldErrorCode.SignInRefused,
                    params: { detail: `sign in ${email}: ${signedIn.errorCode ?? "no data"}` },
                })
            }
            return signedIn.data.signIn
        },
    },
    modules: { base: platformBase },
})
