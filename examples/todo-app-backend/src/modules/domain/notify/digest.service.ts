import { Injectable } from "@nestjs/common"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { IsNull } from "typeorm"
import type {
    AdmitIntoWindowParams,
    AdmittedIntoWindow,
    FlushedWindow,
    FlushWindowParams,
} from "./notify.contracts"
import { NotifyDigestWindowEntity } from "./persistence/entities/digest-window.entity"

const MS_PER_MINUTE = 60_000

@Injectable()
/**
 * The digest windows: one rolling window per person and channel. Every notification admitted before the window closes
 * joins it, and its content is read at close, never at open. Which notifications belong to a window is the
 * notification's own digest group id.
 */
export class DigestService {
    constructor(@InjectIds() private readonly ids: Ids) {}

    /** Joins the open window of the person and the channel, or opens a new one when none is open or the open one has closed. */
    async admit(params: AdmitIntoWindowParams): Promise<AdmittedIntoWindow> {
        // IsNull() is required: a literal null in `where` is dropped by TypeORM instead of becoming IS NULL.
        const open = await params.manager.findOneBy(NotifyDigestWindowEntity, {
            personId: params.personId,
            channel: params.channel,
            flushedAt: IsNull(),
        })
        if (open && open.closesAt.getTime() > params.at.getTime()) {
            return { windowId: open.id, opened: false, closesAt: open.closesAt }
        }
        const closesAt = new Date(params.at.getTime() + params.windowMinutes * MS_PER_MINUTE)
        const saved = await params.manager.save(NotifyDigestWindowEntity, {
            id: this.ids.next(),
            personId: params.personId,
            channel: params.channel,
            opensAt: params.at,
            closesAt,
            flushedAt: null,
        })
        return { windowId: saved.id, opened: true, closesAt: saved.closesAt }
    }

    /** Marks the window flushed; answers null and writes nothing when it does not exist, is flushed already, or has not closed yet. */
    async flush(params: FlushWindowParams): Promise<FlushedWindow | null> {
        const row = await params.manager.findOneBy(NotifyDigestWindowEntity, { id: params.windowId })
        if (!row || row.flushedAt || row.closesAt.getTime() > params.at.getTime()) return null
        const result = await params.manager.update(
            NotifyDigestWindowEntity,
            { id: row.id, flushedAt: IsNull() },
            { flushedAt: params.at },
        )
        if (result.affected !== 1) return null
        return { windowId: row.id, personId: row.personId, channel: row.channel }
    }
}
