import { EmptyNotice, StaticStateRow, SurfaceListCard } from '@starci/grammar/common';
import type { MaterialisedOccurrence, UpcomingOccurrences } from './schedule-screen';

/**
 * fr.recur.see-upcoming's collection: every occurrence already materialised (with its status) and,
 * while the rule is active, the live-computed preview of the dates it will next fire on. Previews
 * are labelled as previews - a preview is not a promise the generator has already kept. An ended
 * rule shows no preview, only its kept history and the nothing-upcoming notice.
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
  ));

/** The upcoming-occurrences list card the active and ended states render below the rule summary. */
export const UpcomingList = (props: UpcomingListProps) => {
  const upcoming = props.upcoming;
  const previewDates = props.isEnded ? [] : (upcoming?.previewDates ?? []);
  return (
    <SurfaceListCard label="Upcoming occurrences">
      {materialisedRows(upcoming?.materialised ?? [])}
      {previewDates.map(date => (
        <StaticStateRow
          key={`preview-${date}`}
          item={{ id: `preview-${date}`, label: date, description: 'Preview - not yet materialised' }}
        />
      ))}
      {props.isEnded ? (
        <EmptyNotice
          message="Nothing upcoming"
          description="This rule has ended, so it will not create new occurrences; the rows above are kept."
        />
      ) : null}
    </SurfaceListCard>
  );
};
