import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { archFixture, gitCommit, runArch, writeFiles } from './hfs-arch-fixture.mjs';

const ENTRY = 'src/modules/domain/index-consumers/index.ts';
const consumer = (name, role = 'service') => `src/features/api/index-consumers/${name}.${role}.spec.ts`;
const use = name => `import { ${name} } from '../../../modules/domain/index-consumers';\nvoid ${name};\n`;
const ENTRY_TEXT = ['tracked', 'added', 'diskEdited', 'diskMissing', 'modified', 'untracked', 'removed', 'renamed', 'wrongRole', 'insideOwner', 'onlyE2e', 'nobody']
  .map(name => `export const ${name} = 1;\n`).join('');

/** A committed base followed by staged consumer additions, edits, removals and renames; disk differs from the index. */
export function stagedConsumersFixture(registerCleanup) {
  const root = archFixture({ after: registerCleanup }, { files: {
    [ENTRY]: ENTRY_TEXT,
    [consumer('tracked')]: use('tracked'),
    [consumer('modified')]: 'void 0;\n',
    [consumer('removed')]: use('removed'),
    [consumer('rename-source')]: use('renamed'),
    [consumer('wrong-role-source')]: use('wrongRole'),
    'src/modules/integrations/stripe/index.ts': 'export const ownProvider = 1;\nexport const otherProvider = 2;\n',
    'src/modules/integrations/paypal/index.ts': 'export const foreignProvider = 1;\n',
  } });
  gitCommit(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const additions = {
    [ENTRY]: `${ENTRY_TEXT}export const sameCommit = 1;\n`,
    [consumer('same-commit')]: use('sameCommit'),
    [consumer('added')]: use('added'),
    [consumer('disk-edited', 'policy')]: `${use('diskEdited')}// Un lecteur du dépôt: café.\n`,
    [consumer('disk-missing')]: use('diskMissing'),
    [consumer('modified')]: use('modified'),
    'src/modules/domain/index-consumers/inside.policy.spec.ts': "import { insideOwner } from './index';\nvoid insideOwner;\n",
    'src/tests/e2e/index-consumers/index-consumers.e2e-spec.ts': use('onlyE2e'),
    'src/tests/integration/stripe/stripe.integration-spec.ts': "import { ownProvider } from '../../../modules/integrations/stripe';\nimport { foreignProvider } from '../../../modules/integrations/paypal';\nvoid [ownProvider, foreignProvider];\n",
    'src/tests/integration/paypal/paypal.integration-spec.ts': "import { otherProvider } from '../../../modules/integrations/stripe';\nvoid otherProvider;\n",
  };
  writeFiles(root, additions);
  git('add', '--', ...Object.keys(additions));
  // The staged sources remain consumers even when their worktree no longer imports the export or lacks the file.
  writeFiles(root, { [consumer('disk-edited', 'policy')]: 'void 0;\n', [consumer('modified')]: 'void 0;\n' });
  fs.unlinkSync(path.join(root, consumer('disk-missing')));
  fs.unlinkSync(path.join(root, 'src/tests/integration/stripe/stripe.integration-spec.ts'));
  git('mv', '--', consumer('rename-source'), consumer('rename-destination'));
  fs.unlinkSync(path.join(root, consumer('rename-destination')));
  git('mv', '--', consumer('wrong-role-source'), consumer('wrong-role-destination', 'handler'));
  git('rm', '--', consumer('removed'));
  // Recreated paths removed from the index and new untracked specs cannot revive an unused export.
  writeFiles(root, { [consumer('removed')]: use('removed'), [consumer('untracked')]: use('untracked') });
  return Object.freeze({ report: runArch(root), entry: ENTRY });
}
