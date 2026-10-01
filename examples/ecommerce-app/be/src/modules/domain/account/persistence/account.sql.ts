import { sql } from "@modules/platform/database"

/** Inserts the person the identity provider vouches for; a person already known (by subject or email) is left as it is. */
export const INSERT_PERSON_IF_NEW = sql`INSERT INTO persons (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`
