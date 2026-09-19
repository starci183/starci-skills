/** Preferences service for the preferences.service flow - one named step of the notify capability's behaviour. */
import {
    Injectable 
} from "@nestjs/common"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    NotifyPreferenceEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-preference.entity"
import {
    PreferencePatch 
} from "./types/preference-patch"
import {
    PreferenceRecord 
} from "./types/preference-record"

/**
 * br.notify.unsubscribe.honored: unsubscribing is per person and per channel, and takes effect for every
 * event enqueued after it, immediately. data.notify.preference's invariant ("at most one row per
 * (personId, channel) pair") is enforced by treating the pair as the primary key: `save` upserts by that
 * key rather than ever inserting a second row. No row at all reads as the default (not unsubscribed, no
 * digest-window override) - a person is never forced to have written a preference before receiving
 * anything.
 */
@Injectable()
/** Injectable service owning the per-(personId, channel) notify preferences the unsubscribe flow honors. */
export class PreferencesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    async get(personId: string, channel: string): Promise<PreferenceRecord> {
        const row = await this.entityManager.findOneBy(NotifyPreferenceEntity,
            {
                personId, channel 
            })
        if (!row) {
            return new PreferenceRecord(personId,
                channel,
                false,
                null)
        }
        return toRecord(row)
    }

    async isUnsubscribed(personId: string, channel: string): Promise<boolean> {
        return (await this.get(personId,
            channel)).unsubscribed
    }

    async setUnsubscribed(personId: string, channel: string, unsubscribed: boolean): Promise<PreferenceRecord> {
        return this.update(personId,
            channel,
            {
                unsubscribed 
            })
    }

    async setDigestWindowMinutes(personId: string, channel: string, digestWindowMinutes: number | null): Promise<PreferenceRecord> {
        return this.update(personId,
            channel,
            {
                digestWindowMinutes 
            })
    }

    /** fr.notify.unsubscribe's `updateNotificationPreferences` GraphQL mutation writes through here: an
   * omitted field keeps its current (or default) value, so a caller that only wants to change the digest
   * window never has to also resend the current unsubscribed flag. */
    async update(
        personId: string,
        channel: string,
        patch: PreferencePatch,
    ): Promise<PreferenceRecord> {
        const existing = await this.get(personId,
            channel)
        const saved = await this.entityManager.save(NotifyPreferenceEntity,
            {
                personId,
                channel,
                unsubscribed: patch.unsubscribed ?? existing.unsubscribed,
                digestWindowMinutes: patch.digestWindowMinutes === undefined ? existing.digestWindowMinutes : patch.digestWindowMinutes,
            })
        return toRecord(saved)
    }
}

function toRecord(row: NotifyPreferenceEntity): PreferenceRecord {
    return new PreferenceRecord(row.personId,
        row.channel,
        row.unsubscribed,
        row.digestWindowMinutes)
}
