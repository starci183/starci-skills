# Concept — GraphQL resolver pattern (Apollo Server 5, code-first)

Source: `src/features/api/core/graphql/`, `src/modules/api/apollo/`.

Every operation under `src/features/api/core/graphql/{queries,mutations}/` is its own **leaf module**:
five files — the module, the module-definition, the resolver, `graphql-types/`
(`response.ts` plus `inputs/`), and `index.ts`.

## The three-piece naming, strictly

The leaf module is `<X>SingleQueryModule` or `<X>SingleMutationModule`. The parent imports it as
`.register({ isGlobal: true })` — never by importing the resolver directly, because the schema
builder then misses the operation and it simply is not in the schema. The aggregator that collects
several leaves is `<Resource>QueriesModule` or `<Resource>MutationsModule`.

## The resolver

The method is named `execute`. The decorator stack is fixed, in this order:

```
@UseThrottler(...)
@UseGuards(KeycloakAuthGraphQLGuard)
@GraphQLSuccessMessage({ en, vi })
@UseInterceptors(GraphQLTransformInterceptor)
@Query / @Mutation
```

The authenticated user comes in through `@KeycloakGraphQLUser() user: UserEntity` (see
[`auth-keycloak-session.md`](auth-keycloak-session.md)).

The resolver returns the **real entity** — `XxxResponseData`. The interceptor wraps it into
`{ success, message, error, data }`; see
[`envelope-response-shape.md`](envelope-response-shape.md).

## Enums and entities

The TypeScript enum value lives in `@modules/databases`, and its GraphQL companion is built with
`createEnumType`. The value — usually lowercase — must match what the front end sends.

An entity is both the database table and an `@ObjectType`. GraphQL serialises only fields carrying
`@Field`, which makes `@Field` a security gate rather than a formality: see the expose section of
[`typeorm-entities-and-relations.md`](typeorm-entities-and-relations.md).
