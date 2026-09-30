import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { InboxClaimEntity } from "./entities/inbox-claim.entity"
import { CreateInboxClaims1758400000001 } from "./migrations/1758400000001-create-inbox-claims"

/** The connection that holds the tables of the inbox capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the inbox capability, for the connection that holds them. */
export const inboxEntities = [InboxClaimEntity]

/** The migrations of the inbox capability, in the order they run. */
export const inboxMigrations = [CreateInboxClaims1758400000001]
