/** The row SUM_PERSON_POINTS answers. */
export interface PointsRow {
    /** The points the person earned in total. */
    points: number
}

/** The total of the points row (no row counts as zero). */
export const toPoints = (rows: ReadonlyArray<PointsRow>): number => rows[0]?.points ?? 0
