import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"

declare const sqlTextBrand: unique symbol
declare const sqlIdentBrand: unique symbol

/** SQL text built by the `sql` tag: the only kind of string `EntityManager.query` accepts. */
export type SqlText = string & { readonly [sqlTextBrand]: true }

/** A checked identifier: the only value a `sql` tag substitution accepts. */
export type SqlIdent = string & { readonly [sqlIdentBrand]: true }

/** The biggest page a client can ask for. */
export const PAGE_SIZE_MAX = 100
/** The biggest number of rows a server-side list read returns. */
export const LIST_ROWS_MAX = 500
/** The size of the keyset batches a background scan reads. */
export const BATCH_ROWS = 500

const IDENT_PATTERN = /^[a-z_][a-z0-9_]*$/

function assertSqlText(_value: string): asserts _value is SqlText {
    // The brand is compile-time only; the `sql` tag is its single caller.
}

function assertSqlIdent(_value: string): asserts _value is SqlIdent {
    // The brand is compile-time only; `ident` is the single caller after checking the name.
}

/** Builds SQL text whose only substitutions are already checked identifiers. */
{{> be/common/sql-tag.ts.partial}}

/** Checks a dynamic identifier against the names the caller allows and brands it. */
{{> be/common/sql-ident.ts.partial}}
