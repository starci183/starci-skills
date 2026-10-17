import { Test } from "@nestjs/testing"
import { buildSchema, parse, validate } from "graphql"
import { depthLimitRule } from "./graphql-depth.policy"

const schema = buildSchema(`
    type Query {
        item: Item
    }

    type Item {
        value: String
        child: Item
    }
`)

const validateDepth = async (source: string, maxDepth = 2) => {
    const subject = await buildSubject()
    return validate(schema, parse(source), [subject(maxDepth)])
}

const SUBJECT: unique symbol = Symbol("graphql.depth")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => depthLimitRule }],
    }).compile()
    return moduleRef.get<typeof depthLimitRule>(SUBJECT)
}

describe("depthLimitRule", () => {
    it("accepts an operation nested exactly to the depth limit", async () => {
        const errors = await validateDepth(`
            query {
                item {
                    value
                }
            }
        `)

        expect(errors).toEqual([])
    })

    it("rejects the first selection set deeper than the limit", async () => {
        const errors = await validateDepth(`
            query {
                item {
                    child {
                        value
                    }
                }
            }
        `)

        expect(errors.map((error) => error.message)).toEqual(["Selection depth exceeds 2."])
    })
})
