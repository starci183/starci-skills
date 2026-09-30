import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { NotifyErrorCode } from "./errors/notify.error"
import type { FindPreferenceParams, PreferenceView, UpdatePreferenceParams } from "./notify.contracts"
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
