import { useTranslations } from "next-intl"
import { EmptyNotice, Heading, StaticStateRow } from "@starci/grammar/common"
import type { MaterialisedOccurrence, UpcomingOccurrences } from "./schedule-screen"
import { UPCOMING_LIST_ROWS_CLASS_NAME, UPCOMING_LIST_SECTION_CLASS_NAME } from "./classNames"

/**
 * fr.recur.see-upcoming's collection: every occurrence already materialised (with its status) and,
 * while the rule is active, the live-computed preview of the dates it will next fire on. Previews
 * are labelled as previews - a preview is not a promise the generator has already kept. An ended
 * rule shows no preview, only its kept history and the nothing-upcoming notice.
 *
 * The collection renders as a page section with a heading, never inside a card surface: COLLECTION-1
 * (scripts/checks/render.mjs's entity-list-in-card) reads three or more repeated rows inside a
 * `starci-core-surface` ancestor as a card holding a list, which the canon refuses - a card is one
 * item. SurfaceListCard paints exactly that shell, so the rows live in a plain labelled `section`
 * the way task-list's collection does.
 */
export type UpcomingListProps = {
  readonly isEnded: boolean;
  readonly upcoming: UpcomingOccurrences | null;
};

const materialisedRows = (rows: ReadonlyArray<MaterialisedOccurrence>) =>
    rows.map(occurrence => (
        <StaticStateRow
            key={occurrence.occurrenceId}
            item={{ id: occurrence.occurrenceId, label: occurrence.localDate, description: occurrence.status }}
        />
    ))

/** The upcoming-occurrences section the active and ended states render below the rule summary. */
export const UpcomingList = (props: UpcomingListProps) => {
    const t = useTranslations("recur")
    const upcoming = props.upcoming
    const previewDates = props.isEnded ? [] : (upcoming?.previewDates ?? [])
    return (
        <section aria-label={t("upcoming")} className={UPCOMING_LIST_SECTION_CLASS_NAME}>
            <Heading level={2}>{t("upcoming")}</Heading>
            <ul className={UPCOMING_LIST_ROWS_CLASS_NAME}>
                {materialisedRows(upcoming?.materialised ?? [])}
                {previewDates.map(date => (
                    <StaticStateRow
                        key={`preview-${date}`}
                        item={{ id: `preview-${date}`, label: date, description: t("previewNote") }}
                    />
                ))}
            </ul>
            {props.isEnded ? (
                <EmptyNotice
                    message={t("nothingUpcoming")}
                    description={t("endedNote")}
                />
            ) : null}
        </section>
    )
}
