export interface ExportMyDataQueryParams {
  readonly personId: string;
}

export interface ExportedLineResult {
  readonly at: Date;
  readonly action: string;
  readonly target: string | null;
}

export interface ExportMyDataQueryResult {
  readonly lines: ExportedLineResult[];
}

/**
 * fr.audit.export's CQRS read. exceptionFlow: once the person's key has been destroyed by a completed
 * erasure, this returns an empty list - the same keyId lookup a completed erasure removes is the one
 * this read depends on, so the two agree by construction rather than by a separate check.
 */
export class ExportMyDataQuery {
  constructor(readonly params: ExportMyDataQueryParams) {}
}
