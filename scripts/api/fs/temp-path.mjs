// temp-path.mjs — a path under the temp root (engine/temp-root.mjs tempRoot) whose directory exists: a scratch file or a named subdirectory the caller makes.
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../../../engine/temp-root.mjs';

/** `parts` joined under tempRoot(), which is created when it is missing. */
export function tempPath(...parts) {
  const root = tempRoot();
  fs.mkdirSync(root, { recursive: true });
  return path.join(root, ...parts);
}
