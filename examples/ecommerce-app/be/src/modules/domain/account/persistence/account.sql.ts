import { sql } from "@modules/platform/database"

/** Registers a person unless the email is taken ($1 email, $2 password hash); answers the new id, or no row when the email exists. */
export const INSERT_PERSON_IF_NEW = sql`INSERT INTO persons (email, password_hash) VALUES ($1, $2)
    ON CONFLICT (email) DO NOTHING RETURNING id`
