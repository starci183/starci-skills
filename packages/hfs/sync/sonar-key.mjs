// The Sonar project key of an app: read from its stack declaration (be/.starcistacks/application-stacks.yaml,
// services.sonar.projects[]) when one names the app, so there is one source of the key. Only when no declaration names the app
// does sync derive the key from the project name.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml as bundledParseYaml } from '../runtime/engine/yaml.mjs';

/** The side folder that holds an app's stack declaration. */
export const STACKS_SIDE = 'be';
/** The stack declaration, app-relative. */
export const DECLARATION = path.join(STACKS_SIDE, '.starcistacks', 'application-stacks.yaml');

/** The repository name the declaration lists its projects under: the app package.json name, else the folder name. */
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
 * The declared key of the app at `root`, or null when the app has no stack declaration or the declaration names none for it.
 * Two keys for one app are refused through `fail`. `parseYaml(text)` is injected; the default is the YAML parser bundled in this
 * package (the package installs with no node_modules).
 */
export async function readDeclaredSonarKey(root, { parseYaml, fail }) {
  const file = path.join(root, DECLARATION);
  if (!fs.existsSync(file)) return null;
  const parse = parseYaml ?? bundledParseYaml;
  const keys = declaredSonarKeys(parse(fs.readFileSync(file, 'utf8')), repositoryName(root));
  if (keys.length > 1) fail(`${DECLARATION.split(path.sep).join('/')} declares ${keys.length} Sonar projects for ${repositoryName(root)} (${keys.join(', ')}); one app has one key`);
  return keys[0] ?? null;
}

/**
 * The quality gate the declaration names for Sonar: `{ file, qualityGate }` (file app-relative), or null when there is no
 * declaration, Sonar is disabled in it, or it declares no Sonar service. The one gate is knowledge/sonar-gate.yaml; an app names it
 * and never states thresholds of its own.
 */
export function readDeclaredSonarGate(root, { parseYaml } = {}) {
  const file = path.join(root, DECLARATION);
  if (!fs.existsSync(file)) return null;
  const sonar = (parseYaml ?? bundledParseYaml)(fs.readFileSync(file, 'utf8'))?.services?.sonar;
  if (!sonar || sonar.mode === 'disabled') return null;
  return { file: path.relative(root, file).split(path.sep).join('/'), qualityGate: typeof sonar.qualityGate === 'string' ? sonar.qualityGate : null };
}
