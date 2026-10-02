// write-json-file.mjs - one JSON document written to a file (the runtime's pretty-printed state files).
import fs from 'node:fs';
import path from 'node:path';

/** `value` written to `file` as two-space JSON plus a trailing newline (parent directories created). */
export function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}
`);
}
