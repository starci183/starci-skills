/** Contract naming the list collaborators query params shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface ListCollaboratorsQueryParams {
  readonly actorId: string;
  readonly taskId: string;
}

/** Contract naming the collaborator summary result shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface CollaboratorSummaryResult {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

/** Contract naming the list collaborators query result shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface ListCollaboratorsQueryResult {
  readonly collaborators: Array<CollaboratorSummaryResult>;
}

/** fr.share.list as a CQRS read, dispatched by the GraphQL collaborators query resolver. */
export class ListCollaboratorsQuery {
    constructor(readonly params: ListCollaboratorsQueryParams) {}
}
