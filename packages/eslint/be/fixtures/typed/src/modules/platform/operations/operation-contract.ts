/** Whether an operation reads or changes state. */
export type OperationKind = "query" | "mutation"

/**
 * One versioned operation of an app: what it takes, what a success carries and which refusals it can answer.
 * `Input` and `Output` are named, closed types; `RefusalCode` is a closed union of string literals. The `types` member is a
 * phantom: it carries the three types to the contract emit and is never read at run time.
 */
export interface OperationContract<Input, Output, RefusalCode extends string, Kind extends OperationKind = OperationKind> {
    /** Whether the operation is a query or a mutation. */
    readonly kind: Kind
    /** The declared types, for the type checker only. */
    readonly types?: {
        /** What the caller sends. */
        readonly input: Input
        /** What a success carries. */
        readonly output: Output
        /** The refusals the operation can answer. */
        readonly refusal: RefusalCode
    }
}

/**
 * Declares a query: an operation that changes nothing.
 *
 * @returns The contract entry of the app's operation table.
 */
export const query = <Input, Output, RefusalCode extends string = never>(): OperationContract<Input, Output, RefusalCode, "query"> => ({ kind: "query" })

/**
 * Declares a mutation: an operation that changes state.
 *
 * @returns The contract entry of the app's operation table.
 */
export const mutation = <Input, Output, RefusalCode extends string = never>(): OperationContract<Input, Output, RefusalCode, "mutation"> => ({ kind: "mutation" })

/** The key of an operation: `<name>@<version>`, for example `sales.policy@1`. */
export type OperationId = `${string}@${number}`

/** The shape of an app's operation table. */
export type OperationTable = Readonly<Record<OperationId, OperationContract<unknown, unknown, string>>>

/**
 * Registers the operations of an app; `apps/<app>/src/operations.ts` exports the result as `OPERATIONS`.
 *
 * @param table - Every versioned operation the app serves, by `<name>@<version>`.
 * @returns The same table, typed.
 */
export const defineOperations = <Table extends OperationTable>(table: Table): Table => table

/** The input type of one contract. */
export type OperationInputOf<Contract> = Contract extends OperationContract<infer Input, unknown, string, OperationKind> ? Input : never

/** The output type of one contract. */
export type OperationOutputOf<Contract> = Contract extends OperationContract<unknown, infer Output, string> ? Output : never

/** The refusal codes of one contract. */
export type OperationRefusalOf<Contract> = Contract extends OperationContract<unknown, unknown, infer Code> ? Code : never

/** The two answers of an operation: a success value or a declared refusal. */
export type OperationOutcome<Value, Code extends string> =
    | { readonly kind: "ok"; readonly value: Value }
    | { readonly kind: "refused"; readonly code: Code; readonly params?: Readonly<Record<string, string | number | boolean>> }

/** The body of the app's operation route: one variant per registered operation. */
export type OperationRequest<Table extends OperationTable> = {
    [Id in keyof Table & string]: { readonly operation: Id; readonly requestId: string; readonly input: OperationInputOf<Table[Id]> }
}[keyof Table & string]

/** The answer of the app's operation route: one variant per registered operation. */
export type OperationReply<Table extends OperationTable> = {
    [Id in keyof Table & string]: {
        readonly operation: Id
        readonly requestId: string
        readonly outcome: OperationOutcome<OperationOutputOf<Table[Id]>, OperationRefusalOf<Table[Id]>>
    }
}[keyof Table & string]
