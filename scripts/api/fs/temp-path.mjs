// temp-path.mjs — a path under the temp root (engine/temp-root.mjs tempRoot, ensured by ensure-temp-root.mjs) whose directory exists: a scratch file or a named subdirectory the caller makes.
import path from 'node:path';
import { ensureTempRoot } from './ensure-temp-root.mjs';

/** `parts` joined under the temp root, which is created when it is missing (TEMP_ROOT_UNUSABLE when it cannot be made). */
export function tempPath(...parts) {
  return path.join(ensureTempRoot(), ...parts);
}
