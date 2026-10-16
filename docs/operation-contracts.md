Owner: knowledge/hfs/rules.yaml

# Typed operation contracts

## R95: closed operations and matching routes

`BE_OPERATION_CONTRACT` rejects a versioned operation whose input or output is
undecidable, including `any`, `unknown` and records of unknown values. Declare
closed input and output types and a closed union of refusal strings in the
`defineOperations` table. Its HTTP route must accept `OperationRequest<Table>`
and return `Promise<OperationReply<Table>>` for that same table. These requirements
apply to both lite and full applications.
