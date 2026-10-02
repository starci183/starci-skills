import { createHash } from "node:crypto"

/** The docker network every container of the shared stack joins. */
export const STACK_NETWORK = "starci-test-net"
/** Label marking a container as part of the shared stack. */
export const LABEL_STACK = "starci.test-stack"
/** Label carrying the service name of a container. */
export const LABEL_SERVICE = "starci.service"
/** Label carrying the full image reference of a container. */
export const LABEL_IMAGE = "starci.image"

/** The toxiproxy image. */
export const TOXIPROXY_IMAGE = "ghcr.io/shopify/toxiproxy:2.9.0"
/** The container port of the toxiproxy REST API. */
export const TOXIPROXY_API_PORT = 8474
/** The first host port (and container port) of the pre-published proxy listen range. */
export const PROXY_PORT_FIRST = 30100
/** The last host port (and container port) of the pre-published proxy listen range. */
export const PROXY_PORT_LAST = 30227
/** The service label value of the toxiproxy container. */
export const TOXIPROXY_SERVICE = "toxiproxy"

/** The first 8 hex characters of the sha256 of an image reference: the key of a shared container. */
export const imageKey = (image: string): string => createHash("sha256").update(image).digest("hex").slice(0, 8)

/** The deterministic container name of a service on an image: `starci-ts-<service>-<imageKey>`. */
export const containerName = (service: string, image: string): string => `starci-ts-${service}-${imageKey(image)}`

/** The name of the toxiproxy proxy of one run and service. */
export const proxyNameOf = (runId: string, service: string): string => `${runId}-${service}`

/**
 * The ONE Kafka image of the StarCi stacks (dev, test world, prod): Apache Kafka in KRaft mode (Kafka 4 has no ZooKeeper
 * mode), pinned by its multi-arch index digest. The stack definition must name exactly this reference.
 */
export const KAFKA_IMAGE = "apache/kafka:4.2.2@sha256:1213eb3943d551e5ed1fca7a4e109001cee35770b66a02a0c37a8964efe09b69"

/** How many slot listeners the broker has: one per concurrently attached data slot, machine-wide. */
export const KAFKA_SLOT_LISTENERS = 8

/** The broker's shape, part of its container identity: a container of another shape is another container, never reused. */
const KAFKA_SHAPE = `slot-listeners-${KAFKA_SLOT_LISTENERS}`

/** The container name of a service on an image; the Kafka broker's name also carries its listener shape. */
export const serviceContainerName = (service: string, image: string): string => containerName(service, service === "kafka" ? `${image}#${KAFKA_SHAPE}` : image)

/** The name of the toxiproxy proxy of one slot listener (1-based) of the Kafka broker of one image. */
export const kafkaProxyName = (image: string, listener: number): string => `kafka-${imageKey(image)}-s${listener}`
