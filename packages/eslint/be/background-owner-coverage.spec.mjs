// proves: BE_BACKGROUND_UNOWNED@lite BE_BACKGROUND_UNOWNED@full
import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const owned = "src/features/api/owned/transport/message/owned.consumer.ts"
const orphan = "src/features/api/orphan/transport/message/orphan.consumer.ts"
const files = {
    "apps/core/src/app.module.ts": 'import { Module } from "@nestjs/common"; import { OwnedMessageModule } from "../../../src/features/api/owned"; @Module({ imports: [OwnedMessageModule] }) export class AppModule {}\n',
    "src/features/api/owned/index.ts": 'export { OwnedMessageModule } from "./transport/message/owned-message.module";\n',
    "src/features/api/owned/transport/message/owned-message.module.ts": 'import { Module } from "@nestjs/common"; import { OwnedConsumer } from "./owned.consumer"; @Module({ providers: [OwnedConsumer] }) export class OwnedMessageModule {}\n',
    [owned]: "export class OwnedConsumer {}\n",
    "src/features/api/orphan/index.ts": "export const orphan = true;\n",
    [orphan]: "export class OrphanConsumer {}\n",
}

for (const edition of ["lite", "full"]) {
    test(`R46 ${edition}: composed consumers pass and unowned consumers are refused`, (t) => {
        const fixture = projectFixture({ edition, files })
        t.after(fixture.cleanup)
        fixture.tester.run("background-unowned", rules["background-unowned"], {
            valid: [{ filename: fixture.at(owned), code: fs.readFileSync(fixture.at(owned), "utf8") }],
            invalid: [{
                filename: fixture.at(orphan),
                code: fs.readFileSync(fixture.at(orphan), "utf8"),
                errors: [{ line: 1, message: /BE_BACKGROUND_UNOWNED.*is a consumer that no service app composes/ }],
            }],
        })
    })
}
