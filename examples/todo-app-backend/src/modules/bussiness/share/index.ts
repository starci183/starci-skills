export { ShareModule } from './share.module';
export { InvitationService } from './invitation.service';
export { AccessService } from './access.service';
export type { AccessDecision, AccessSubjectTask } from './access.service';
export { CollaboratorCache } from './collaborator-cache';
export type { CollaboratorLookup } from './collaborator-cache';
export { ShareCompletionAuthority, ShareCompletionAuthoritySetup } from './completion-authority';
export { InvitationRecord } from './types/invitation-record';
export type { ShareRole, ShareInvitationStatus } from './types/invitation-record';
export {
  ShareInvitationNotFoundException,
  ShareInvalidEmailException,
  ShareInvalidRoleException,
  ShareInvitationAlreadyExistsException,
  ShareEmailMismatchException,
  ShareInvitationExpiredException,
  ShareInvitationRevokedException,
  ShareInvitationAlreadyClosedException,
  ShareForbiddenException,
} from '@modules/shared/exceptions';
export { InviteCommand } from './invite.command';
export type { InviteCommandParams, InviteCommandResult } from './invite.command';
export { InviteHandler } from './invite.handler';
export { AcceptInvitationCommand } from './accept-invitation.command';
export type { AcceptInvitationCommandParams, AcceptInvitationCommandResult } from './accept-invitation.command';
export { AcceptInvitationHandler } from './accept-invitation.handler';
export { RevokeCollaboratorCommand } from './revoke-collaborator.command';
export type { RevokeCollaboratorCommandParams, RevokeCollaboratorCommandResult } from './revoke-collaborator.command';
export { RevokeCollaboratorHandler } from './revoke-collaborator.handler';
export { ListCollaboratorsQuery } from './list-collaborators.query';
export type { CollaboratorSummaryResult, ListCollaboratorsQueryParams, ListCollaboratorsQueryResult } from './list-collaborators.query';
export { ListCollaboratorsHandler } from './list-collaborators.handler';
