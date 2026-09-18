/** data.audit.erasure-request as this module's own read shape. `personId` is surfaced only while it is
 * still present on the row - see AuditErasureService.tComplete for where it is dropped. */
export class AuditErasureRequestRecord {
  constructor(
    readonly requestId: string,
    readonly personId: string | null,
    readonly state: 'requested' | 'verified' | 'executing' | 'complete' | 'refused',
    readonly requestedAt: Date,
    readonly verifiedAt: Date | null,
    readonly refusedAt: Date | null,
    readonly executingAt: Date | null,
    readonly completedAt: Date | null,
  ) {}
}
