import { SessionEntity } from "./persistence/entities/session.entity"
import { CreateSessionsTable1758160000000 } from "./persistence/migrations/1758160000000-create-sessions-table"

/** The entities of the session capability, for the connection that holds them. */
export const identityEntities = [SessionEntity]

/** The migrations of the session capability, in the order they run. */
export const identityMigrations = [CreateSessionsTable1758160000000]

export { AuthGuard } from "./auth.guard"
export { isPlausibleEmail } from "./email.policy"
export { IDENTITY_ERROR_KINDS, IdentityError, IdentityErrorCode } from "./errors/identity.error"
export { IDENTITY_MESSAGES } from "./messages/identity.messages"
export { parseIdentityConfig } from "./identity.config"
export { PublicReason } from "./identity.contracts"
export type { IdentityOptions } from "./identity.options"
export type { SessionView } from "./identity.contracts"
export { CurrentPrincipal, Public, Roles } from "./identity.decorators"
export { IdentityModule } from "./identity.module"
export { SessionService } from "./session.service"
