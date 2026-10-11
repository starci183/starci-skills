import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';

const parsed = new Map();

/** The parsed YAML catalog at `file`; the megabyte of text is parsed once per file state (path, size, mtime), not once per check. */
export function readCatalogOnce(file) {
  const { size, mtimeMs } = fs.statSync(file);
  const key = `${file}|${size}|${mtimeMs}`;
  if (!parsed.has(key)) {
    parsed.clear();
    parsed.set(key, parseYaml(fs.readFileSync(file, 'utf8')));
  }
  return parsed.get(key);
}
