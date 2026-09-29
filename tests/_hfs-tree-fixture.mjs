import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Minimal HFS v1 repository tree (D:/starci-tmp/hfs/HFS-SPEC.md section 1-3) for fixtures that run the
// architecture check through the aggregate. Entries a spec already wrote are left untouched.
const COMMON = {
  '.gitattributes': '* text=auto eol=lf\n',
  '.github/workflows/check.yml': 'name: check\n',
  '.gitignore': 'node_modules/\n',
  '.husky/pre-commit': 'exit 0\n',
  'README.md': '# Fixture\n',
  'codecov.yml': 'coverage: {}\n',
  'eslint.config.mjs': 'export default [];\n',
  'package-lock.json': '{}\n',
  'sonar-project.properties': 'sonar.projectKey=fixture\n',
};
const BACKEND = {
  '.sops.yaml': 'creation_rules: []\n',
  '.starcistacks/application-stacks.yaml': 'environments: []\n',
  '.starciwork/.gitignore': 'runtime.sqlite\n',
  'jest.config.js': 'module.exports = {};\n',
  'nest-cli.json': '{}\n',
};

/** Write the missing HFS root entries and app shell for `kind` ('backend' | 'frontend'). */
export function writeHfsTree(root, kind, app = kind === 'backend' ? 'api' : 'web') {
  const files = { ...COMMON, ...(kind === 'backend' ? {
    ...BACKEND,
    [`apps/${app}/src/main.ts`]: 'void 0;\n',
    [`apps/${app}/src/app.module.ts`]: 'export const AppModule = 1;\n',
  } : {
    [`apps/${app}/package.json`]: '{"name":"@fixture/web","private":true}\n',
    [`apps/${app}/next.config.ts`]: 'export default {};\n',
    [`apps/${app}/postcss.config.mjs`]: 'export default {};\n',
    [`apps/${app}/tsconfig.json`]: '{"extends":"../../tsconfig.json","include":["src/**/*"]}\n',
  }) };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

/** The architecture check judges the tracked tree: stage everything except the ignored node_modules. */
export function trackHfsTree(root) {
  if (!fs.existsSync(path.join(root, '.git'))) execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
}
