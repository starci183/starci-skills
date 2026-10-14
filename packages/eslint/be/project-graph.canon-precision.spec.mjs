import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"
import { runGit } from "./runtime/scripts/api/git/lib.mjs"

const source = (f, files, rel) => ({ filename: f.at(rel), code: files[rel] })

test("dead-exports counts the index copy of a new unit spec even after its working copy is removed", (t) => {
    const entry = "src/modules/domain/catalog/index.ts"
    const files = {
        "apps/core/src/app.module.ts": "import { CatalogModule } from '../../../src/modules/domain/catalog';\nexport const AppModule = [CatalogModule];\n",
        [entry]: "export const CatalogModule = 1;\nexport const stagedOnly = Symbol('staged');\nexport const untrackedOnly = Symbol('untracked');\n",
    }
    const f = projectFixture({ files })
    t.after(f.cleanup)
    const git = (args) => {
        const result = runGit(args, { cwd: f.root })
        assert.ifError(result.error)
        assert.equal(result.status, 0, result.stderr)
    }
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "Baseline"])
    const spec = "src/modules/domain/probe/probe.service.spec.ts"
    fs.mkdirSync(path.dirname(f.at(spec)), { recursive: true })
    fs.writeFileSync(f.at(spec), "import { stagedOnly } from '../catalog';\nit('uses the public token', () => { expect(stagedOnly).toBeDefined(); });\n")
    git(["add", "--", spec])
    fs.unlinkSync(f.at(spec))
    const untracked = "src/modules/domain/other/other.service.spec.ts"
    fs.mkdirSync(path.dirname(f.at(untracked)), { recursive: true })
    fs.writeFileSync(f.at(untracked), "import { untrackedOnly } from '../catalog';\nit('is not in this commit', () => { expect(untrackedOnly).toBeDefined(); });\n")

    f.tester.run("dead-exports", rules["dead-exports"], {
        valid: [],
        invalid: [{ ...source(f, files, entry), errors: [{ messageId: "finding", line: 3 }] }],
    })
})

const handler = (name) => [
    "import { CommandHandler } from '@nestjs/cqrs';",
    "import { ICQRSHandler } from '@modules/platform/cqrs';",
    "import { InjectLogger, type Logger } from '@modules/platform/logging';",
    `import { ${name}Service } from '@modules/domain/${name.toLowerCase()}';`,
    `import { ${name}Command } from './${name.toLowerCase()}.command';`,
    `import type { ${name}Result } from './${name.toLowerCase()}.contracts';`,
    "",
    `@CommandHandler(${name}Command)`,
    `export class ${name}Handler extends ICQRSHandler<${name}Command, ${name}Result> {`,
    "    constructor(",
    "        @InjectLogger() logger: Logger,",
    `        private readonly service: ${name}Service,`,
    "    ) {",
    "        super(logger);",
    "    }",
    "",
    `    protected override process(command: ${name}Command): Promise<${name}Result> {`,
    "        return this.service.create(command.params.principal.id, command.params.request.id);",
    "    }",
    "}",
    "",
].join("\n")

const business = (name) => [
    `export function ${name}(input: { items: number[]; limit: number }) {`,
    "    let total = input.items[0] ?? 0;",
    "    const count = input.items.length + input.limit;",
    "    if (count > 2) total += count;",
    "    for (const item of input.items) total += item * count;",
    "    while (total > input.limit) total -= count;",
    "    total = Math.max(total, input.items.length);",
    "    input.items.push(total % (count + 1));",
    "    total += input.items.reduce((sum, item) => sum + item * count, 0);",
    "    if (!input.items.length) return count;",
    "    return total;",
    "}",
    "",
].join("\n")

test("duplicate-code accepts canon handler wiring while still finding copied business logic", (t) => {
    const files = {
        "src/features/api/alpha/application/alpha.handler.ts": handler("Alpha"),
        "src/features/api/alpha/application/alpha.command.ts": "export class AlphaCommand { params!: { principal: { id: string }; request: { id: string } }; }\n",
        "src/features/api/alpha/application/alpha.contracts.ts": "export type AlphaResult = unknown;\n",
        "src/features/api/beta/application/beta.handler.ts": handler("Beta"),
        "src/features/api/beta/application/beta.command.ts": "export class BetaCommand { params!: { principal: { id: string }; request: { id: string } }; }\n",
        "src/features/api/beta/application/beta.contracts.ts": "export type BetaResult = unknown;\n",
        "src/modules/domain/alpha/alpha.service.ts": business("compute"),
        "src/modules/domain/beta/beta.service.ts": business("calculate"),
    }
    const f = projectFixture({ files })
    t.after(f.cleanup)
    f.tester.run("duplicate-code", rules["duplicate-code"], {
        valid: [
            source(f, files, "src/features/api/alpha/application/alpha.handler.ts"),
            source(f, files, "src/features/api/beta/application/beta.handler.ts"),
            source(f, files, "src/modules/domain/beta/beta.service.ts"),
        ],
        invalid: [{ ...source(f, files, "src/modules/domain/alpha/alpha.service.ts"), errors: [{ messageId: "finding", line: 1 }] }],
    })
})
