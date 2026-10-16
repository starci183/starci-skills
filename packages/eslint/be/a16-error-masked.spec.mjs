// proves: BE_ERROR_MASKED@lite
// proves: BE_ERROR_MASKED@full
import test from 'node:test';
import { projectFixture } from './fixtures/project/tester.mjs';
import { rules } from './project-graph.mjs';
import { errorsFiles } from '../../../tests/helpers/hfs-arch-be-fixture.mjs';

const appModule = (providers, imports) => `import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AllExceptionsFilter, formatError } from '../../../src/modules/platform/errors';
@Module({ providers: [${providers}], imports: [${imports}] })
export class AppModule {}
`;
const filter = '{ provide: APP_FILTER, useClass: AllExceptionsFilter }';
const graphql = 'GraphQLModule.forRoot({ formatError })';

for (const edition of ['lite', 'full']) {
    test(`${edition}: valid masked error registration and invalid missing filter or GraphQL mapper`, (t) => {
        const files = {
            ...errorsFiles,
            'apps/good/src/app.module.ts': appModule(filter, graphql),
            'apps/missing-filter/src/app.module.ts': appModule('', graphql),
            'apps/missing-mapper/src/app.module.ts': appModule(filter, 'GraphQLModule.forRoot({})'),
        };
        const f = projectFixture({
            edition,
            apps: [
                { name: 'good', kind: 'api' },
                { name: 'missing-filter', kind: 'api' },
                { name: 'missing-mapper', kind: 'api' },
            ],
            files,
        });
        t.after(f.cleanup);
        f.tester.run('error-masked', rules['error-masked'], {
            valid: [{ filename: f.at('apps/good/src/app.module.ts'), code: files['apps/good/src/app.module.ts'] }],
            invalid: [
                { filename: f.at('apps/missing-filter/src/app.module.ts'), code: files['apps/missing-filter/src/app.module.ts'], errors: [{ messageId: 'finding' }] },
                { filename: f.at('apps/missing-mapper/src/app.module.ts'), code: files['apps/missing-mapper/src/app.module.ts'], errors: [{ messageId: 'finding' }] },
            ],
        });
    });
}
