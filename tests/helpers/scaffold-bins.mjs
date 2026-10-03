// scaffold-bins.mjs - the bins a scaffolded app's scripts call must come from a package its manifests install. A script that
// runs `starci ...` is dead on a machine where no dependency provides the bin (the lite scaffold once installed only
// @starci/hfs, which has no bin since the one CLI). The bin owners are read from the @starci packages of this checkout.
import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..', '..');

/** { bin name -> @starci package name } of every public @starci package under packages/. */
export function starciBinOwners(root = RUNTIME) {
  const owners = new Map();
  const packages = path.join(root, 'packages');
  for (const entry of fs.readdirSync(packages, { withFileTypes: true })) {
    const file = path.join(packages, entry.name, 'package.json');
    if (!entry.isDirectory() || !fs.existsSync(file)) continue;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!String(json.name ?? '').startsWith('@starci/') || json.private === true) continue;
    const bins = typeof json.bin === 'string' ? { [json.name.split('/')[1]]: json.bin } : (json.bin ?? {});
    for (const bin of Object.keys(bins)) owners.set(bin, json.name);
  }
  return owners;
}

/** The program a script command line runs, per `&&`, `||`, `;` and `|` segment (a leading `npx` is skipped). */
const programsOf = (command) => String(command).split(/&&|\|\||;|\|/).map((segment) => {
  const words = segment.trim().split(/\s+/).filter((word) => !/^[A-Za-z_]\w*=/.test(word));
  return (words[0] === 'npx' ? words[1] : words[0]) ?? '';
}).filter(Boolean);

/** The `starci <group> <verb>` call of a command segment: [group, verb], or null when the segment is no starci call with both words. */
const starciCallOf = (segment) => {
  const match = /^(?:npx\s+)?starci\s+([a-z][a-z0-9-]*)\s+([a-z][a-z0-9-]*)/.exec(segment.trim());
  return match === null ? null : [match[1], match[2]];
};

/** Every `<group> <verb>` the CLI catalog declares (modules/cli/commands). */
const catalogVerbs = (root) => new Set(loadCatalog(root).groups.flatMap((group) => group.verbs.map((verb) => `${group.group} ${verb.verb}`)));

/** Gaps of the scaffold at `appRoot`: ["<script> calls <bin> but no dependency installs <package>"]. */
export function scaffoldBinGaps(appRoot, root = RUNTIME) {
  const owners = starciBinOwners(root);
  const verbs = catalogVerbs(root);
  const manifests = [path.join(appRoot, 'package.json')];
  const installed = new Set();
  const root0 = JSON.parse(fs.readFileSync(manifests[0], 'utf8'));
  for (const name of Object.keys({ ...root0.dependencies, ...root0.devDependencies })) installed.add(name);
  const feApps = path.join(appRoot, 'fe', 'apps');
  if (fs.existsSync(feApps)) for (const entry of fs.readdirSync(feApps)) manifests.push(path.join(feApps, entry, 'package.json'));
  const gaps = [];
  for (const file of manifests.filter((candidate) => fs.existsSync(candidate))) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [script, command] of Object.entries(manifest.scripts ?? {})) {
      for (const segment of String(command).split(/&&|\|\||;|\|/)) {
        const call = starciCallOf(segment);
        if (call !== null && !verbs.has(call.join(' '))) gaps.push(`${path.relative(appRoot, file).split(path.sep).join('/')} script ${script} calls starci ${call.join(' ')}, which is no verb of the CLI catalog`);
      }
      for (const program of programsOf(command)) {
        const owner = owners.get(program);
        if (owner !== undefined && !installed.has(owner)) gaps.push(`${path.relative(appRoot, file).split(path.sep).join('/')} script ${script} calls ${program} but no dependency installs ${owner}`);
      }
    }
  }
  // Hooks and workflows call the CLI too: every `starci <group> <verb>` they spell is a real verb.
  for (const folder of ['.husky', path.join('.github', 'workflows')]) {
    const dir = path.join(appRoot, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      for (const [, group, verb] of text.matchAll(/\bstarci\s+([a-z][a-z0-9-]*)\s+([a-z][a-z0-9-]*)/g)) {
        if (!verbs.has(`${group} ${verb}`)) gaps.push(`${folder.split(path.sep).join('/')}/${name} calls starci ${group} ${verb}, which is no verb of the CLI catalog`);
      }
    }
  }
  return gaps;
}
