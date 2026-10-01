import { Injectable } from "@nestjs/common"
import type { NotifySmtpMessageParams } from "@modules/integrations/notify-smtp"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { DedupeService } from "./dedupe.service"
import { DeliveryService } from "./delivery.service"
import { DigestService } from "./digest.service"
import { NotifyErrorCode } from "./errors/notify.error"
import { NOTIFY_KIND_TASK_COMPLETE } from "./notify.contracts"
import type {
    AdmitParams,
    AdmittedNotification,
    DeliveryVerdict,
    DispatchPlan,
    DispatchNotificationGroupResult,
    NotificationView,
    PrepareDispatchParams,
    PreparedDispatchResult,
    ReceiveAdmitParams,
    ReceiveAdmitResult,
    ReceiveDispatchParams,
    SettleDispatchParams,
} from "./notify.contracts"
import { toNotifyDispatchMessage } from "./notify.mapper"
import { DEFAULT_DIGEST_WINDOW_MINUTES, EMAIL_LOCALE, RETRY_BACKOFF_MS, isBlankChannel } from "./notify.policy"
import { PreferencesService } from "./preferences.service"

/** The inbox source of the admit messages: the claim is per (source, event id). */
const ADMIT_SOURCE = "notify.admit"

/** The inbox source of the dispatch messages. */
const DISPATCH_SOURCE = "notify.dispatch"

/** The result of a dispatch that had nothing to send. */
const NOTHING_DISPATCHED: DispatchNotificationGroupResult = { delivered: 0, retried: 0, bounced: 0 }

@Injectable()
/**
 * The notify pipeline over the dedupe table, the preferences, the digest windows and the deliveries. Admission dedupes
 * by source event, suppresses an unsubscribed recipient before any window or send, and joins the digest window, whose
 * one delayed flush is a dispatch message written with the admission. A dispatch has three steps the caller runs in
 * order: prepare (in a transaction), transmit (in none), settle (in a transaction).
 */
export class NotifyService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly dedupe: DedupeService,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly digest: DigestService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly preferences: PreferencesService,
        @InjectClock() private readonly clock: Clock,
        private readonly delivery: DeliveryService,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /**
     * Receives one delivered admit message: claims it in the inbox (null and nothing else when it was claimed before),
     * admits the event in one transaction stamped with the clock, and gives the claim back when that fails so the
     * redelivery runs.
     */
    async admitOnce(params: ReceiveAdmitParams): Promise<ReceiveAdmitResult> {
        if (!(await this.inbox.claim(ADMIT_SOURCE, params.eventId))) return ok(null)
        try {
            const at = this.clock.now()
            return await this.entityManager.transaction((manager) =>
                this.admit({
                    manager,
                    kind: params.kind,
                    sourceEventId: params.eventId,
                    recipientId: params.recipientId,
                    channel: params.channel,
                    payload: params.payload,
                    at,
                }),
            )
        } catch (error) {
            await this.inbox.release(ADMIT_SOURCE, params.eventId)
            throw error
        }
    }

    /**
     * Receives one delivered dispatch message: claims it in the inbox (nothing sent when it was claimed before), then
     * runs the three steps so no transaction is open across the mail host: prepare in one transaction, transmit in
     * none, settle in a second. The claim is given back when a step fails so the redelivery runs.
     */
    async dispatchOnce(params: ReceiveDispatchParams): Promise<DispatchNotificationGroupResult> {
        if (!(await this.inbox.claim(DISPATCH_SOURCE, params.eventId))) return NOTHING_DISPATCHED
        try {
            const at = this.clock.now()
            const { kind, groupId } = params
            const plan = await this.entityManager.transaction((manager) =>
                this.prepareDispatch({ manager, kind, groupId, at }),
            )
            if (plan === null) return NOTHING_DISPATCHED
            const verdict = await this.transmit(plan)
            return await this.entityManager.transaction((manager) => this.settle({ manager, plan, verdict, at }))
        } catch (error) {
            await this.inbox.release(DISPATCH_SOURCE, params.eventId)
            throw error
        }
    }

    /**
     * Admits one event. A repeated admission of the same event only reads back the first decision: it never checks
     * the preference again, never touches a window and never creates a second attempt. Refuses a blank channel.
     */
    async admit(params: AdmitParams): Promise<Outcome<AdmittedNotification, NotifyErrorCode.ChannelRequired>> {
        const { manager, at } = params
        if (isBlankChannel(params.channel)) return refused(NotifyErrorCode.ChannelRequired)
        const { notification, isNew } = await this.dedupe.admit(params)
        if (!isNew) {
            const attempt = await this.delivery.find({ notificationId: notification.id })
            return ok({ notificationId: notification.id, isNew: false, deliveryState: attempt?.state ?? "queued" })
        }
        const preference = await this.preferences.get({ personId: params.recipientId, channel: params.channel })
        const attempt = await this.delivery.admit({
            manager,
            notificationId: notification.id,
            at,
            unsubscribed: preference.unsubscribed,
        })
        if (!preference.unsubscribed) {
            const window = await this.digest.admit({
                manager,
                personId: params.recipientId,
                channel: params.channel,
                at,
                windowMinutes: preference.digestWindowMinutes ?? DEFAULT_DIGEST_WINDOW_MINUTES,
            })
            await this.dedupe.assignDigestGroup({ manager, id: notification.id, digestGroupId: window.windowId })
            if (window.opened) {
                await this.outbox.enqueue(
                    manager,
                    toNotifyDispatchMessage({
                        eventId: `notify-flush:${window.windowId}`,
                        kind: "flush",
                        groupId: window.windowId,
                        dueAt: window.closesAt,
                    }),
                )
            }
        }
        return ok({ notificationId: notification.id, isNew: true, deliveryState: attempt.state })
    }

    /**
     * Step one of a dispatch: for a flush, closes the window (nothing to do when it is unknown, flushed already or not
     * closed yet); then marks the queued attempts of the group sending and renders the one message they share. Answers
     * null when there is nothing to send.
     */
    async prepareDispatch(params: PrepareDispatchParams): Promise<PreparedDispatchResult> {
        const { manager, groupId, at } = params
        if (params.kind === "flush") {
            const flushed = await this.digest.flush({ manager, windowId: groupId, at })
            if (!flushed) return null
        }
        const notifications = await this.dedupe.findByDigestGroup({ groupId })
        const [first] = notifications
        if (!first) return null
        const sending = await this.delivery.markSending({
            manager,
            notificationIds: notifications.map((notification) => notification.id),
            at,
        })
        if (sending.length === 0) return null
        return {
            notificationIds: sending.map((attempt) => attempt.notificationId),
            groupId,
            message: this.render(first, notifications),
        }
    }

    /** Step two of a dispatch: the send. It runs outside any transaction. */
    transmit(plan: DispatchPlan): Promise<DeliveryVerdict> {
        return this.delivery.transmit(plan.message)
    }

    /** Step three of a dispatch: records what the send came to, and writes the retry message when some attempts go back to queued. */
    async settle(params: SettleDispatchParams): Promise<DispatchNotificationGroupResult> {
        const { manager, plan, at } = params
        const recorded = await this.delivery.record({
            manager,
            notificationIds: plan.notificationIds,
            verdict: params.verdict,
            at,
        })
        if (recorded.retried.length > 0) {
            await this.outbox.enqueue(
                manager,
                toNotifyDispatchMessage({
                    eventId: `notify-retry:${plan.groupId}:${recorded.attempt}`,
                    kind: "retry",
                    groupId: plan.groupId,
                    dueAt: new Date(at.getTime() + RETRY_BACKOFF_MS),
                }),
            )
        }
        return {
            delivered: recorded.delivered.length,
            retried: recorded.retried.length,
            bounced: recorded.bounced.length,
        }
    }

    /**
     * One message for the group. Nothing resolves a person id to an email address today, so the message is addressed
     * to the recipient id itself; a real product would resolve it through a person directory.
     */
    private render(first: NotificationView, notifications: ReadonlyArray<NotificationView>): NotifySmtpMessageParams {
        const lines = notifications.map((notification) =>
            this.catalog.get(
                "notify.email.line",
                { kind: notification.kind, payload: JSON.stringify(notification.payload) },
                EMAIL_LOCALE,
            ),
        )
        return { to: first.recipientId, subject: this.subjectOf(first, notifications.length), body: lines.join("\n") }
    }

    private subjectOf(first: NotificationView, count: number): string {
        if (count > 1) return this.catalog.get("notify.email.digest.subject", { count }, EMAIL_LOCALE)
        if (first.kind === NOTIFY_KIND_TASK_COMPLETE) {
            return this.catalog.get(
                "notify.email.task-complete.subject",
                { taskId: String(first.payload.taskId ?? "") },
                EMAIL_LOCALE,
            )
        }
        return this.catalog.get("notify.email.generic.subject", { kind: first.kind }, EMAIL_LOCALE)
    }
}
