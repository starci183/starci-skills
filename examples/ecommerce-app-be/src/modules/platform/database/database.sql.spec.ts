import { ident, sql } from "./database.sql"
import { DatabaseError } from "./errors/database.error"

describe("sql", () => {
    it("joins the parts of a statement and substitutes checked identifiers", () => {
        const table = ident("persons", ["persons"])
        expect(sql`SELECT id FROM ${table} WHERE id = $1`).toBe("SELECT id FROM persons WHERE id = $1")
    })

    it("keeps a statement without substitutions as written", () => {
        expect(sql`SELECT 1`).toBe("SELECT 1")
    })
})

describe("ident", () => {
    it("brands a name on the allowed list", () => {
        expect(ident("created_at", ["created_at", "id"])).toBe("created_at")
    })

    it("refuses a name that is not allowed", () => {
        expect(() => ident("users", ["id"])).toThrow(DatabaseError)
    })

    it("refuses a name that is not a plain identifier even when listed", () => {
        expect(() => ident("id; --", ["id; --"])).toThrow(DatabaseError)
    })
})
