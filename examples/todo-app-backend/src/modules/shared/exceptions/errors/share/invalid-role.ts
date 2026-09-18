import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an invite submitted with a role other than viewer or editor. */
export interface ShareInvalidRoleExceptionMetadata extends AbstractExceptionMetadata {
  /** The role that was submitted. */
  role?: string;
}

/** br.share.role.permissions: a collaborator is a viewer or an editor, never anything else.
 * fr.share.invite exceptionFlows: "A role other than viewer or editor is refused and nothing is created." */
export class ShareInvalidRoleException extends AbstractException {
  constructor({ role, ...metadata }: ShareInvalidRoleExceptionMetadata = {}) {
    super('The role must be viewer or editor.', 'SHARE_INVALID_ROLE', { role, ...metadata });
  }
}
