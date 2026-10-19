import path from 'node:path';
import { sha256File } from '../../../engine/digest.mjs';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { nativeAppEntry } from './native-app-entry.mjs';

const REQUIRED_OWNERS = {
  'ci/cli.mjs': 'packages/hfs/ci/cli.mjs',
  'ci/secret.mjs': 'packages/hfs/ci/secret.mjs',
  'ci/github.mjs': 'packages/hfs/ci/github.mjs',
  'runtime/scripts/hfs/ci-declaration.mjs': 'scripts/hfs/ci-declaration.mjs',
  'runtime/engine/yaml.mjs': 'engine/yaml.mjs',
};

/**
 * Bind the installed native CLI/HFS pair through its shared owner, requiring this Source's fixed
 * CI guards and declaration reader before custody opens. Return only the public package/Node identity.
 */
export function inspectCiProvisionCli(repoRoot) {
  const requiredHfsFiles = Object.fromEntries(Object.entries(REQUIRED_OWNERS)
    .map(([installed, source]) => [installed, sha256File(path.join(skillRoot, source))]));
  return nativeAppEntry({ repoRoot, requiredHfsFiles }).public;
}
