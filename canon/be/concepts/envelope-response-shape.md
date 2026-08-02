# Concept — Envelope response shape (GraphQL and REST)

Source: `src/modules/api/apollo/server/graphql-types/object-types/graphql-response.ts`,
`src/modules/api/apollo/server/types/graphql-response.ts`.

Every GraphQL operation returns an `AbstractGraphQLResponse`. A resolver returns the real entity and
nothing else; `GraphQLTransformInterceptor` is what wraps it. A resolver's `execute` never builds the
envelope by hand — two places building the same wrapper is how the two shapes drift apart.

## The shape the front end receives

`{ success, message, error, data }`, with the real entity at `.data.<field>.data` — double nesting,
because the response wrapper and the field's own ObjectType are separate levels.

`@GraphQLSuccessMessage({ [Locale.En]: ..., [Locale.Vi]: ... })` sets the message on success, in both
languages; it is part of the fixed decorator stack in
[`graphql-resolver-pattern.md`](graphql-resolver-pattern.md).

The `data` field of a response class is its own `@ObjectType` and
`implements IAbstractGraphQLResponse<XxxResponseData>`.

REST has an equivalent wrapper helper under `src/modules/api/rest/` for controllers that want the
same shape. It is available, not mandatory for every controller.

## Why the front end has to change in the same breath

The FE reads through `GraphQLResponse<T>` in `modules/api/graphql/<op>.ts` and pulls the entity from
`.data.<field>.data`. When the two sides disagree about the shape, TypeScript sees nothing: the
result is a silent `undefined` at runtime, not a type error. Change the field or the entity on one
side and the other side moves with it.
