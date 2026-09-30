/** Token of the database health probe; an app lists it in the health options of the capabilities it wants probed. */
export const DATABASE_PROBE: unique symbol = Symbol("platform.database.probe")
