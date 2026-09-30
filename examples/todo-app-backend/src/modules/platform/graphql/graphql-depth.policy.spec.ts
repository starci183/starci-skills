import { buildSchema, parse, validate } from "graphql"
import { depthLimitRule } from "./graphql-depth.policy"

const schema = buildSchema("type Query { a: A } type A { b: B, id: ID } type B { c: C, id: ID } type C { id: ID }")

const messagesFor = (query: string, maxDepth: number): Array<string> =>
    validate(schema, parse(query), [depthLimitRule(maxDepth)]).map((error) => error.message)

describe("depthLimitRule", () => {
    it("accepts an operation within the limit", () => {
        expect(messagesFor("{ a { b { id } } }", 3)).toEqual([])
    })

    it("refuses an operation nested deeper than the limit", () => {
        expect(messagesFor("{ a { b { c { id } } } }", 3)).toEqual(["Selection depth exceeds 3."])
    })
})
