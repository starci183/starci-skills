/**
 * The stack definition reader: the one place that knows how `.starcistacks/<env>` names service images. The compose files
 * under `<stackDir>/infra/compose` are the source of truth; `application-stacks.yaml` components are the fallback.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "yaml"
import { TestWorldErrorCode, worldError } from "../errors"
import type { StackImageRequest } from "../stack/contracts"
import { KAFKA_IMAGE } from "../stack/naming"
import { INFRA_SERVICES, type FakedService, type InfraName, type SiblingServiceDeclaration, type StacksDeclaration } from "./types"

/** One service of the stack definition that has an image. */
export interface StackDefinitionService {
    /** The image reference with `${VAR:-default}` resolved. */
    readonly image: string
    /** Where it was read: the compose file (relative to the root) or `.starcistacks/application-stacks.yaml`. */
    readonly source: string
}

/** Every image-carrying service of a stack definition, by compose service name (or component name). */
export interface StackDefinition {
    readonly services: Readonly<Record<string, StackDefinitionService>>
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}/g

/** Resolves `${VAR:-default}` and `${VAR-default}` to the default; answers `undefined` when a variable has no default. */
export const resolveImageString = (raw: string): string | undefined => {
    let unresolved = false
    const resolved = raw.replace(VARIABLE, (_match, _name: string, fallback: string | undefined) => {
        if (fallback === undefined) unresolved = true
        return fallback ?? ""
    })
    const trimmed = resolved.trim()
    return unresolved || trimmed === "" || trimmed.includes("${") ? undefined : trimmed
}

const readYaml = (file: string): unknown => {
    try {
        return parse(readFileSync(file, "utf8"))
    } catch (error) {
        throw worldError(
            TestWorldErrorCode.StackDefinition,
            `the stack definition file ${file} cannot be read as YAML: ${error instanceof Error ? error.message : String(error)}`,
            error,
        )
    }
}

/**
 * Reads the stack definition of `<root>/<stackDir>`: every compose service that names an image (build-only services are
 * skipped), then the components of `<root>/.starcistacks/application-stacks.yaml` for names no compose file gave.
 */
export const readStackDefinition = (root: string, stackDir: string): StackDefinition => {
    const services: Record<string, StackDefinitionService> = {}
    const composeDir = join(root, stackDir, "infra", "compose")
    if (existsSync(composeDir)) {
        const files = readdirSync(composeDir)
            .filter((file) => /\.ya?ml$/i.test(file))
            .sort()
        for (const file of files) {
            const declared = asRecord(asRecord(readYaml(join(composeDir, file)))?.services)
            if (declared === undefined) continue
            for (const [name, service] of Object.entries(declared)) {
                const image = asRecord(service)?.image
                if (typeof image !== "string" || services[name] !== undefined) continue
                const resolved = resolveImageString(image)
                if (resolved !== undefined) services[name] = { image: resolved, source: `${stackDir}/infra/compose/${file}` }
            }
        }
    }
    const stacksFile = join(root, ".starcistacks", "application-stacks.yaml")
    if (existsSync(stacksFile)) {
        const components = asRecord(asRecord(readYaml(stacksFile))?.components)
        for (const [name, component] of Object.entries(components ?? {})) {
            const image = asRecord(component)?.image
            if (typeof image !== "string" || services[name] !== undefined) continue
            const resolved = resolveImageString(image)
            if (resolved !== undefined) services[name] = { image: resolved, source: ".starcistacks/application-stacks.yaml" }
        }
    }
    return { services }
}

const KIND_PATTERN: Readonly<Record<InfraName, string>> = {
    postgresql: "postgres|postgresql|pgvector|paradedb",
    redis: "redis|valkey",
    minio: "minio",
    qdrant: "qdrant",
    kafka: "kafka",
    keycloak: "keycloak",
}

/** The image repository's last path segment: `quay.io/keycloak/keycloak:26.0` gives `keycloak`. */
const repositoryName = (image: string): string => {
    const withoutDigest = image.replace(/@sha256:.*$/, "")
    const slash = withoutDigest.lastIndexOf("/")
    const last = withoutDigest.slice(slash + 1)
    const colon = last.indexOf(":")
    return colon === -1 ? last : last.slice(0, colon)
}

/** Whether a stack definition service is of this infra kind (by its compose name or its image repository). */
export const matchesKind = (kind: InfraName, name: string, image: string): boolean => {
    const pattern = new RegExp(`^(${KIND_PATTERN[kind]})$`, "i")
    return pattern.test(name) || pattern.test(repositoryName(image))
}

/** Whether a `stacks` entry is a {@link FakedService}. */
export const isFakedService = (entry: unknown): entry is FakedService => {
    const record = asRecord(entry)
    return record !== undefined && "fakedBy" in record
}

/** Whether a `stacks` key is one of the supported infrastructure services. */
export const isInfraName = (key: string): key is InfraName => (INFRA_SERVICES as ReadonlyArray<string>).includes(key)

/** The infra services (canonical order) a declaration selects: known keys that are not faked. */
export const selectedInfraServices = (stacks: StacksDeclaration): ReadonlyArray<InfraName> =>
    INFRA_SERVICES.filter((service) => stacks[service] !== undefined && !isFakedService(stacks[service]))

/**
 * Resolves the image of every selected infra service: the declaration's `image` override first, else the definition's
 * service of that kind. Throws StackDefinition naming the key, the stack dir and the services found.
 */
export const resolveInfraImages = (stacks: StacksDeclaration, definition: StackDefinition, stackDir = ".starcistacks/dev"): ReadonlyArray<StackImageRequest> =>
    selectedInfraServices(stacks).map((service) => {
        const override = asRecord(stacks[service])?.image
        if (typeof override === "string" && override !== "") return pinned({ service, image: override }, stackDir)
        const found = Object.entries(definition.services).find(([name, entry]) => matchesKind(service, name, entry.image))
        if (found === undefined) {
            const names = Object.entries(definition.services).map(([name, entry]) => `${name} (${entry.image})`)
            throw worldError(
                TestWorldErrorCode.StackDefinition,
                `stacks.${service} is declared but the stack definition ${stackDir} has no ${service} service; it has: ${names.length === 0 ? "no services with an image" : names.join(", ")}. Add the service to a compose file under ${stackDir}/infra/compose or set stacks.${service}.image.`,
            )
        }
        return pinned({ service, image: found[1].image }, stackDir)
    })

/** Kafka runs the ONE pinned image ({@link KAFKA_IMAGE}): no Redpanda, no cp-kafka, no tag without its digest. */
const pinned = (request: StackImageRequest, stackDir: string): StackImageRequest => {
    if (request.service === "kafka" && request.image !== KAFKA_IMAGE) {
        throw worldError(
            TestWorldErrorCode.StackDefinition,
            `stacks.kafka resolves to ${request.image} in ${stackDir}; the StarCi event bus is Apache Kafka in KRaft mode at exactly ${KAFKA_IMAGE} (pinned by digest; no Redpanda, no cp-kafka, no undigested tag)`,
        )
    }
    return request
}

/** The image of a sibling service `services.<name>`: the declaration's `image`, else the compose service of that name. */
export const resolveSiblingImage = (name: string, declaration: SiblingServiceDeclaration, definition: StackDefinition, stackDir = ".starcistacks/dev"): string => {
    if (declaration.image !== undefined && declaration.image !== "") return declaration.image
    const found = definition.services[name]
    if (found === undefined) {
        const names = Object.keys(definition.services)
        throw worldError(
            TestWorldErrorCode.StackDefinition,
            `services.${name} has no image: the stack definition ${stackDir} has no service named ${name} (it has: ${names.length === 0 ? "none" : names.join(", ")}); set services.${name}.image or add the service to a compose file.`,
        )
    }
    return found.image
}

/** Resolves the images of every sibling of `services`, by name. */
export const resolveSiblingImages = (
    siblings: Readonly<Record<string, SiblingServiceDeclaration>>,
    definition: StackDefinition,
    stackDir = ".starcistacks/dev",
): Readonly<Record<string, string>> =>
    Object.fromEntries(Object.entries(siblings).map(([name, declaration]) => [name, resolveSiblingImage(name, declaration, definition, stackDir)]))
