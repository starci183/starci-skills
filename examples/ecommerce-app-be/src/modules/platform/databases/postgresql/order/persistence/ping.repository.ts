import type {
    DataSource 
} from "typeorm"

/** Asks the database whether it answers; the query fails, and so does the probe, when the connection is dead. */
export const pingDatabase = async (dataSource: DataSource): Promise<void> => {
    await dataSource.query("select 1")
}
