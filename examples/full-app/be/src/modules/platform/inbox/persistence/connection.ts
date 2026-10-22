import { InboxClaimEntity } from "./entities/inbox-claim.entity"
import { CreateInboxClaims1789800005000 } from "./migrations/1789800005000-create-inbox-claims"

/** The entities of the inbox capability, for the connection that holds them. */
export const inboxEntities = [InboxClaimEntity]

/** The migrations of the inbox capability, in the order they run. */
export const inboxMigrations = [CreateInboxClaims1789800005000]
