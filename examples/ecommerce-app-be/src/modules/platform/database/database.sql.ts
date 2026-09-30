import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"

declare const sqlTextBrand: unique symbol
declare const sqlIdentBrand: unique symbol

/** SQL text built by the `sql` tag: the only kind of string `EntityManager.query` accepts. */
export type SqlText = string & { readonly [sqlTextBrand]: true }

/** A checked identifier (table or column name): the only value a `sql` tag substitution accepts. */
export type SqlIdent = string & { readonly [sqlIdentBrand]: true }

/** The biggest page a client can ask for. */
export const PAGE_SIZE_MAX = 100

/** The biggest number of rows a server-side list read returns. */
export const LIST_ROWS_MAX = 500

/** The size of the keyset batches a background scan reads. */
export const BATCH_ROWS = 500

const IDENT_PATTERN = /^[a-z_][a-z0-9_]*$/

function assertSqlText(value: string): asserts value is SqlText {
    // The brand is compile-time only; the `sql` tag is the single caller.
}

function assertSqlIdent(value: string): asserts value is SqlIdent {
    // The brand is compile-time only; `ident` is the single caller, after it checked the name.
}

/**
 * Builds SQL text. Values are `$n` parameters written in the text; the only substitutions are `SqlIdent` values, so a
 * value can never be concatenated into a statement.
 */
export const sql = (strings: TemplateStringsArray, ...identifiers: ReadonlyArray<SqlIdent>): SqlText => {
    const text = strings.reduce((built, part, index) => `${built}${part}${identifiers[index] ?? ""}`, "")
    assertSqlText(text)
    return text
}

/** Checks a dynamic identifier against the names the caller allows and brands it; anything else is refused. */
export const ident = (name: string, allowed: ReadonlyArray<string>): SqlIdent => {
    if (!IDENT_PATTERN.test(name) || !allowed.includes(name)) {
        throw new DatabaseError({ code: DatabaseErrorCode.IdentifierRejected })
    }
    assertSqlIdent(name)
    return name
}

/** The health ping: a statement that answers while the connection is alive. */
export const PING = sql`SELECT 1`
