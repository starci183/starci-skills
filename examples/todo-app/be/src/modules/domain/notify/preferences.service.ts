import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { NotifyErrorCode } from "./errors/notify.error"
import type {
    ChangePreferenceParams,
    ChangePreferenceResult,
    FindPreferenceParams,
    PreferenceSummary,
    PreferenceView,
    UnsubscribeParams,
    UnsubscribeResult,
    UpdatePreferenceParams,
} from "./notify.contracts"
import { isBlankChannel, isValidDigestWindow } from "./notify.policy"
import { NotifyPreferenceEntity } from "./persistence/entities/preference.entity"
import { toPreferenceView } from "./persistence/notify.rows"

@Injectable()
/**
 * The preference of a person on a channel: opted out or not, and an optional digest window. The pair is the primary
 * key, so a write replaces the row and there is never a second one. No row reads as the default (subscribed, no window
 * override): nobody has to write a preference to receive anything.
 */
export class PreferencesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The preference of the pair, or the default when nothing was ever written. */
    async get(params: FindPreferenceParams): Promise<PreferenceView> {
        const row = await this.entityManager.findOneBy(NotifyPreferenceEntity, {
            personId: params.personId,
            channel: params.channel,
        })
        return row ? toPreferenceView(row) : { ...params, unsubscribed: false, digestWindowMinutes: null }
    }

    /** The preference of the pair in the shape the preference doors return; the default when nothing was ever written. */
    async read(params: FindPreferenceParams): Promise<PreferenceSummary> {
        const { channel, unsubscribed, digestWindowMinutes } = await this.get(params)
        return { channel, unsubscribed, digestWindowMinutes }
    }

    /** Writes the changed fields of the pair in one transaction; an omitted field keeps its current value. */
    change(params: ChangePreferenceParams): Promise<ChangePreferenceResult> {
        return this.entityManager.transaction(async (manager) => {
            const outcome = await this.update({
                manager,
                personId: params.personId,
                channel: params.channel,
                patch: { unsubscribed: params.unsubscribed, digestWindowMinutes: params.digestWindowMinutes },
            })
            if (outcome.kind === "refused") return outcome
            const { channel, unsubscribed, digestWindowMinutes } = outcome.value
            return ok({ channel, unsubscribed, digestWindowMinutes })
        })
    }

    /** Marks the channel unsubscribed in one transaction; every later admission reads it, so there is no cache to invalidate. */
    unsubscribe(params: UnsubscribeParams): Promise<UnsubscribeResult> {
        return this.entityManager.transaction(async (manager) => {
            const outcome = await this.update({
                manager,
                personId: params.personId,
                channel: params.channel,
                patch: { unsubscribed: true },
            })
            if (outcome.kind === "refused") return outcome
            return ok({ channel: outcome.value.channel, unsubscribed: true as const })
        })
    }

    /**
     * Applies the patch: an omitted field keeps its current value, so changing only the window never resends the
     * opt-out flag. Refuses a blank channel and a window that is not a whole number of minutes of at least one.
     */
    async update(
        params: UpdatePreferenceParams,
    ): Promise<Outcome<PreferenceView, NotifyErrorCode.ChannelRequired | NotifyErrorCode.DigestWindowInvalid>> {
        const { manager, personId, channel, patch } = params
        if (isBlankChannel(channel)) return refused(NotifyErrorCode.ChannelRequired)
        if (typeof patch.digestWindowMinutes === "number" && !isValidDigestWindow(patch.digestWindowMinutes)) {
            return refused(NotifyErrorCode.DigestWindowInvalid, { minutes: patch.digestWindowMinutes })
        }
        const existing = await manager.findOneBy(NotifyPreferenceEntity, { personId, channel })
        const saved = await manager.save(NotifyPreferenceEntity, {
            personId,
            channel,
            unsubscribed: patch.unsubscribed ?? existing?.unsubscribed ?? false,
            digestWindowMinutes:
                patch.digestWindowMinutes === undefined
                    ? (existing?.digestWindowMinutes ?? null)
                    : patch.digestWindowMinutes,
        })
        return ok(toPreferenceView(saved))
    }
}
