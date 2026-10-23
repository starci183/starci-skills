// proves: HFS_UNUSED_EXPORT@lite
// proves: HFS_UNUSED_EXPORT@full
// proves: HFS_UNUSED_FILE@lite
// proves: HFS_UNUSED_FILE@full
import test from 'node:test';
import { projectFixture } from './fixtures/project/tester.mjs';
import { rules as beRules } from './project-graph.mjs';
import { rules as feRules } from '../fe/project-graph.mjs';

const sourceCase = (fixture, files, file) => ({ filename: fixture.at(file), code: files[file] });

for (const edition of ['lite', 'full']) {
  test(`${edition} back-end dead exports accept consumed exports and reached files and reject unused exports and files`, t => {
    const files = {
      'apps/core/src/app.module.ts': "import { used } from '../../../src/modules/domain/liveness';\nimport { live } from '../../../src/modules/domain/live';\nexport const AppModule = [used, live];\n",
      'apps/core/src/main.ts': "import { boot } from './boot';\nboot();\n",
      'apps/core/src/boot.ts': 'export const boot = () => 1;\n',
      'apps/core/src/stray.ts': 'export const stray = 1;\n',
      'src/modules/domain/liveness/index.ts': 'export const used = 1;\nexport const unused = 2;\n',
      'src/modules/domain/live/index.ts': 'export const live = 1;\n',
    };
    const fixture = projectFixture({ profile: 'be', edition, files });
    t.after(fixture.cleanup);
    fixture.tester.run('dead-exports', beRules['dead-exports'], {
      valid: [
        sourceCase(fixture, files, 'apps/core/src/main.ts'),
        sourceCase(fixture, files, 'apps/core/src/boot.ts'),
        sourceCase(fixture, files, 'src/modules/domain/live/index.ts'),
      ],
      invalid: [
        { ...sourceCase(fixture, files, 'src/modules/domain/liveness/index.ts'), errors: [{ message: /HFS_UNUSED_EXPORT/u, line: 2 }] },
        { ...sourceCase(fixture, files, 'apps/core/src/stray.ts'), errors: [{ message: /HFS_UNUSED_FILE/u, line: 1 }] },
      ],
    });
  });

  test(`${edition} front-end dead exports accept consumed exports and reached files and reject unused exports and files`, t => {
    const files = {
      'apps/web/src/app/[locale]/page.tsx': "import { used } from '../../modules/liveness';\nimport { live } from '../../modules/live';\nexport default function Route() { return <main>{used + live}</main>; }\n",
      'apps/web/src/modules/liveness/index.ts': 'export const used = 1;\nexport const unused = 2;\n',
      'apps/web/src/modules/liveness/orphan.ts': 'export const orphan = 1;\n',
      'apps/web/src/modules/live/index.ts': 'export const live = 1;\n',
    };
    const fixture = projectFixture({ profile: 'fe', edition, files });
    t.after(fixture.cleanup);
    fixture.tester.run('dead-exports', feRules['dead-exports'], {
      valid: [
        sourceCase(fixture, files, 'apps/web/src/app/[locale]/page.tsx'),
        sourceCase(fixture, files, 'apps/web/src/modules/live/index.ts'),
      ],
      invalid: [
        { ...sourceCase(fixture, files, 'apps/web/src/modules/liveness/index.ts'), errors: [{ message: /HFS_UNUSED_EXPORT/u, line: 2 }] },
        { ...sourceCase(fixture, files, 'apps/web/src/modules/liveness/orphan.ts'), errors: [{ message: /HFS_UNUSED_FILE/u, line: 1 }] },
      ],
    });
  });
}
