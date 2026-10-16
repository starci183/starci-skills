/** R83 proves every shipped data-access enforcer in each HFS edition. */
// proves: BE_UNNAMED_DATA_ACCESS@lite
// proves: BE_UNNAMED_DATA_ACCESS@full
import assert from "node:assert/strict"
import test from "node:test"
import {
    mustInjectEntityManager,
    namedEntityManagerOnly,
    noEagerRelation,
    noInjectedRepository,
    noOuterManagerInTransaction,
    requireEntityTableName,
} from "./data-access.mjs"
import { noRepositoryClass } from "./service-deps.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const REPOSITORY = at("src/modules/domain/order/persistence/order.repository.ts")
const ENTITY = at("src/modules/domain/order/persistence/entities/order.entity.ts")
const TYPEORM = 'import { EntityManager, DataSource, Repository } from "typeorm"; declare class OrderEntity {};\n'
const NAMED_MANAGER = TYPEORM + "class Service { constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {} }"
const WRAPPER = TYPEORM + "export class OrderStore { constructor(private readonly manager: EntityManager) {} }"

for (const edition of ["lite", "full"]) {
    test(`R83 accepts direct named data access and rejects every forbidden alternative in ${edition}`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)

        ruleTester({ root: TYPED_ROOT, hfs }).run("named-entity-manager-only", namedEntityManagerOnly, {
            valid: [{ filename: HANDLER, code: NAMED_MANAGER }],
            invalid: [
                { filename: HANDLER, code: TYPEORM + "class Service { @InjectPrimaryEntityManager() private readonly entityManager: EntityManager }", errors: [{ messageId: "property" }] },
                { filename: HANDLER, code: TYPEORM + "class Service { constructor(private readonly source: DataSource) {} }", errors: [{ messageId: "infra" }] },
                { filename: HANDLER, code: TYPEORM + "declare const manager: EntityManager; manager.getRepository(OrderEntity)", errors: [{ messageId: "getRepository" }] },
            ],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("no-injected-repository", noInjectedRepository, {
            valid: [{ filename: HANDLER, code: NAMED_MANAGER }],
            invalid: [
                { filename: HANDLER, code: TYPEORM + "class Service { constructor(private readonly repository: Repository<OrderEntity>) {} }", errors: [{ messageId: "repo" }] },
                { filename: HANDLER, code: 'import { TypeOrmModule } from "@nestjs/typeorm"; TypeOrmModule.forFeature([])', errors: [{ messageId: "forFeature" }] },
            ],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("must-inject-entity-manager", mustInjectEntityManager, {
            valid: [{ filename: HANDLER, code: NAMED_MANAGER }],
            invalid: [
                { filename: HANDLER, code: TYPEORM + "class Service { constructor(private readonly entityManager: EntityManager) {} }", errors: [{ messageId: "undecorated" }] },
                { filename: HANDLER, code: TYPEORM + "class Service { constructor(@InjectEntityManager() private readonly entityManager: EntityManager) {} }", errors: [{ messageId: "undecorated" }] },
            ],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("no-repository-class", noRepositoryClass, {
            valid: [{ filename: SERVICE, code: WRAPPER }],
            invalid: [
                { filename: REPOSITORY, code: WRAPPER, errors: [{ messageId: "repository" }] },
                { filename: at("src/modules/domain/order/persistence/order.statements.ts"), code: TYPEORM + 'export function load(manager: EntityManager) { return manager.query("select 1") }', errors: [{ messageId: "statements" }] },
            ],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("no-eager-relation", noEagerRelation, {
            valid: [{ filename: ENTITY, code: "class CartItemEntity { @ManyToOne(() => OrderEntity, { eager: false }) order: OrderEntity }" }],
            invalid: [{ filename: ENTITY, code: "class CartItemEntity { @ManyToOne(() => OrderEntity, { eager: true }) order: OrderEntity }", errors: [{ messageId: "eager" }] }],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("no-outer-manager-in-transaction", noOuterManagerInTransaction, {
            valid: [{ filename: HANDLER, code: TYPEORM + "declare const manager: EntityManager; await manager.transaction(async (tx) => { await tx.save(OrderEntity) })" }],
            invalid: [{ filename: HANDLER, code: TYPEORM + "declare const manager: EntityManager; await manager.transaction(async (tx) => { await manager.save(OrderEntity) })", errors: [{ messageId: "outerManager" }] }],
        })

        ruleTester({ root: TYPED_ROOT, hfs }).run("require-entity-table-name", requireEntityTableName, {
            valid: [
                { filename: ENTITY, code: '@Entity("cart_items") class CartItemEntity {}' },
                { filename: ENTITY, code: '@Entity({ name: "cart_items", schema: "billing" }) class CartItemEntity {}' },
            ],
            invalid: [
                { filename: ENTITY, code: "@Entity() class CartItemEntity {}", errors: [{ messageId: "inferred" }] },
                { filename: ENTITY, code: '@Entity({ schema: "billing" }) class CartItemEntity {}', errors: [{ messageId: "inferred" }] },
            ],
        })
    })
}
