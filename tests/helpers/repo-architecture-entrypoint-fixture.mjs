import {
  DEFAULT_APPS,
  appDeclarationText,
  findings,
  runArch,
  tempSide,
  writeFiles,
} from './hfs-arch-fixture.mjs';

export { runArch, findings };

/**
 * The entrypoint rule needs only the fixture's authored files. A repository
 * without Git metadata selects the architecture machine's equivalent filesystem
 * tree reader and avoids spawning Git repeatedly for every checker.
 */
export function archFixture(t, { profile = 'be', files = {}, declaration = {}, apps = DEFAULT_APPS[profile] } = {}) {
  const root = tempSide(t, `starci-hfs-arch-${profile}-`, profile);
  const app = apps[0].name;
  writeFiles(root, {
    '../hfs.json': appDeclarationText(profile, { apps, ...declaration }),
    '../package.json': JSON.stringify({ name: 'fixture', private: true }),
    'tsconfig.json': `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'preserve',
        allowJs: true,
        skipLibCheck: true,
        noEmit: true,
        experimentalDecorators: true,
      },
      include: ['src/**/*', 'apps/**/*'],
    }, null, 2)}\n`,
    [`apps/${app}/src/main.ts`]: 'void 0;\n',
    [`apps/${app}/src/app.module.ts`]: 'export const AppModule = 1;\n',
    ...files,
  });
  return root;
}
