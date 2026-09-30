import { builder } from "@starci/jest-preset"
import type { OutboxRecord } from "@modules/platform/outbox"

/** The instant the platform specs run at. */
export const PLATFORM_AT = "2026-05-01T10:00:00.000Z"

/** A later instant, half an hour after {@link PLATFORM_AT}, used as an availability or retry time. */
export const PLATFORM_LATER = new Date("2026-05-01T10:30:00.000Z")

/** A claimed outbox record of the audit.append queue on its first attempt. */
export const outboxRecord = builder<OutboxRecord>({
    id: "m-1",
    queue: "audit.append",
    eventId: "e-1",
    payload: { a: 1 },
    attempts: 1,
})
