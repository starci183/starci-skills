import type { SignInMutation, SignInMutationVariables } from "../../__generated__/graphql"

/** The opaque session bearer and the person it authenticates. */
export type MutationSignInResponse = SignInMutation["signIn"]

/** The input of `signIn`. */
export type MutationSignInRequest = SignInMutationVariables["input"]
