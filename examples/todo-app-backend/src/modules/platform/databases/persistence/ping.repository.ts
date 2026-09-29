import type {
    Pool 
} from "pg"

/** Asks the primary database whether it answers: the row count of `SELECT 1`, which is 1 when it does. */
export const pingPrimary = async (pool: Pool): Promise<number | null> => {
    const result = await pool.query("SELECT 1")
    return result.rowCount
}
