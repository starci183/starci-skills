import { SessionEntity } from "./persistence/entities/session.entity"
import { CreateSessionsTable1758160000000 } from "./persistence/migrations/1758160000000-create-sessions-table"

/** The entities of the session capability, for the connection that holds them. */
export const sessionEntities = [SessionEntity]

/** The migrations of the session capability, in the order they run. */
export const sessionMigrations = [CreateSessionsTable1758160000000]

export { AuthGuard } from "./auth.guard"
export { isPlausibleEmail } from "./email.policy"
export { SESSION_ERROR_KINDS, SessionError, SessionErrorCode } from "./errors/session.error"
export { SESSION_MESSAGES } from "./messages/session.messages"
export { parseSessionConfig } from "./session.config"
export { PublicReason } from "./session.contracts"
export type { SessionOptions } from "./session.options"
export type { SessionView } from "./session.contracts"
export { CurrentPrincipal, Public, Roles } from "./session.decorators"
export { SessionModule } from "./session.module"
export { SessionService } from "./session.service"
