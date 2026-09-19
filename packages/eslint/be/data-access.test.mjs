/**
 * Twin tests for the data-access rules.
 *
 *   node --test data-access.test.mjs
 *
 * The parameter-property form is what these cases exist for. `private readonly em: EntityManager`
 * parses as a `TSParameterProperty` wrapping the parameter, and a decorator may sit on either the
 * wrapper or the parameter inside it - a rule that reads only one of the two passes the shape this
 * codebase actually writes.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  mustInjectEntityManager,
  noEagerRelation,
  noInjectedRepository,
  noOuterManagerInTransaction,
  requireEntityTableName,
  rules,
} from "./data-access.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("DATA-1: an injected manager names its datasource", () => {
  tester.run("must-inject-entity-manager", mustInjectEntityManager, {
    valid: [
      "class H { constructor(@InjectPrimaryPostgreSQLEntityManager() private readonly em: EntityManager) {} }",
      "class H { constructor(@InjectAnalyticsEntityManager() readonly em: EntityManager) {} }",
      // not a manager
      "class H { constructor(private readonly clock: DayjsService) {} }",
      // not a constructor
      "class H { method(em: EntityManager) { return em } }",
    ],
    invalid: [
      {
        code: "class H { constructor(private readonly em: EntityManager) {} }",
        errors: [{ messageId: "undecorated" }],
      },
      {
        code: "class H { constructor(em: EntityManager) {} }",
        errors: [{ messageId: "undecorated" }],
      },
      {
        // a decorator that does not name a datasource is not a pass
        code: "class H { constructor(@Inject(TOKEN) private readonly em: EntityManager) {} }",
        errors: [{ messageId: "undecorated" }],
      },
    ],
  })
})

test("DATA-2: persistence never arrives as a repository", () => {
  tester.run("no-injected-repository", noInjectedRepository, {
    valid: [
      "class H { constructor(@InjectPrimaryPostgreSQLEntityManager() private readonly em: EntityManager) {} }",
      // a service whose NAME contains repository is not a repository handle
      "class H { constructor(private readonly repositoryOfRecord: AuditService) {} }",
    ],
    invalid: [
      {
        code: "class H { constructor(@InjectRepository(CourseEntity) private readonly repo: Repository<CourseEntity>) {} }",
        errors: [{ messageId: "repo" }],
      },
      {
        // the type alone is enough - no decorator needed
        code: "class H { constructor(private readonly repo: TreeRepository<CategoryEntity>) {} }",
        errors: [{ messageId: "repo" }],
      },
    ],
  })
})

test("DATA-3: an entity names its table", () => {
  tester.run("require-entity-table-name", requireEntityTableName, {
    valid: [
      'const d = 0; @Entity("cart_items") class CartItemEntity {}',
      '@Entity({ name: "cart_items" }) class CartItemEntity {}',
      // the options form carries the schema qualifier, which is why it is accepted
      '@Entity({ name: "cart_items", schema: "billing" }) class CartItemEntity {}',
      // a different decorator entirely
      "@Injectable() class Service {}",
    ],
    invalid: [
      { code: "@Entity() class CartItemEntity {}", errors: [{ messageId: "inferred" }] },
      {
        code: '@Entity({ schema: "billing" }) class CartItemEntity {}',
        errors: [{ messageId: "inferred" }],
      },
    ],
  })
})

test("DATA-4 (Rule 5): everything inside a transaction receives the transactional manager", () => {
  tester.run("no-outer-manager-in-transaction", noOuterManagerInTransaction, {
    valid: [
      // the callback uses only the manager it was handed
      `class H {
        constructor(private readonly entityManager: EntityManager) {}
        async run() {
          return this.entityManager.transaction(async (manager) => {
            await manager.save(FooEntity, {})
            return manager.query("SELECT 1")
          })
        }
      }`,
      // a DIFFERENT field read through this. inside the callback is not the same handle
      `class H {
        constructor(private readonly entityManager: EntityManager, private readonly logger: Logger) {}
        async run() {
          return this.entityManager.transaction(async (manager) => {
            this.logger.log("checkout")
            return manager.save(FooEntity, {})
          })
        }
      }`,
      // not a transaction call at all
      "class H { constructor(private readonly entityManager: EntityManager) {} async run() { return this.entityManager.find(FooEntity) } }",
    ],
    invalid: [
      {
        // reaches for the outer manager instead of the one the callback received
        code: `class H {
          constructor(private readonly entityManager: EntityManager) {}
          async run() {
            return this.entityManager.transaction(async (manager) => {
              await this.entityManager.save(FooEntity, {})
            })
          }
        }`,
        errors: [{ messageId: "outerManager" }],
      },
      {
        // the second write is the one that escapes - the first correctly used the handle
        code: `class H {
          constructor(private readonly entityManager: EntityManager) {}
          async run() {
            return this.entityManager.transaction(async (manager) => {
              await manager.save(FooEntity, {})
              await this.entityManager.save(BarEntity, {})
            })
          }
        }`,
        errors: [{ messageId: "outerManager" }],
      },
    ],
  })
})

test("DATA-5 (Rule 6): a relation carries no eager: true", () => {
  tester.run("no-eager-relation", noEagerRelation, {
    valid: [
      "class C { @ManyToOne(() => CourseEntity, (c) => c.items) course: CourseEntity }",
      "class C { @ManyToOne(() => CourseEntity, (c) => c.items, { eager: false }) course: CourseEntity }",
      "class C { @ManyToOne(() => CourseEntity, (c) => c.items, { nullable: true }) course: CourseEntity }",
      // eager on an unrelated decorator is not a relation grant
      'class C { @Column({ eager: true }) name: string }',
    ],
    invalid: [
      {
        code: "class C { @ManyToOne(() => CourseEntity, (c) => c.items, { eager: true }) course: CourseEntity }",
        errors: [{ messageId: "eager" }],
      },
      {
        code: "class C { @OneToMany(() => ItemEntity, (i) => i.course, { eager: true }) items: ItemEntity[] }",
        errors: [{ messageId: "eager" }],
      },
    ],
  })
})
