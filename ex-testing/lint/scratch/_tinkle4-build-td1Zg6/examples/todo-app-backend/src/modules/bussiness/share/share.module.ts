import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    TaskModule 
} from "../task/task.module"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./share.module-definition"
import {
    InvitationService 
} from "./invitation.service"
import {
    AccessService 
} from "./access.service"
import {
    CollaboratorCache 
} from "./collaborator-cache"
import {
    ShareCompletionAuthoritySetup 
} from "./completion-authority"
import {
    InviteHandler 
} from "./invite.handler"
import {
    AcceptInvitationHandler 
} from "./accept-invitation.handler"
import {
    RevokeCollaboratorHandler 
} from "./revoke-collaborator.handler"
import {
    ListCollaboratorsHandler 
} from "./list-collaborators.handler"

/**
 * The `share` capability module, under nivo's `modules/bussiness/<capability>` shape - see task.module.ts
 * and session.module.ts for the same pattern. Owns InvitationService/AccessService/CollaboratorCache and
 * every share CQRS command/query handler.
 *
 * Imports `TaskModule.register()` with the same (empty) options `app.module.ts` already registers it
 * with, so `ConfigurableModuleBuilder`'s own module-token hashing resolves both imports to the one shared
 * module instance instead of constructing a second, independent copy of TaskService/
 * CompletionAuthorityRegistry - this is the sanctioned seam (CompletionAuthorityRegistry.register), never
 * a direct import of task's TaskService or its command handlers. `ShareCompletionAuthoritySetup` performs
 * that registration from its own `onModuleInit`.
 *
 * No `TypeOrmModule.forFeature(...)` here, for the same reason as task/session: `InvitationService`
 * reaches `ShareInvitationEntity` through `@InjectPrimaryEntityManager()`, and `PostgresqlPrimaryModule`'s
 * `TypeOrmCoreModule` is already app-wide by the vendor's own design.
 */
@Module({
})
/** Nest module wiring the share capability's providers; the app composition root registers it - other modules never import it. */
export class ShareModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule,
                TaskModule.register()],
            providers: [
                ...(base.providers ?? []),
                InvitationService,
                AccessService,
                CollaboratorCache,
                ShareCompletionAuthoritySetup,
                InviteHandler,
                AcceptInvitationHandler,
                RevokeCollaboratorHandler,
                ListCollaboratorsHandler,
            ],
            exports: [InvitationService,
                AccessService],
        }
    }
}
