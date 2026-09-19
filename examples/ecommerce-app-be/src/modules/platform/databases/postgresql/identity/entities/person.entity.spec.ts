import {
    getMetadataArgsStorage 
} from "typeorm"
import {
    PersonEntity 
} from "./person.entity"

/**
 * Entity registration is decorator metadata, so the spec asserts on typeorm's metadata-args
 * storage - the same source TypeORM's DataSource builder reads at boot - rather than instantiating
 * a connection.
 */
describe("PersonEntity - identity_person table metadata",
    () => {
        const storage = getMetadataArgsStorage()
        const columns = storage.columns.filter((c) => c.target === PersonEntity)
        const column = (property: string) => columns.find((c) => c.propertyName === property)

        it("maps the class to the identity_person table",
            () => {
                const table = storage.tables.find((t) => t.target === PersonEntity)
                expect(table?.name).toBe("identity_person")
            })

        it("generates uuid primary keys",
            () => {
                expect(column("id")?.options.primary).toBe(true)
                const generated = storage.generations.find(
                    (g) => g.target === PersonEntity && g.propertyName === "id",
                )
                expect(generated?.strategy).toBe("uuid")
            })

        it("declares email as a unique text column",
            () => {
                expect(column("email")?.options).toMatchObject({
                    type: "text", unique: true 
                })
            })

        it("stores the password hash and creation timestamp under snake_case columns",
            () => {
                expect(column("passwordHash")?.options).toMatchObject({
                    type: "text", name: "password_hash" 
                })
                const createdAt = column("createdAt")?.options
                expect(createdAt).toMatchObject({
                    type: "timestamptz", name: "created_at" 
                })
                expect(typeof createdAt?.default).toBe("function")
            })
    })
