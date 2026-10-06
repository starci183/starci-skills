// example-repin.mjs - the re-pin of an example app's package.json files to knowledge/hfs/canon-pins.yaml (`starci release publish`: release-publish-flow.mjs).
// The only `starci` bin is @starci/cli's (the hfs package has no bin), so an example that still declares @starci/hfs is moved to @starci/cli at its pin.
import fs from 'node:fs';
import path from 'node:path';

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies'];

/**
 * The `starci` bin comes only from @starci/cli (the hfs package has no bin), so an example that still declares @starci/hfs and not @starci/cli swaps it: the entry moves to the cli
 * at its pin and the section stays sorted, the way npm writes it. Pure: {text, swaps} of one package.json text; the text is the input when nothing swaps.
 */
function swapHfsForCli(text, pins) {
  const pkg = JSON.parse(text);
  const cli = pins['@starci/cli']?.version;
  const declares = (name) => [...DEPENDENCY_SECTIONS, 'peerDependencies', 'optionalDependencies'].some((key) => pkg[key]?.[name] !== undefined);
  if (!cli || declares('@starci/cli')) return { text, swaps: 0 };
  let swaps = 0;
  for (const key of DEPENDENCY_SECTIONS) {
    if (pkg[key]?.['@starci/hfs'] === undefined) continue;
    pkg[key] = Object.fromEntries(Object.entries(pkg[key]).map(([dependency, spec]) => (dependency === '@starci/hfs' ? ['@starci/cli', cli] : [dependency, spec])).sort(([a], [b]) => a.localeCompare(b, 'en')));
    swaps += 1;
  }
  if (!swaps) return { text, swaps };
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { text: JSON.stringify(pkg, null, indent).replaceAll(/\n/g, eol) + (text.endsWith('\n') ? eol : ''), swaps };
}

export function repinExample(root, name, pins, write) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`invalid example name ${name}`);
  const directory = path.join(root, 'examples', name);
  if (!fs.existsSync(path.join(directory, 'package.json'))) return { name, directory, present: false, changed: 0 };
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'coverage']);
  const visit = (dir, depth) => {
    if (depth > 6) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target, depth + 1); else if (entry.name === 'package.json') files.push(target);
    }
  };
  visit(directory, 0);
  let changed = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const swapped = swapHfsForCli(original, pins);
    changed += swapped.swaps;
    const pkg = JSON.parse(swapped.text);
    let output = swapped.text;
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependency, spec] of Object.entries(pkg[key] ?? {})) {
        const pin = pins[dependency];
        if (!pin || spec === pin.version || /^(workspace:|file:)/.test(String(spec))) continue;
        changed += 1;
        const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const version = String(spec).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        output = output.replace(new RegExp(String.raw`("${escaped}"\s*:\s*")${version}(")`), `$1${pin.version}$2`);
      }
    }
    if (write && output !== original) fs.writeFileSync(file, output);
  }
  return { name, directory, present: true, changed };
}
