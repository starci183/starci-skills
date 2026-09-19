/** Contract naming the export my data query params shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface ExportMyDataQueryParams {
  readonly personId: string;
}

/** Contract naming the exported line result shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface ExportedLineResult {
  readonly at: Date;
  readonly action: string;
  readonly target: string | null;
}

/** Contract naming the export my data query result shape bussiness/audit code and its consumers share; a second site never retypes it inline. */
export interface ExportMyDataQueryResult {
  readonly lines: Array<ExportedLineResult>;
}

/**
 * fr.audit.export's CQRS read. exceptionFlow: once the person's key has been destroyed by a completed
 * erasure, this returns an empty list - the same keyId lookup a completed erasure removes is the one
 * this read depends on, so the two agree by construction rather than by a separate check.
 */
export class ExportMyDataQuery {
    constructor(readonly params: ExportMyDataQueryParams) {}
}
