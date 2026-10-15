// proves: BE_ERROR_HOME@lite
// proves: BE_ERROR_HOME@full
import assert from 'node:assert/strict';
import test from 'node:test';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { projectFixture } from './fixtures/project/tester.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { errorFamilyShape, errorHome, throwDomainError } from './error-handling.mjs';
import { rules } from './project-graph.mjs';

const service = at('src/modules/domain/plan/plan.service.ts');
const home = at('src/modules/domain/plan/errors/plan.error.ts');
const head = 'import { DomainError } from "@modules/platform/errors";\nenum PlanErrorCode { Missing = "PLAN_MISSING" }\n';
const family = `import { DomainError } from "@modules/platform/errors";
import type { ErrorKind } from "@modules/platform/errors";
export enum PlanErrorCode { Missing = "PLAN_MISSING" }
export const PLAN_ERROR_KINDS: Record<PlanErrorCode, ErrorKind> = { [PlanErrorCode.Missing]: "not-found" };
export class PlanError extends DomainError<PlanErrorCode> {}
`;

for (const edition of ['lite', 'full']) {
    test(`${edition}: valid owner error family and invalid placement, thrown value and family shape`, () => {
        const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
        assert.equal(hfs.edition, edition);
        const tester = ruleTester({ root: TYPED_ROOT, hfs });
        tester.run('error-home', errorHome, {
            valid: [{ filename: home, code: `${head}export class PlanError extends DomainError<PlanErrorCode> {}` }],
            invalid: [
                { filename: service, code: `${head}export class PlanError extends DomainError<PlanErrorCode> {}`, errors: [{ messageId: 'place' }] },
                { filename: home, code: 'export class PlanError extends Error {}', errors: [{ messageId: 'mustExtendDomainError' }] },
            ],
        });
        tester.run('throw-domain-error', throwDomainError, {
            valid: [{ filename: service, code: `${head}class PlanError extends DomainError<PlanErrorCode> {}\nfunction run() { throw new PlanError({ code: PlanErrorCode.Missing }); }` }],
            invalid: [{ filename: service, code: 'function run() { throw new Error("internal details"); }', errors: [{ messageId: 'bareError' }] }],
        });
        tester.run('error-family-shape', errorFamilyShape, {
            valid: [{ filename: home, code: family }],
            invalid: [{ filename: home, code: family.replace('"PLAN_MISSING"', '"OTHER_MISSING"'), errors: [{ messageId: 'memberValue' }] }],
        });
    });

    test(`${edition}: valid unique capability error codes and invalid duplicated code`, (t) => {
        const files = {
            'src/modules/domain/purchase/index.ts': 'export const purchase = 1;\n',
            'src/modules/domain/purchase/errors/purchase.error.ts': 'export enum PurchaseErrorCode { Missing = "PURCHASE_MISSING" }\n',
            'src/modules/domain/plan/index.ts': 'export const plan = 1;\n',
            'src/modules/domain/plan/errors/plan.error.ts': 'export enum PlanErrorCode { Missing = "PLAN_MISSING", Again = "PLAN_MISSING" }\n',
        };
        const f = projectFixture({ edition, files });
        t.after(f.cleanup);
        f.tester.run('error-code-unique', rules['error-code-unique'], {
            valid: [{ filename: f.at('src/modules/domain/purchase/errors/purchase.error.ts'), code: files['src/modules/domain/purchase/errors/purchase.error.ts'] }],
            invalid: [{ filename: f.at('src/modules/domain/plan/errors/plan.error.ts'), code: files['src/modules/domain/plan/errors/plan.error.ts'], errors: [{ messageId: 'finding' }] }],
        });
    });
}
