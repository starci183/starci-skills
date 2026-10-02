import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MessagingOptions } from "./messaging.options"
import type { ConsumerRegistry, MessagePublisher } from "./messaging.port"

/** Token of the messaging options, exported so a spec can provide it. */
export const MESSAGING_OPTIONS: unique symbol = Symbol("platform.messaging.options")

/** Token of the MessagePublisher port; it is also the health probe token of the queues. */
export const MESSAGE_PUBLISHER: unique symbol = Symbol("platform.messaging.publisher")

/** Token of the consumer registry. */
export const CONSUMER_REGISTRY: unique symbol = Symbol("platform.messaging.consumer-registry")

/** Injects the options of the messaging capability. Parameter type: MessagingOptions. */
export const InjectMessagingOptions = (): TypedParameterDecorator<MessagingOptions> =>
    injector<MessagingOptions>(MESSAGING_OPTIONS)

/** Injects the MessagePublisher port. Parameter type: MessagePublisher. */
export const InjectMessagePublisher = (): TypedParameterDecorator<MessagePublisher> =>
    injector<MessagePublisher>(MESSAGE_PUBLISHER)

/** Injects the consumer registry. Parameter type: ConsumerRegistry. */
export const InjectConsumerRegistry = (): TypedParameterDecorator<ConsumerRegistry> =>
    injector<ConsumerRegistry>(CONSUMER_REGISTRY)
