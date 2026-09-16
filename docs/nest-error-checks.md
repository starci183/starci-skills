# Nest transport error checks

`checks/code-patterns/nest-errors.mjs` is the read-only machine adapter for the
adopted cause-preservation and transport-mapping source forms. It runs with the
target repository's canonical architecture config and TypeScript projects. Its
result is only valid when the aggregate binds the exact production sources,
package declaration, compiler/configuration inputs and before/after snapshot.

## Target declaration

The target owns `package.json#starci.codePatterns.nest.transportErrors`:

```json
{
  "schema": "starci/nest-transport-error-contract@1",
  "errorTypes": [{
    "id": "application",
    "path": "src/modules/platform/errors/application-error.ts",
    "export": "ApplicationError",
    "codeProperty": "code",
    "messageProperty": "message",
    "causeProperties": ["cause", "originalError"]
  }],
  "transports": ["http"],
  "mappers": [{
    "id": "http",
    "kind": "nest-http-filter",
    "path": "src/modules/platform/errors/application-error.filter.ts",
    "export": "ApplicationErrorFilter",
    "method": "catch",
    "errorType": "application",
    "status": { "kind": "code-map", "path": "src/modules/platform/errors/http-status.ts", "export": "HTTP_STATUS_BY_ERROR_CODE", "fallback": 500 },
    "passthroughHostTypes": []
  }]
}
```

All paths and exports are exact identities. An error family does not need an
HTTP status member. A mapper may own status through an exported code map with
an explicit fallback. The legacy `error.httpStatus ?? 500` form is supported by
`status.kind: "error-property"` when the selected family intentionally owns it.

GraphQL is optional. A project that selects it declares one
`apollo-graphql` mapper with the owning class/method, `formatProperty`, wrapped
`originalErrorProperty`, and local `statusPlugin`. The formatter must map the
selected code and status with an explicit unknown-error fallback. The status
plugin must carry the same `extensions.http.status` value into the transport
response. The adapter never requires GraphQL for a project that does not expose
a resolved `GraphQLModule` boundary.

The adapter inventories resolved Nest `@Catch`/`ExceptionFilter` and installed
GraphQL module surfaces across every selected production source. A discovered
surface omitted from the declaration, a declaration with no discovered
surface, dynamic GraphQL configuration, a computed mapper identity or an
unresolved project binding is unavailable. An empty declaration cannot hide an
existing transport mapper.

## Machine rules

- `NEST_FOREIGN_ERROR_CAUSE` examines catch-owned escaping `throw` statements.
  Rethrowing the same caught identity is valid. Replacing it with a declared
  error family must carry the caught input through a declared cause property.
  Direct values, immutable aliases and the common
  `error instanceof Error ? error : new Error(String(error))` normalization are
  supported. Calls, mutable/ambiguous flow and nested-function replacement
  throws are unavailable rather than assumed safe. Recovery catches with no
  escaping throw are outside this syntax rule.
- `NEST_TRANSPORT_ERROR_MAPPER` checks real TypeScript/framework identities and
  value flow. A Nest HTTP filter resolves `@Catch`, `ExceptionFilter` and
  `ArgumentsHost`, derives one status with an explicit fallback, writes that
  status to the real HTTP response, maps the configured code/message, and
  rethrows the same error for declared passthrough hosts. An Apollo mapper binds
  its selected-error and unknown-error branches and connects extension status
  to transport status.

## Limits

Static structure does not prove that a mapper is registered in a running app,
that public messages and metadata are safely redacted, that retry semantics are
correct, or that a request receives the expected wire status. It does not
decide whether a caught failure should be recovered instead of thrown. Run the
selected unit/integration transport tests and review those semantic decisions.

The Academy `AbstractException`, HTTP filter, GraphQL response envelope and
Apollo status plugin are reference forms from one application. Their names,
GraphQL envelope and domain-owned `httpStatus` are not universal Nest rules.
