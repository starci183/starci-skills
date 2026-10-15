// proves: BE_SPEC_PLACEMENT@lite
// proves: BE_SPEC_PLACEMENT@full
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./index.mjs"

const SOURCE = "export const value = 1;\n"

for (const edition of ["lite", "full"]) {
    test(`R102 ${edition}: unit specs belong beside services and operational folders hold no specs`, (t) => {
        const fixture = projectFixture({
            edition,
            files: {
                "src/modules/domain/billing/invoice.service.ts": SOURCE,
                "src/modules/domain/billing/invoice.service.spec.ts": SOURCE,
                "tools/seed.spec.ts": SOURCE,
                "scripts/rotate-logs.spec.ts": SOURCE,
            },
        })
        t.after(fixture.cleanup)

        fixture.tester.run("spec-placement", rules["spec-placement"], {
            valid: [
                { filename: fixture.at("src/modules/domain/billing/invoice.service.ts"), code: SOURCE },
                { filename: fixture.at("src/modules/domain/billing/invoice.service.spec.ts"), code: SOURCE },
            ],
            invalid: [
                {
                    filename: fixture.at("tools/seed.spec.ts"),
                    code: SOURCE,
                    errors: [{ message: /BE_SPEC_PLACEMENT/, line: 1 }],
                },
                {
                    filename: fixture.at("scripts/rotate-logs.spec.ts"),
                    code: SOURCE,
                    errors: [{ message: /BE_SPEC_PLACEMENT/, line: 1 }],
                },
            ],
        })
    })
}
