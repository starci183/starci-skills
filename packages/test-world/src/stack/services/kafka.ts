import { TestWorldErrorCode, worldError } from "../../errors"
import type { RunKafka } from "../contracts"
import { KAFKA_SLOT_LISTENERS } from "../naming"
import type { ServiceDefinition, ServiceTarget } from "./definition"

/** The port of the INTERNAL listener: the admin scripts run inside the container against it (`docker exec`). */
export const KAFKA_INTERNAL_PORT = 9092
/** The container port of slot listener 1; listener k listens on `KAFKA_SLOT_PORT_FIRST + k - 1`. */
export const KAFKA_SLOT_PORT_FIRST = 9101
/** The scripts of the `apache/kafka` image. */
export const KAFKA_BIN = "/opt/kafka/bin"
const INTERNAL_BOOTSTRAP = `localhost:${KAFKA_INTERNAL_PORT}`
/** How long a teardown waits for a consumer group whose dead member has not timed out yet (Kafka's default session timeout is 45 s). */
const GROUP_DELETE_DEADLINE_MS = 60_000

/** The container port of one slot listener (1-based). */
export const slotListenerPort = (listener: number): number => KAFKA_SLOT_PORT_FIRST + listener - 1

type Exec = { readonly code: number; readonly stdout: string; readonly stderr: string }

const script = (target: ServiceTarget, name: string, args: ReadonlyArray<string>): Promise<Exec> =>
    target.net.docker.execIn(target.container, [`${KAFKA_BIN}/${name}`, "--bootstrap-server", INTERNAL_BOOTSTRAP, ...args])

const scriptOrThrow = async (target: ServiceTarget, name: string, args: ReadonlyArray<string>): Promise<string> => {
    const result = await script(target, name, args)
    if (result.code !== 0) throw worldError(TestWorldErrorCode.InfrastructureFailed, `${name} ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim().slice(0, 500)}`)
    return result.stdout
}

const linesOf = (text: string): ReadonlyArray<string> => text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "")

/** The slot's own names among a listing: exactly those that begin with its prefix, so another slot's or repository's never match. */
export const ownedBy = (listing: string, prefix: string): ReadonlyArray<string> => linesOf(listing).filter((name) => name.startsWith(prefix))

/** The partitions of each topic in a `kafka-topics --describe` output. */
export const partitionsOf = (describe: string): ReadonlyArray<{ readonly topic: string; readonly partition: number }> =>
    linesOf(describe).flatMap((line) => {
        const match = /Topic:\s*(\S+)\s.*Partition:\s*(\d+)/.exec(line)
        return match?.[1] === undefined || match?.[2] === undefined ? [] : [{ topic: match[1], partition: Number(match[2]) }]
    })

/** The `kafka-delete-records` offset file that empties partitions up to their high watermark (offset -1). */
export const deleteRecordsJson = (partitions: ReadonlyArray<{ readonly topic: string; readonly partition: number }>): string =>
    JSON.stringify({ version: 1, partitions: partitions.map(({ topic, partition }) => ({ topic, partition, offset: -1 })) })

/** The broker environment: INTERNAL and CONTROLLER, plus one listener per slot advertising that slot's proxy port. */
export const brokerEnv = (listenerPorts: ReadonlyArray<number>): Readonly<Record<string, string>> => {
    if (listenerPorts.length !== KAFKA_SLOT_LISTENERS) throw worldError(TestWorldErrorCode.InfrastructureFailed, `the kafka broker needs ${KAFKA_SLOT_LISTENERS} slot listener ports, got ${listenerPorts.length}`)
    const slots = listenerPorts.map((port, index) => ({ name: `S${index + 1}`, container: slotListenerPort(index + 1), advertised: port }))
    return {
        KAFKA_NODE_ID: "1",
        KAFKA_PROCESS_ROLES: "broker,controller",
        KAFKA_LISTENERS: [`INTERNAL://:${KAFKA_INTERNAL_PORT}`, "CONTROLLER://:9093", ...slots.map((slot) => `${slot.name}://:${slot.container}`)].join(","),
        KAFKA_ADVERTISED_LISTENERS: [`INTERNAL://localhost:${KAFKA_INTERNAL_PORT}`, ...slots.map((slot) => `${slot.name}://127.0.0.1:${slot.advertised}`)].join(","),
        KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: ["CONTROLLER:PLAINTEXT", "INTERNAL:PLAINTEXT", ...slots.map((slot) => `${slot.name}:PLAINTEXT`)].join(","),
        KAFKA_INTER_BROKER_LISTENER_NAME: "INTERNAL",
        KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER",
        KAFKA_CONTROLLER_QUORUM_VOTERS: "1@localhost:9093",
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1",
        KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1",
        KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1",
        KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0",
        KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true",
    }
}

/** Deletes the slot's consumer groups; a group with a member still inside its session timeout is retried until the deadline when `wait` is set. */
const deleteGroups = async (target: ServiceTarget, prefix: string, wait: boolean): Promise<ReadonlyArray<string>> => {
    const deadline = Date.now() + (wait ? GROUP_DELETE_DEADLINE_MS : 0)
    let remaining = ownedBy(await scriptOrThrow(target, "kafka-consumer-groups.sh", ["--list"]), prefix)
    for (;;) {
        const failed: Array<string> = []
        for (const group of remaining) if ((await script(target, "kafka-consumer-groups.sh", ["--delete", "--group", group])).code !== 0) failed.push(group)
        if (failed.length === 0 || Date.now() >= deadline) return failed
        await target.net.pause(1000)
        remaining = failed
    }
}

/**
 * Kafka: one single-node KRaft broker (`apache/kafka`, broker and controller, no ZooKeeper) per image. It has one listener per
 * data slot, each advertising its own toxiproxy port, so a slot's clients reach the broker only through the slot's proxy and an
 * outage of that proxy reaches that slot alone. A slot owns the topics, consumer groups and client ids that begin with
 * `<namespace.kebab>.`; every admin call (the image's own scripts through `docker exec`, so the library needs no Kafka client)
 * filters by that exact prefix and never touches another slot's or repository's names.
 */
export const kafkaService: ServiceDefinition<RunKafka> = {
    name: "kafka",
    port: KAFKA_INTERNAL_PORT,
    newSecrets: () => ({}),
    spec: (_image, _secrets, hints) => {
        if (hints.kafkaListenerPorts === null) throw worldError(TestWorldErrorCode.InfrastructureFailed, "the kafka broker was started without its slot listener ports")
        return { env: brokerEnv(hints.kafkaListenerPorts), command: [] }
    },
    // The controller quorum is up and the broker registered: the topics script answers on the INTERNAL listener.
    ready: async (target) => (await script(target, "kafka-topics.sh", ["--list"])).code === 0,
    provision: async (target, input) => {
        const prefix = `${input.namespace.kebab}.`
        const topics: Record<string, string> = {}
        for (const name of input.request.kafka?.topics ?? []) {
            const stored = `${prefix}${name}`
            topics[name] = stored
            await scriptOrThrow(target, "kafka-topics.sh", ["--create", "--if-not-exists", "--topic", stored, "--partitions", "1", "--replication-factor", "1"])
        }
        return { run: { listener: await input.leaseKafkaListener(), topicPrefix: prefix, groupPrefix: prefix, topics } }
    },
    // Before every spec file: the slot's topics are emptied up to their high watermark (committed offsets stay valid) and its
    // idle consumer groups are deleted; a group whose dead member is still inside its session timeout is left (its offsets
    // point at or below the emptied watermark, so it reads nothing stale).
    reset: async (target, run) => {
        const topics = ownedBy(await scriptOrThrow(target, "kafka-topics.sh", ["--list"]), run.topicPrefix)
        if (topics.length > 0) {
            const partitions = partitionsOf(await scriptOrThrow(target, "kafka-topics.sh", ["--describe", "--topic", topics.join(",")]))
            if (partitions.length > 0) {
                const file = `/tmp/starci-delete-records-${run.groupPrefix.replace(/[^a-z0-9-]/gi, "")}.json`
                const written = await target.net.docker.execIn(target.container, ["sh", "-c", `cat > ${file} <<'JSON'\n${deleteRecordsJson(partitions)}\nJSON`])
                if (written.code !== 0) throw worldError(TestWorldErrorCode.InfrastructureFailed, `writing ${file} exited ${written.code}: ${written.stderr.trim()}`)
                await scriptOrThrow(target, "kafka-delete-records.sh", ["--offset-json-file", file])
            }
        }
        await deleteGroups(target, run.groupPrefix, false)
    },
    // Only what the slot created: its consumer groups (waiting out a dead member's session timeout, then failing by name), then its topics.
    deprovision: async (target, run) => {
        const stuck = await deleteGroups(target, run.groupPrefix, true)
        for (const topic of ownedBy(await scriptOrThrow(target, "kafka-topics.sh", ["--list"]), run.topicPrefix)) await scriptOrThrow(target, "kafka-topics.sh", ["--delete", "--topic", topic])
        if (stuck.length > 0) throw worldError(TestWorldErrorCode.InfrastructureFailed, `kafka consumer groups still have members after ${GROUP_DELETE_DEADLINE_MS} ms and were not deleted: ${stuck.join(", ")}`)
    },
}
