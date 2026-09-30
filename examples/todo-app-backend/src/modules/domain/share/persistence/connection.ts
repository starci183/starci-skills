import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { InvitationEntity } from "./entities/invitation.entity"
import { CreateInvitationsTable1758160000002 } from "./migrations/1758160000002-create-invitations-table"

/** The connection that holds the tables of the share capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the share capability, for the connection that holds them. */
export const shareEntities = [InvitationEntity]

/** The migrations of the share capability, in the order they run. */
export const shareMigrations = [CreateInvitationsTable1758160000002]
