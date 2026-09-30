import { InvitationEntity } from "./persistence/entities/invitation.entity"
import { CreateInvitationsTable1758160000002 } from "./persistence/migrations/1758160000002-create-invitations-table"

/** The entities of the share capability, for the connection that holds them. */
export const shareEntities = [InvitationEntity]

/** The migrations of the share capability, in the order they run. */
export const shareMigrations = [CreateInvitationsTable1758160000002]

export { AccessService } from "./access.service"
export { SHARE_ERROR_KINDS, ShareError, ShareErrorCode } from "./errors/share.error"
export { InvitationService } from "./invitation.service"
export { SHARE_MESSAGES } from "./messages/share.messages"
export type { InvitationView } from "./share.contracts"
export { ShareModule } from "./share.module"
