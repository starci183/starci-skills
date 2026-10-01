import type { InfraName } from "../../config/types"
import type { ProxiedEndpoint } from "../contracts"
import type { ServiceDefinition } from "./definition"
import { kafkaService } from "./kafka"
import { keycloakService } from "./keycloak"
import { minioService } from "./minio"
import { postgresService } from "./postgresql"
import { qdrantService } from "./qdrant"
import { redisService } from "./redis"

/** A definition with its run type erased; the stack hands each definition only the run it provisioned itself. */
export type AnyServiceDefinition = ServiceDefinition<ProxiedEndpoint>

const erase = <TRun extends ProxiedEndpoint>(definition: ServiceDefinition<TRun>): AnyServiceDefinition => definition as unknown as AnyServiceDefinition

/** Every service definition by name. */
export const SERVICE_DEFINITIONS: Readonly<Record<InfraName, AnyServiceDefinition>> = {
    postgresql: erase(postgresService),
    redis: erase(redisService),
    minio: erase(minioService),
    qdrant: erase(qdrantService),
    kafka: erase(kafkaService),
    keycloak: erase(keycloakService),
}
