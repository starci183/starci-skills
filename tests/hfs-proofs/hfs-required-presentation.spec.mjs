// proves: HFS_REQUIRED_FILE_MISSING@lite HFS_REQUIRED_FILE_MISSING@full
// proves: HFS_ROOT_ENTRY_MISSING@lite HFS_ROOT_ENTRY_MISSING@full
// proves: HFS_APPS_REQUIRED@lite HFS_APPS_REQUIRED@full
// proves: HFS_APP_LAYOUT_INVALID@lite HFS_APP_LAYOUT_INVALID@full
// proves: HFS_README_TITLE_INVALID@lite HFS_README_TITLE_INVALID@full
// proves: HFS_README_DESCRIPTION_INVALID@lite HFS_README_DESCRIPTION_INVALID@full
// proves: HFS_README_SECTION_MISSING@lite HFS_README_SECTION_MISSING@full
// proves: HFS_README_SECTION_ORDER@lite HFS_README_SECTION_ORDER@full
// proves: HFS_README_DEVELOPMENT_INCOMPLETE@lite HFS_README_DEVELOPMENT_INCOMPLETE@full
// proves: HFS_README_WORK_POINTER_MISSING@lite HFS_README_WORK_POINTER_MISSING@full
// proves: HFS_README_PRIVATE_URL@lite HFS_README_PRIVATE_URL@full
// proves: HFS_README_BADGE_NOT_LIVE@lite HFS_README_BADGE_NOT_LIVE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkHfs, checkRepoPresentation } from '../../scripts/hfs/architecture/hfs.mjs';
import { checkRequiredFiles } from '../../scripts/hfs/architecture/required-files.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const manifest = loadSlotManifest();
const declaration = edition => ({ hfs: 3, kind: 'app', project: 'fixture', edition,
  sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });
const write = (root, file, text = 'export {};\n') => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const readme = '# fixture\n\nA fixture application.\n\n## Overview\nOverview.\n\n## Stack\nStack.\n\n## Repository layout\nLayout.\n\n## Development\nnpm ci\nnpm run typecheck\nnpm run lint\nnpm run build\nnpm test\n\n## Work\n.starciwork\n';
const mutations = [
  ['HFS_README_TITLE_INVALID', text => text.replace('# fixture', '# wrong')],
  ['HFS_README_DESCRIPTION_INVALID', text => text.replace('A fixture application.', '# no description')],
  ['HFS_README_SECTION_MISSING', text => text.replace('## Stack', '## Other')],
  ['HFS_README_SECTION_ORDER', text => text.replace('## Overview', '## TEMP').replace('## Stack', '## Overview').replace('## TEMP', '## Stack')],
  ['HFS_README_DEVELOPMENT_INCOMPLETE', text => text.replace('npm ci', 'install dependencies')],
  ['HFS_README_WORK_POINTER_MISSING', text => text.replace('.starciwork', 'records')],
  ['HFS_README_PRIVATE_URL', text => text + '\nhttp://localhost:3000\n'],
  ['HFS_README_BADGE_NOT_LIVE', text => text + '\n![badge](https://img.shields.io/badge/status-green)\n'],
];

for (const edition of ['lite', 'full']) {
  for (const [code, mutate] of mutations) {
    test(`${edition} rejects ${code} and accepts restored README`, t => {
      const root = mkdtemp(t, 'hfs-readme-proof-');
      write(root, 'package.json', '{"name":"fixture"}');
      write(root, '.gitattributes', '* text=auto\n');
      write(root, '.starciwork/.keep', '');
      write(root, 'README.md', mutate(readme));
      assert.ok(checkRepoPresentation({ root, edition }).violations.some(item => item.ruleId === code));
      write(root, 'README.md', readme);
      assert.deepEqual(checkRepoPresentation({ root, edition }).violations, []);
    });
  }

  test(`${edition} rejects missing required files and accepts their restoration`, t => {
    const root = mkdtemp(t, 'hfs-required-side-proof-');
    const repo = resolveRepoDeclaration(manifest, declaration(edition));
    const resolver = createSlotResolver(manifest, repo.sides.be);
    const config = { root, kinds: ['backend'], hfs: resolver };
    const graph = { resolver };
    const paths = resolver.requiredPaths().paths;
    for (const { path: file } of paths) write(root, file.endsWith('/') ? file + '.keep' : file);
    for (const name of ['config', 'logging', 'errors', 'primitives', 'clock', 'i18n']) write(root, `src/modules/platform/${name}/index.ts`);
    write(root, 'src/features/api/demo/index.ts');
    write(root, 'src/features/api/demo/demo.module.ts');
    write(root, 'src/features/api/demo/application/.keep');
    write(root, 'apps/api/src/main.ts');
    write(root, 'apps/api/src/app.module.ts');
    write(root, 'apps/api/src/api.env.ts');
    assert.deepEqual(checkRequiredFiles({ config, graph }).violations.filter(item => item.ruleId === 'HFS_REQUIRED_FILE_MISSING'), []);
    fs.unlinkSync(path.join(root, 'apps/api/src/main.ts'));
    assert.ok(checkRequiredFiles({ config, graph }).violations.some(item => item.ruleId === 'HFS_REQUIRED_FILE_MISSING'));
  });

  for (const code of ['HFS_ROOT_ENTRY_MISSING', 'HFS_APPS_REQUIRED', 'HFS_APP_LAYOUT_INVALID']) {
    test(`${edition} rejects ${code} and accepts a complete side`, t => {
      const root = mkdtemp(t, 'hfs-layout-proof-');
      const repo = resolveRepoDeclaration(manifest, declaration(edition));
      const resolver = createSlotResolver(manifest, repo.sides.fe);
      const config = { root, kinds: ['frontend'], hfs: resolver };
      if (code === 'HFS_APP_LAYOUT_INVALID') write(root, 'apps/web/src/app/.keep');
      assert.ok(checkHfs(config).violations.some(item => item.ruleId === code));
      for (const { path: file } of resolver.requiredPaths().paths) write(root, file.endsWith('/') ? file + '.keep' : file);
      for (const file of ['next.config.ts', 'postcss.config.mjs', 'tsconfig.json']) write(root, `apps/web/${file}`);
      write(root, 'apps/web/src/app/.keep');
      assert.deepEqual(checkHfs(config).violations.filter(item => item.ruleId === code), []);
    });
  }
}
