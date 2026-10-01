/** The row the acquire statement returns. */
export interface AcquiredLeaseRow {
    /** The fencing token; the driver returns bigint columns as text. */
    fence: string
}

/** The fencing token of an acquired row, as a number. */
export const toFence = (row: AcquiredLeaseRow): number => Number(row.fence)
