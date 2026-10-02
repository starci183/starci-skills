import { readFileSync } from "node:fs"
import { join } from "node:path"
import { buildSchema, parse, validate } from "graphql"
import { ECOMMERCE_OPERATIONS } from "../../world/ecommerce-operations.contracts"

const schema = buildSchema(readFileSync(join(__dirname, "../../../../contracts/order/schema.graphql"), "utf8"))

describe("order GraphQL contract", () => {
    it("accepts the buyerStatus document the identity service sends", () => {
        expect(validate(schema, parse(ECOMMERCE_OPERATIONS.buyerStatus))).toEqual([])
    })

    it("rejects a document that asks for a field the published schema does not have", () => {
        expect(validate(schema, parse("query { noSuchField }"))).not.toEqual([])
    })
})
