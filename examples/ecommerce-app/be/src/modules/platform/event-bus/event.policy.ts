/** How many deliveries an event gets before it is a dead letter. */
export const ATTEMPTS = 5

/** The pause after the first failed delivery; it doubles with every further failure. */
export const BACKOFF_MS = 500

/** The header that carries the number of the delivery a retry message stands for. */
export const ATTEMPT_HEADER = "attempt"

/** The header that carries the instant before which a retry message must not be delivered again. */
export const NOT_BEFORE_HEADER = "not-before"

/** The header that carries why a message was buried. */
export const REASON_HEADER = "reason"

/** The header of a dead-letter message that names the main topic its event travelled on. */
export const ORIGIN_HEADER = "origin-topic"

/** The header of a marker message that says which dead letter was requeued. */
export const REQUEUED_HEADER = "requeued"

/** What joins the topic, partition and offset in the id of a dead letter. */
export const DEAD_LETTER_ID_SEPARATOR = "|"

/** The service an event belongs to: the part of its name before the first dot. */
export const serviceOf = (eventName: string): string => eventName.split(".")[0] ?? eventName

/** The topic the events of a service travel on. */
export const topicOf = (prefix: string, eventName: string): string => `${prefix}events.${serviceOf(eventName)}`

/** The topic a failed delivery waits on until its backoff has passed. */
export const retryTopicOf = (prefix: string, eventName: string): string => `${topicOf(prefix, eventName)}.retry`

/** The topic an event goes to when it ran out of attempts. */
export const deadLetterTopicOf = (prefix: string, eventName: string): string => `${topicOf(prefix, eventName)}.dlq`

/** The pause before the delivery that follows the failed delivery number `attempt`: it doubles with every failure. */
export const backoffMs = (attempt: number): number => BACKOFF_MS * 2 ** (attempt - 1)
