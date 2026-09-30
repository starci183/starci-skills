/**
 * RuleTester proofs of the three back-end project rules that serve the slot manifest's per-path judgement (scripts/lib/hfs-path-findings.mjs,
 * origin "repo"): slot-undeclared, source-suffix and spec-placement. The project graph runs that judgement over `git ls-files` of the
 * fixture (the tester git-inits and adds every file) and each rule reports the findings of its codes on the TypeScript file ESLint visits.
 * A finding on a file that is not TypeScript stays in `hfs check` and is not on the lint surface (see the last test).
 *
 *   node --test project-graph.paths.test.mjs
 */
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const EXPORT = "export const value = 1;\n"

/** A repository of `rels` (every file holds EXPORT): `good(rel)` is a clean case, `bad(rel)` one finding on line 1. */
const scene = (t, rels, options = {}) => {
    const files = Object.fromEntries(rels.map((rel) => [rel, EXPORT]))
    const f = projectFixture({ files, ...options })
    t.after(f.cleanup)
    const at = (rel) => ({ filename: f.at(rel), code: EXPORT })
    return {
        tester: f.tester,
        good: (rel) => at(rel),
        bad: (rel, line = 1) => ({ ...at(rel), errors: [{ messageId: "finding", line }] }),
    }
}

test("a TypeScript file is owned by exactly one slot of the repository", (t) => {
    const s = scene(t, [
        "src/stray/thing.ts",
        "src/modules/domain/stock/index.ts",
        "src/modules/domain/stock/stock.service.ts",
        "src/features/orders/application/cancel-order.command.ts",
        "src/tests/world/kit/poll.ts",
    ])
    s.tester.run("slot-undeclared", rules["slot-undeclared"], {
        valid: [
            s.good("src/modules/domain/stock/index.ts"),
            s.good("src/modules/domain/stock/stock.service.ts"),
            s.good("src/features/orders/application/cancel-order.command.ts"),
            s.good("src/tests/world/kit/poll.ts"),
        ],
        invalid: [s.bad("src/stray/thing.ts")],
    })
})

test("a source file name is index.ts, main.ts, a migration or <kebab-name>.<suffix>.ts of the closed suffix list", (t) => {
    const s = scene(t, [
        "src/features/orders/application/cancel-order.command.ts",
        "src/features/orders/application/cancel-order.query.ts",
        "src/features/orders/application/cancel-order.handler.spec.ts",
        "src/features/orders/application/cancel-order.use-case.ts",
        "src/features/orders/application/order.types.ts",
        "src/features/orders/application/CancelOrder.handler.ts",
        "src/features/orders/application/helpers.ts",
        "src/features/orders/application/order.repository.ts",
        "src/features/orders/application/order.builder.ts",
        "src/modules/domain/stock/index.ts",
        "src/modules/domain/stock/persistence/migrations/20260101000000-create-stock.ts",
        "src/tests/world/kit/poll.ts",
        "src/tests/world/kit/free-ports.ts",
        "src/tests/world/kit/Bad_Name.ts",
        "src/tests/world/poll.ts",
        "src/tests/fixtures/builders/order.builder.ts",
        "src/tests/fixtures/order.fixture.ts",
        "src/tests/fixtures/order.factory.ts",
        "src/tests/fixtures/order.repository.ts",
        "src/tests/fixtures/order.builder.ts",
        "src/tests/fixtures/builders/order.fixture.ts",
        "src/stray/Not_Owned.ts",
        "apps/core/src/core.options.ts",
    ])
    s.tester.run("source-suffix", rules["source-suffix"], {
        valid: [
            s.good("apps/core/src/main.ts"),
            s.good("apps/core/src/core.options.ts"),
            s.good("src/features/orders/application/cancel-order.command.ts"),
            s.good("src/features/orders/application/cancel-order.query.ts"),
            s.good("src/features/orders/application/cancel-order.handler.spec.ts"),
            s.good("src/modules/domain/stock/index.ts"),
            s.good("src/modules/domain/stock/persistence/migrations/20260101000000-create-stock.ts"),
            s.good("src/tests/world/kit/poll.ts"),
            s.good("src/tests/world/kit/free-ports.ts"),
            s.good("src/tests/fixtures/builders/order.builder.ts"),
            // a path no slot owns is slot-undeclared's, not this rule's
            s.good("src/stray/Not_Owned.ts"),
        ],
        invalid: [
            "src/features/orders/application/cancel-order.use-case.ts",
            "src/features/orders/application/order.types.ts",
            "src/features/orders/application/CancelOrder.handler.ts",
            "src/features/orders/application/helpers.ts",
            "src/features/orders/application/order.repository.ts",
            "src/features/orders/application/order.builder.ts",
            "src/tests/world/kit/Bad_Name.ts",
            "src/tests/world/poll.ts",
            "src/tests/fixtures/order.fixture.ts",
            "src/tests/fixtures/order.factory.ts",
            "src/tests/fixtures/order.repository.ts",
            "src/tests/fixtures/order.builder.ts",
            "src/tests/fixtures/builders/order.fixture.ts",
        ].map((rel) => s.bad(rel)),
    })
})

test("a spec file lives in one of the four test layers and nowhere else", (t) => {
    const s = scene(t, [
        "src/modules/domain/billing/invoice.service.ts",
        "src/modules/domain/billing/invoice.service.spec.ts",
        "src/tests/integration/orders/claim.integration-spec.ts",
        "src/tests/e2e/orders/flow.e2e-spec.ts",
        "src/tests/contract/stripe/payments.contract-spec.ts",
        "src/features/orders/application/place-order.spec.ts",
        "src/tests/misc/other.e2e-spec.ts",
        "tools/seed.spec.ts",
        "scripts/rotate-logs.mjs",
    ])
    s.tester.run("spec-placement", rules["spec-placement"], {
        valid: [
            s.good("src/modules/domain/billing/invoice.service.ts"),
            s.good("src/modules/domain/billing/invoice.service.spec.ts"),
            s.good("src/tests/integration/orders/claim.integration-spec.ts"),
            s.good("src/tests/e2e/orders/flow.e2e-spec.ts"),
            s.good("src/tests/contract/stripe/payments.contract-spec.ts"),
        ],
        invalid: [
            s.bad("src/features/orders/application/place-order.spec.ts"),
            s.bad("src/tests/misc/other.e2e-spec.ts"),
            s.bad("tools/seed.spec.ts"),
        ],
    })
})

test("a misplaced spec that is not TypeScript is not on the lint surface: it stays in hfs check", (t) => {
    const f = projectFixture({ files: { "tools/x.spec.mjs": "export {}\n", "scripts/probe.test.cjs": "module.exports = {}\n", "src/modules/domain/billing/invoice.service.ts": EXPORT, "src/features/orders/place-order.spec.ts": EXPORT } })
    t.after(f.cleanup)
    f.tester.run("spec-placement", rules["spec-placement"], {
        valid: [
            { filename: f.at("tools/x.spec.mjs"), code: "export {}\n" },
            { filename: f.at("scripts/probe.test.cjs"), code: "module.exports = {}\n" },
            { filename: f.at("src/modules/domain/billing/invoice.service.ts"), code: EXPORT },
        ],
        invalid: [{ filename: f.at("src/features/orders/place-order.spec.ts"), code: EXPORT, errors: [{ messageId: "finding", line: 1 }] }],
    })
})
