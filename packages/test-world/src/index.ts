/**
 * `@starci/test-world`: the shared e2e library of every StarCi back end.
 *
 * A repository declares its world once in `src/tests/world/test-world.config.ts` with {@link defineTestWorld} and its specs
 * call the `useTestWorld` that declaration exports. The jest globalSetup/globalTeardown are the thin re-exports of
 * `@starci/test-world/global-setup` and `/global-teardown`; the warm docker stack is run by the `starci-test-stack` bin.
 */
export { defineTestWorld } from "./config/define"
export type { DefinedTestWorld } from "./config/define"
export { INFRA_SERVICES } from "./config/types"
export type {
    AppDeclaration,
    BucketNames,
    ConnectionNames,
    FakedService,
    IdentityDeclaration,
    IdentityWorld,
    InfraName,
    K3dDeclaration,
    KafkaStack,
    KeycloakStack,
    MigrateDeclaration,
    MigrateEntry,
    MinioStack,
    ModulesDeclaration,
    OptionsOf,
    PersonCredentials,
    PlainStack,
    PostgresConnectionDeclaration,
    PostgresStack,
    RegisterableModule,
    SandboxDeclaration,
    SiblingServiceDeclaration,
    SignedInIdentity,
    StacksDeclaration,
    TestWorldConfig,
    WiringOf,
} from "./config/types"
export type {
    WiredApp,
    WiredCluster,
    WiredDatabase,
    WiredFake,
    WiredKafka,
    WiredKeycloak,
    WiredMinio,
    WiredQdrant,
    WiredRedis,
    WiredService,
    WorldWiring,
} from "./config/wiring"
export type { KeycloakEvent, KeycloakSession } from "./nest/keycloak"
export type { ModuleRegistration, SandboxAnswer, SandboxHandle, SandboxRequest, SandboxSpec } from "./nest/sandbox"
export { TestWorldError, TestWorldErrorCode } from "./errors"
export type { TestWorldErrorCodeValue } from "./errors"
export type {
    GraphqlErrorObserved,
    GraphqlObserved,
    GraphqlWire,
    HttpCaller,
    HttpRequestOptions,
    HttpResponse,
    TestApi,
    TestCaller,
    TestHttp,
} from "./nest/api"
export type { GraphqlSubscription } from "./nest/subscription"
export type {
    AppHandle,
    AppOverride,
    AppsWorldSpec,
    FakeHandles,
    DatabaseOutageHandle,
    InfraHandle,
    KeycloakInfraHandle,
    ModuleFactory,
    ModulesWorldSpec,
    PostgresInfraHandle,
    ProviderToken,
    RedisInfraHandle,
    ServiceHandle,
    SignedInPerson,
    TestWorld,
    WaitForOptions,
    WorldBucket,
    WorldCommandBus,
    WorldInfra,
    WorldKeycloak,
    WorldQueryBus,
    WorldRequestScope,
    WorldSpec,
} from "./nest/world-types"
export type { ClusterClient, ClusterPod, ProxyToxics } from "./stack/contracts"
