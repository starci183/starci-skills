import { InboxClaimEntity } from "./persistence/entities/inbox-claim.entity"
import { CreateInboxClaims1758400000001 } from "./persistence/migrations/1758400000001-create-inbox-claims"

/** The entities of the inbox capability, for the connection that holds them. */
export const inboxEntities = [InboxClaimEntity]

/** The migrations of the inbox capability, in the order they run. */
export const inboxMigrations = [CreateInboxClaims1758400000001]

export { InjectInbox } from "./inbox.decorators"
export { InboxModule } from "./inbox.module"
export type { Inbox } from "./inbox.port"
