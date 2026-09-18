import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

export type ErasureRequestForbiddenExceptionMetadata = AbstractExceptionMetadata;

/**
 * sds.audit.erasure-request's t-verify guard: the requester must be proven to be the request's own
 * subject. This example has no operator role yet (gap.audit.operator-role), so the only identity ever
 * proven is the caller's own signed-in session; a mismatch refuses via t-refuse rather than executing.
 */
export class ErasureRequestForbiddenException extends AbstractException {
  constructor(metadata: ErasureRequestForbiddenExceptionMetadata = {}) {
    super('This erasure request does not belong to the caller.', 'ERASURE_REQUEST_FORBIDDEN', metadata);
  }
}
