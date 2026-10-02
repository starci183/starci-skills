import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Kafka, logLevel } from "kafkajs"
import type { EntityManager } from "typeorm"
import { EVENT_BUS, EVENT_RELAY_MANAGERS, EVENT_CONSUMER_REGISTRY, EVENT_TRANSPORT, KAFKA_FACTORY } from "./event-bus.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./event-bus.module-definition"
import { EventBusService } from "./event-bus.service"
import { EventRelayService } from "./event-relay.service"
import { EventRunnerService } from "./event-runner.service"
import type { KafkaDriver, KafkaDriverConfig } from "./event-transport.port"
import { KafkaEventTransportClient } from "./kafka-event-transport.client"

@Module({})
/** The event bus of a service: the outbox writer, its relay, the consumer runner and the Kafka transport, registered once per app over the connection that holds its outbox. */
export class EventBusModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that publishes or consumes events. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: EVENT_RELAY_MANAGERS,
                    useFactory: (...managers: Array<EntityManager>) => managers,
                    inject: [...options.connections],
                },
                {
                    provide: KAFKA_FACTORY,
                    useValue: {
                        create: (config: KafkaDriverConfig): KafkaDriver =>
                            new Kafka({ ...config, brokers: [...config.brokers], logLevel: logLevel.NOTHING }),
                    },
                },
                KafkaEventTransportClient,
                { provide: EVENT_TRANSPORT, useExisting: KafkaEventTransportClient },
                EventBusService,
                EventRelayService,
                EventRunnerService,
                { provide: EVENT_BUS, useExisting: EventBusService },
                { provide: EVENT_CONSUMER_REGISTRY, useExisting: EventRunnerService },
            ],
            exports: [EVENT_BUS, EVENT_CONSUMER_REGISTRY, EVENT_TRANSPORT],
        }
    }
}
