// cli.mjs - the one command line of a back end (R147 BE_CLI_REQUIRED).
//   BE_CLI_REQUIRED       a back end that declares a connection (it has migrations to run) or tracks a command (src/features/cli/)
//                         declares exactly one app of kind cli, named cli (be/apps/cli), and tracks its image be/apps/cli/Dockerfile:
//                         one image, run as `cli <group> <command>`. A cli app with another name, or a second one, is refused.
// Where a command is declared and that every command has its unit spec beside it are eslint-be's (cli-command-shape, and
// unit-test-colocated over ruleParams.be.unitRoles).
// Paths are app-relative; the cli app and the cli feature root are read from the slot manifest through the resolver.
import { found } from './read.mjs';

export const CLI_REQUIRED = 'BE_CLI_REQUIRED';

/** The one name of the cli app, its kind, and what its image is called below it. */
export const CLI_APP = 'cli';
const CLI_KIND = 'cli';
const IMAGE = 'Dockerfile';
const CLI_FEATURE_SLOT = 'be.cli';

/** The findings of R147 over the tracked paths `files` (app-relative) of the app `repo`; `resolver` is the app's. */
export function cliFindings({ files, repo, resolver }) {
  if (!repo?.sides) return [];
  const be = repo.sides.be;
  const beResolver = resolver.sides?.be ?? resolver;
  const onBe = files.filter((file) => file.startsWith('be/')).map((file) => file.slice('be/'.length));
  const tracked = new Set(onBe);
  const commandFiles = onBe.filter((file) => beResolver.classifyPath(file).slot === CLI_FEATURE_SLOT);
  const findings = [];
  const cliApps = be.apps.filter((app) => app.kind === CLI_KIND);
  // Under edition lite schema migration is the Supabase CLI's job (slot be.app.cli is optional there): a connection no longer forces the cli app, a tracked command still does.
  const migrates = (be.connections ?? []).length > 0 && repo.edition !== 'lite';
  const needs = migrates || commandFiles.length > 0;
  const why = migrates ? `it declares the connection${be.connections.length === 1 ? '' : 's'} ${be.connections.map((c) => c.name).join(', ')} (their migrations run as \`cli migrate run\`)` : 'it tracks commands under be/src/features/cli/';
  if (needs && cliApps.length === 0) findings.push(found(CLI_REQUIRED, 'hfs.json', `the back end declares no cli app, but ${why}; declare { "name": "${CLI_APP}", "kind": "${CLI_KIND}" } in sides.be.apps and build be/apps/${CLI_APP} on nest-commander: every one-off action of the back end is one of its commands.`, { needs: why }));
  for (const app of cliApps.filter((entry) => entry.name !== CLI_APP)) findings.push(found(CLI_REQUIRED, 'hfs.json', `the cli app is named ${app.name}; the back end has ONE cli app, be/apps/${CLI_APP}, so its image and its command line are the same in every app.`, { app: app.name }));
  if (cliApps.length > 0 && !tracked.has(`apps/${CLI_APP}/${IMAGE}`) && cliApps.some((app) => app.name === CLI_APP)) findings.push(found(CLI_REQUIRED, `be/apps/${CLI_APP}/${IMAGE}`, `be/apps/${CLI_APP} has no image: track be/apps/${CLI_APP}/${IMAGE}, the one cli image every one-off action runs from (\`cli <group> <command>\`).`, { app: CLI_APP }));
  return findings;
}
