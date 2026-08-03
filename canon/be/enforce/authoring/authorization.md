# Authorization — a guard on every mutation, the owner in the query

Source: a scan of `src/features/api/core/graphql/mutations/**/*.resolver.ts` on 2026-08-04 — 253
resolver files carry `@UseGuards`. Authentication and authorization are two questions asked in that
order, and this file is about where each answer is written down. The design reasoning — why identity
and domain are different questions, why an ownership claim baked into a token cannot say *owner of
what* — is [[auth-and-authz]] on the explore shelf; what follows is the spelled rule the code is
held to.

## 1. Every mutation resolver method carries an authz guard

A GraphQL `@Mutation` — and every `@Query` that returns something owned — names its guard with
`@UseGuards`, and the first guard is always the identity gate, `KeycloakAuthGraphQLGuard`, because a
mutation with no authenticated caller is a hole whatever the service does downstream:

```ts
// real example, purchase-ai-subscription.resolver.ts
@UseGuards(KeycloakAuthGraphQLGuard)
@Mutation(() => PurchaseAiSubscriptionResponse)
async purchaseAiSubscription(...) { ... }
```

A method decorated `@Mutation` with no `@UseGuards` above it is the finding — and it is one a script
can settle, because the decorator is either on the method or it is not. The public read that is
deliberately open — a landing query, a public profile — is the exception that has to *say so*: it is
the one place a missing guard is a decision, so it carries a one-line comment naming why, rather than
reading to the next reader as an oversight.

## 2. The domain check is a guard too, not an `if` in the resolver

Identity is not authorization. "May THIS caller enroll, see this profile, grade this submission" is a
second question, and this codebase answers it with a second guard from
`src/modules/bussiness/guards/` — `GraphqlEnrollmentGuard`, `GraphqlMustEnrolledGuard`,
`GraphqlProfileVisibilityGuard`, `GraphqlAdminAccessGuard` — stacked after the identity one, never
re-derived inline:

```ts
@UseGuards(KeycloakAuthGraphQLGuard, GraphqlMustEnrolledGuard)
```

A domain rule expressed as an `if` at the top of the handler is the same rule with no name and no
reuse: the next handler that needs it copies it, and the copy is where the two drift.

## 3. Ownership lives in the query, never re-checked after the fetch

Past both guards, a handler that loads a row by id alone and then compares `row.userId === caller.id`
in an `if` has already fetched data the caller may not own, and that check is one refactor from being
dropped. The predicate belongs in the query — `where: { id, userId: caller.id }` — so a row the
caller does not own never leaves the database. A *list* endpoint scopes by owner; a *by-id* endpoint
carries the owner in its `where`. An RPC or resolver that takes an id but forgets the owner is an
IDOR — the class of bug the teacher's own notes catalogue recurring across services, where the "list"
path was scoped and the "by-id" path beside it was not.

Gated: the `@Mutation`-without-`@UseGuards` case in §1 a folder-shape check can assert. The §3
ownership predicate is judgment — a query can carry a `where` that looks scoped and still leak the
wrong owner's row — so it is read, not linted; [[auth-and-authz]] is where that reading is done.
