import { TestWorldErrorCode, worldError } from "../../errors"
import type { RunKafka } from "../contracts"
import type { ServiceDefinition, ServiceTarget } from "./definition"

/** The port of the external listener (the one published, proxied and advertised). */
export const KAFKA_EXTERNAL_PORT = 9094
/** The topics script of the `apache/kafka` image. */
export const KAFKA_TOPICS_SCRIPT = "/opt/kafka/bin/kafka-topics.sh"
const INTERNAL_BOOTSTRAP = "localhost:9092"

const topicsCommand = (target: ServiceTarget, args: ReadonlyArray<string>): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
    target.net.docker.execIn(target.container, [KAFKA_TOPICS_SCRIPT, "--bootstrap-server", INTERNAL_BOOTSTRAP, ...args])

const topicsOrThrow = async (target: ServiceTarget, args: ReadonlyArray<string>): Promise<string> => {
    const result = await topicsCommand(target, args)
    if (result.code !== 0) throw worldError(TestWorldErrorCode.InfrastructureFailed, `kafka-topics ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim().slice(0, 500)}`)
    return result.stdout
}

/**
 * Kafka: single-node KRaft (`apache/kafka`). The broker advertises the address clients must use, so Kafka is the one
 * documented exception to per-run proxies: the stack keeps ONE proxy with a fixed leased port, the broker advertises
 * `127.0.0.1:<that port>`, and every run shares it. Topics are created and deleted with the image's own script through
 * `docker exec`, so the library needs no Kafka client.
 */
export const kafkaService: ServiceDefinition<RunKafka> = {
    name: "kafka",
    port: KAFKA_EXTERNAL_PORT,
    newSecrets: () => ({}),
    spec: (_image, _secrets, hints) => ({
        env: {
            KAFKA_NODE_ID: "1",
            KAFKA_PROCESS_ROLES: "broker,controller",
            KAFKA_LISTENERS: `INTERNAL://:9092,EXTERNAL://:${KAFKA_EXTERNAL_PORT},CONTROLLER://:9093`,
            KAFKA_ADVERTISED_LISTENERS: `INTERNAL://localhost:9092,EXTERNAL://127.0.0.1:${hints.advertisedPort ?? KAFKA_EXTERNAL_PORT}`,
            KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT",
            KAFKA_INTER_BROKER_LISTENER_NAME: "INTERNAL",
            KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER",
            KAFKA_CONTROLLER_QUORUM_VOTERS: "1@localhost:9093",
            KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1",
            KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1",
            KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1",
            KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0",
            KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true",
        },
        command: [],
    }),
    ready: async (target) => (await topicsCommand(target, ["--list"])).code === 0,
    provision: async (target, input) => {
        const topicPrefix = `${input.namespace.kebab}.`
        const topics: Record<string, string> = {}
        for (const name of input.request.kafka?.topics ?? []) {
            const stored = `${topicPrefix}${name}`
            topics[name] = stored
            await topicsOrThrow(target, ["--create", "--if-not-exists", "--topic", stored, "--partitions", "1", "--replication-factor", "1"])
        }
        return { run: { topicPrefix, topics } }
    },
    // Topics keep no per-spec state worth clearing: the world uses fresh consumer groups per run.
    reset: async () => undefined,
    deprovision: async (target, run) => {
        const listed = await topicsOrThrow(target, ["--list"])
        for (const topic of listed.split(/\r?\n/).map((line) => line.trim())) {
            if (topic.startsWith(run.topicPrefix)) await topicsOrThrow(target, ["--delete", "--topic", topic])
        }
    },
}
