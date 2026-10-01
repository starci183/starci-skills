import { EmptyNotice, StaticStateRow, SurfaceListCard, type StaticStateRowData } from "@starci/grammar/common"
import type { UpcomingOccurrences } from "@/modules/types"

/** Every word the occurrence collection renders, resolved by the connected half. */
type UpcomingListCopy = {
    readonly upcoming: string
    readonly previewNote: string
    readonly nothingUpcoming: string
    readonly endedNote: string
}

/** The collection's contract: the words, whether the rule has ended and the rows the backend answered with. */
export type UpcomingListProps = {
    readonly copy: UpcomingListCopy
    readonly isEnded: boolean
    readonly upcoming: UpcomingOccurrences | null
}

/**
 * fr.recur.see-upcoming's collection: every occurrence already materialised (with its status) and,
 * while the rule is active, the live-computed preview of the dates it will next fire on. Previews
 * are labelled as previews - a preview is not a promise the generator has already kept. An ended
 * rule shows no preview, only its kept history and the nothing-upcoming notice.
 */
export const UpcomingList = (props: UpcomingListProps) => {
    const copy = props.copy
    const upcoming = props.upcoming
    const previewDates = props.isEnded ? [] : (upcoming?.previewDates ?? [])
    const materialised: ReadonlyArray<StaticStateRowData> = (upcoming?.materialised ?? []).map((occurrence) => ({
        id: occurrence.occurrenceId,
        label: occurrence.localDate,
        description: occurrence.status,
    }))
    const previews: ReadonlyArray<StaticStateRowData> = previewDates.map((date) => ({
        id: `preview-${date}`,
        label: date,
        description: copy.previewNote,
    }))
    const rows = [...materialised, ...previews]
    return (
        <SurfaceListCard
            label={copy.upcoming}
            headingLevel={2}
            empty={
                props.isEnded ? <EmptyNotice message={copy.nothingUpcoming} description={copy.endedNote} /> : undefined
            }
        >
            {rows.map((row) => (
                <StaticStateRow key={row.id} item={row} />
            ))}
        </SurfaceListCard>
    )
}
