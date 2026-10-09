// yaml-cached.mjs - parse a YAML text once per distinct text in a process.
//
// The HFS slot manifest and rule catalog are large documents that one process asks for again at every check, every render and every fixture. Their
// bytes do not change between those asks, so the parse (the dominant cost of a load) is keyed by the text itself; each caller gets its own copy of the
// parsed document, so nothing a caller does to it reaches the next one. A changed file is a different text and parses again.
import { parseYaml } from '../../engine/yaml.mjs';

const parsed = new Map();

/** The parsed document of `text`: parsed on the first ask for this text, a structured copy afterwards. Throws what parseYaml throws, every time. */
export function parseYamlCached(text) {
  if (!parsed.has(text)) parsed.set(text, parseYaml(text));
  return structuredClone(parsed.get(text));
}
