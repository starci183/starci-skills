// proves: BE_ENTITY_IN_CONTRACT@lite
// proves: BE_ENTITY_IN_CONTRACT@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { rules } from "./schema-authority.mjs"

const CONTRACTS = at("src/modules/domain/order/order.contracts.ts")
const ENTITY_FILE = at("src/modules/domain/order/persistence/entities/contract-row.entity.ts")
const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const RESOLVER = at("src/features/api/checkout/transport/graphql/get-order.resolver.ts")
const ENTITY_IMPORT = 'import { OrderEntity } from "@modules/domain/order/persistence/entities/order.entity"\n'

for (const edition of ["lite", "full"]) {
    test(`R37 contracts accept plain projections and reject ORM entities in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-entity-in-contract", rules["no-entity-in-contract"], {
            valid: [
                { filename: CONTRACTS, code: "export interface OrderSummary { id: string }" },
                { filename: CONTRACTS, code: "export interface UserEntity { id: string }; export interface Result { user: UserEntity }" },
                { filename: HANDLER, code: "class Handler { async execute(id: string): Promise<{ id: string }> { return { id } } }" },
                { filename: RESOLVER, code: "class Resolver { get(id: string): { id: string } { return { id } } }" },
                { filename: ENTITY_FILE, code: 'import { Entity } from "typeorm"; @Entity("orders") export class OrderEntity { id = "" }' },
            ],
            invalid: [
                { filename: CONTRACTS, code: ENTITY_IMPORT + "export interface Result { order: OrderEntity }", errors: [{ messageId: "entity" }] },
                { filename: CONTRACTS, code: ENTITY_IMPORT + "export interface Result { orders: Array<OrderEntity> }", errors: [{ messageId: "entity" }] },
                { filename: CONTRACTS, code: ENTITY_IMPORT + "export type Result = OrderEntity | null", errors: [{ messageId: "entity" }] },
                { filename: HANDLER, code: ENTITY_IMPORT + "class Handler { async execute(id: string): Promise<OrderEntity> { return new OrderEntity() } }", errors: [{ messageId: "entity" }] },
                { filename: RESOLVER, code: ENTITY_IMPORT + "class Resolver { get(): Promise<OrderEntity> { return Promise.resolve(new OrderEntity()) } }", errors: [{ messageId: "entity" }] },
                { filename: ENTITY_FILE, code: 'import { Field } from "@nestjs/graphql"; export class Row {}', errors: [{ messageId: "entityImport" }] },
                { filename: ENTITY_FILE, code: 'import { IsString } from "class-validator"; export class Row {}', errors: [{ messageId: "entityImport" }] },
            ],
        })
    })
}
