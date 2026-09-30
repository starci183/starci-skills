import { builder } from "@starci/jest-preset"
import type { I18nOptions } from "@modules/platform/i18n"
import type { MessagingOptions } from "@modules/platform/messaging"
import type { OutboxRecord } from "@modules/platform/outbox"
import type { SchedulingOptions } from "@modules/platform/scheduling"

/** The instant the platform specs run at. */
export const PLATFORM_AT = "2026-05-01T10:00:00.000Z"

/** A later instant, half an hour after {@link PLATFORM_AT}, used as an availability or retry time. */
export const PLATFORM_LATER = new Date("2026-05-01T10:30:00.000Z")

/** The messaging options: poll every 500 ms, take 10 messages, hide a claimed message for 30 s. */
export const messagingOptions = builder<MessagingOptions>({ pollMs: 500, batchSize: 10, visibilityMs: 30_000 })

/** The scheduling options: a one second tick. */
export const schedulingOptions = builder<SchedulingOptions>({ tickMs: 1000 })

/** Two bundles with disjoint keys, in Vietnamese and English. */
export const i18nOptions = builder<I18nOptions>({
    bundles: [
        {
            vi: { "task.title": "Cong viec {{title}}", "task.count": "{{n}} viec" },
            en: { "task.title": "Task {{title}}", "task.count": "{{n}} tasks" },
        },
        { vi: { "share.ok": "Da chia se" }, en: { "share.ok": "Shared" } },
    ],
})

/** A claimed outbox record of the audit.append queue on its first attempt. */
export const outboxRecord = builder<OutboxRecord>({
    id: "m-1",
    queue: "audit.append",
    eventId: "e-1",
    payload: { a: 1 },
    attempts: 1,
})
