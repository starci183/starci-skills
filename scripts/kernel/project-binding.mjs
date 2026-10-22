// project-binding.mjs — the registered project a Kernel launch's --repo belongs to: the
// <source>/.workspaces/projects/<name>/work.json binding (starci/workspace-binding@2) whose repository is that path.
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile } from '../lib/json.mjs';
import { foldCase, realPath } from '../lib/path-key.mjs';

const samePath = (left, right) => foldCase(realPath(left)) === foldCase(realPath(right));

/**
 * The project binding of `repo` under `sourceRoot`, or null when no binding names it.
 * @param {object} input - sourceRoot (the StarCi Source) and repo (the app repository).
 * @returns {object|null} {file, project, be, fe}: the binding file, the project name and the back- and front-end roots.
 */
export function projectBindingOf({ sourceRoot, repo }) {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  if (!fs.existsSync(projects)) return null;
  for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'work.json');
    const doc = readJsonFile(file);
    if (doc?.schema !== 'starci/workspace-binding@2' || typeof doc?.repository?.pathFromSource !== 'string') continue;
    const app = path.resolve(sourceRoot, doc.repository.pathFromSource);
    if (!samePath(app, repo)) continue;
    const fe = path.resolve(app, doc.sides?.fe ?? 'fe');
    const be = path.resolve(app, doc.sides?.be ?? 'be');
    return { file, project: doc.project ?? entry.name, be, fe };
  }
  return null;
}
