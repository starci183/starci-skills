Owner: knowledge/hfs/rules.yaml

# Typed operation contracts

## R95: closed operations and matching routes

`BE_OPERATION_CONTRACT` rejects a versioned operation whose input or output is
undecidable, including `any`, `unknown` and records of unknown values. Declare
closed input and output types and a closed union of refusal strings in the
`defineOperations` table. Its HTTP route must accept `OperationRequest<Table>`
and return `Promise<OperationReply<Table>>` for that same table. These requirements
apply to both lite and full applications.

A feature cannot import an app and a feature's contracts hold no call, so the table is declared by the domain
capability that owns the operations and `apps/<app>/src/operations.ts` exports it as `OPERATIONS`. The body of the route is typed by an alias, which leaves
no class for the global validation pipe, so the route binds it with
`@Body(new OperationValidationService(RequestClass))` of `platform/http-security`; the request class mirrors the
envelope and its input bounds, and `BE_OPERATION_CONTRACT` refuses a body no such pipe validates.
