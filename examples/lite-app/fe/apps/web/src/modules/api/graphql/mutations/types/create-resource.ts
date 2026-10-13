import type { CreateResourceMutation, CreateResourceMutationVariables } from "../../__generated__/graphql"

/** What mutateCreateResource takes: the variables of the `createResource` mutation (none: the caller owns the row). */
export type MutateCreateResourceRequest = CreateResourceMutationVariables

/** What mutateCreateResource answers: the `createResource` field. */
export type MutateCreateResourceData = CreateResourceMutation["createResource"]
