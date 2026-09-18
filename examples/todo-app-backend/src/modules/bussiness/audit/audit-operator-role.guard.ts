import { Injectable } from '@nestjs/common';
import { AbstractException } from '../../shared/exceptions/errors/abstract';

/**
 * gap.audit.operator-role names this gap precisely: the example has no operator/admin role -
 * data.login.person has no role field and the session seam (contract.login.identity-for-task,
 * sds.login.session-store) resolves only personId, never a role claim. This exception is the honest
 * half of that gap: the wider, filtered operator read of fr.audit.log.read is refused with a stable
 * code rather than implemented by inventing a role no accepted record authorizes, or by silently
 * granting every caller operator powers.
 */
export class AuditOperatorRoleNotAuthorizedException extends AbstractException {
  constructor(metadata: Record<string, unknown> = {}) {
    super(
      'This example has no operator role: the audit log can only be read as one\'s own lines.',
      'AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED',
      metadata,
    );
  }
}
