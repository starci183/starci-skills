// The Sonar project key of a repository: read from its stack declaration (.starcistacks/application-stacks.yaml,
// services.sonar.projects[]) when one exists, so there is one source of the key. Only when no declaration names this
// repository does sync derive `<project>-backend` / `<project>-fe`.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml as bundledParseYaml } from '../runtime/engine/yaml.mjs';

export const DECLARATION = path.join('.starcistacks', 'application-stacks.yaml');

/** The repository name the declaration lists its projects under: package.json name, else the folder name. */
export function repositoryName(root) {
  try {
    const name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name;
    if (typeof name === 'string' && name) return name;
  } catch {
    // no readable package.json: the folder name stands in
  }
  return path.basename(path.resolve(root));
}

/** The keys services.sonar declares for `repository` in a parsed declaration (empty when it declares none). */
export function declaredSonarKeys(declaration, repository) {
  const projects = declaration?.services?.sonar?.projects;
  if (!Array.isArray(projects)) return [];
  return projects.filter(project => project?.repository === repository && typeof project.key === 'string' && project.key).map(project => project.key);
}

/**
 * The declared key, or null when the repository has no declaration or the declaration names none for it.
 * `stacks` is hfs.json's optional path to the sibling repository that owns the declaration (a front-end repository has
 * none of its own); the key is still looked up under THIS repository's name. A `stacks` path with no declaration behind it
 * is refused, because the key would silently fall back to a derived one.
 * `parseYaml(text)` is injected; the default is the YAML parser bundled in this package (the package installs with no node_modules).
 */
export async function readDeclaredSonarKey(root, { parseYaml, fail, stacks }) {
  const file = path.join(stacks === undefined ? root : path.resolve(root, stacks), DECLARATION);
  if (!fs.existsSync(file)) {
    if (stacks !== undefined) fail(`hfs.json stacks points at ${stacks}, which has no ${DECLARATION}`);
    return null;
  }
  const parse = parseYaml ?? bundledParseYaml;
  const keys = declaredSonarKeys(parse(fs.readFileSync(file, 'utf8')), repositoryName(root));
  if (keys.length > 1) fail(`${DECLARATION} declares ${keys.length} Sonar projects for ${repositoryName(root)} (${keys.join(', ')}); one repository has one key`);
  return keys[0] ?? null;
}
