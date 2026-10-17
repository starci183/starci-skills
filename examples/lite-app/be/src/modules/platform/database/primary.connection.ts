import { getDataSourceToken } from "@nestjs/typeorm"

/** The logical name of the primary database connection, as declared in `hfs.json`. */
export const PRIMARY_CONNECTION = "primary"

/** The Nest token of the named primary DataSource. */
export const PRIMARY_DATA_SOURCE = getDataSourceToken(PRIMARY_CONNECTION)
