#!/usr/bin/env node
// check-documented-defaults.mjs - RT_DOCUMENTED_DEFAULT_DRIFT (R231; part of `npm run check`).
//   runs in the check stage (self-check documented-defaults); --json prints the findings as JSON
//
// A document states a default by citing the key that owns it: `default <value> = `<key>``. The check resolves the key and
// compares. A key is either a config.yaml path (`debugLoop.interval`, resolved the way the validator's settings readers
// resolve it, so an absent block yields its code default) or `<file>:<dotted path>` into a yaml file under modules/ (the
// value that file declares). Scanned: docs/, README.md, CONTEXT.md, config.example.yaml and modules/ prose and yaml. A
// value that differs from the resolved one, or a key that resolves to nothing, is a finding naming file:line.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { debugLoopSettings, specsSettings, uatSettings } from '../../engine/config.mjs';
import { dotGet } from '../lib/dot-path.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings, isHistoryPath } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { workingTreeTexts } from '../lib/tracked-text-scan.mjs';

export const CODE = 'RT_DOCUMENTED_DEFAULT_DRIFT';
const EXAMPLE_FILE = 'config.example.yaml';
const SURFACE = /^(?:docs\/.+\.md|README\.md|CONTEXT\.md|config\.example\.yaml|modules\/.+\.(?:md|yaml))$/;
const CITE = /\bdefault \**`?([^\s`*=]+)`?\** = `([^`\n]+)`/g;
/** Blocks whose effective value is the settings reader's: an absent block resolves to its code default. */
const SETTINGS = Object.freeze({ debugLoop: debugLoopSettings, specs: specsSettings, uat: uatSettings });

function yamlValue(root, key) {
  const [file, dotted] = key.split(':');
  return dotGet(parseYaml(fs.readFileSync(path.join(root, file), 'utf8')), dotted);
}

/** The effective value `key` resolves to in the tree at `root`, or undefined. */
export function resolveDefault(root, key) {
  if (key.includes(':')) return yamlValue(root, key);
  const example = parseYaml(fs.readFileSync(path.join(root, EXAMPLE_FILE), 'utf8'));
  const block = key.split('.')[0];
  const read = SETTINGS[block];
  return dotGet(read ? { ...example, [block]: read(example) } : example, key);
}

/** The RT_DOCUMENTED_DEFAULT_DRIFT findings over {rel: text}: [{code, path, line, message}]. */
export function documentedDefaultFindings(files, root = skillRoot) {
  const findings = [];
  for (const [rel, text] of Object.entries(files)) {
    if (!SURFACE.test(rel) || isHistoryPath(rel)) continue;
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(CITE)) {
        const resolved = resolveDefault(root, match[2]);
        if (resolved === undefined) findings.push({ code: CODE, path: rel, line: index + 1, message: `${rel}:${index + 1} cites the default key ${match[2]}, which resolves to nothing` });
        else if (String(resolved) !== match[1]) findings.push({ code: CODE, path: rel, line: index + 1, message: `${rel}:${index + 1} states default ${match[1]} for ${match[2]}, the value the code reads is ${resolved}` });
      }
    });
  }
  return findings;
}

/** Run the scan on the working tree at `root`. */
export const checkDocumentedDefaults = (root = skillRoot) => documentedDefaultFindings(workingTreeTexts(root, lsFiles, (rel) => SURFACE.test(rel)), root);

if (isMain(import.meta.url)) process.exit(printFindings(checkDocumentedDefaults(), 'OK: every documented default equals the value the code reads.'));
