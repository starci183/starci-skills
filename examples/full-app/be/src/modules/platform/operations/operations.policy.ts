import type { OperationContract, OperationTable } from "./operations.contracts"

/**
 * Declares a query: an operation that changes nothing.
 *
 * @returns The contract entry of the app's operation table.
 */
export const query = <Input, Output, RefusalCode extends string = never>(): OperationContract<
    Input,
    Output,
    RefusalCode,
    "query"
> => ({ kind: "query" })

/**
 * Declares a mutation: an operation that changes state.
 *
 * @returns The contract entry of the app's operation table.
 */
export const mutation = <Input, Output, RefusalCode extends string = never>(): OperationContract<
    Input,
    Output,
    RefusalCode,
    "mutation"
> => ({ kind: "mutation" })

/**
 * Registers the operations of an app; `apps/<app>/src/operations.ts` exports the result as `OPERATIONS`.
 *
 * @param table - Every versioned operation the app serves, by `<name>@<version>`.
 * @returns The same table, typed.
 */
export const defineOperations = <Table extends OperationTable>(table: Table): Table => table
