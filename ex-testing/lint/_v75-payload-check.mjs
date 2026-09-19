// v7-5: check the starci/* payload digests against the bytes on disk (read-only).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../../core/yaml.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const treeRoot = 'examples/ecommerce-app-be/.starciwork';
let ok = 0, bad = 0, missing = 0;
const report = [];

for (const rel of [
  'features/checkout/ui/cart/assets/generation-receipts.yaml',
  'features/checkout/ui/landing-home/assets/generation-receipts.yaml',
  'features/checkout/ui/shop-browse/assets/generation-receipts.yaml',
  'features/checkout/ui/stock-refused/assets/generation-receipts.yaml',
  'features/identity/ui/sign-in/assets/generation-receipts.yaml',
]) {
  const nodeDir = path.posix.dirname(path.posix.dirname(rel)); // the record dir; payload paths are node-relative
  const doc = parseYaml(fs.readFileSync(path.join(root, treeRoot, rel), 'utf8'));
  for (const call of doc.calls ?? []) {
    for (const [label, p] of [['artifact', call.artifact], ['prompt', call.prompt]]) {
      const target = path.posix.join(treeRoot, nodeDir, p);
      const stored = label === 'artifact' ? call.sha256 : call.promptSha256;
      if (!fs.existsSync(path.join(root, target))) { missing++; report.push(`MISSING ${rel}: ${label} ${p}`); continue; }
      const now = sha(target);
      if (now === stored) ok++;
      else { bad++; report.push(`MISMATCH ${rel}: ${label} ${p} stored ${stored?.slice(0, 12)} now ${now.slice(0, 12)}`); }
    }
    for (const ref of call.referencedImages ?? []) {
      if (!fs.existsSync(path.join(root, ref.path))) { missing++; report.push(`MISSING(ref) ${rel}: ${ref.path}`); continue; }
      const now = sha(ref.path);
      if (now === ref.sha256) ok++;
      else { bad++; report.push(`MISMATCH(ref) ${rel}: ${ref.path} stored ${ref.sha256?.slice(0, 12)} now ${now.slice(0, 12)}`); }
    }
  }
}

const dc = parseYaml(fs.readFileSync(path.join(root, treeRoot, 'features/checkout/ui/landing-home/assets/direction-check.yaml'), 'utf8'));
console.log(`direction-check.yaml: result=${dc.result} selectedDirections=${dc.selectedDirections} totalPngs=${dc.totalPngsIncludingHistory} siblingPrompts=${dc.siblingPrompts} checks=${dc.checks.length}`);
for (const c of dc.checks) console.log(`   ${c.record}: ${c.result}`);
console.log(`generation-receipts hashes: ${ok} match, ${bad} mismatch, ${missing} file-missing`);
report.slice(0, 20).forEach(l => console.log('   ' + l));

// PNG counts in the ui assets dirs, to test direction-check's totals claim.
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
let pngs = 0, prompts = 0;
for (const ui of ['features/checkout/ui/cart', 'features/checkout/ui/landing-home', 'features/checkout/ui/shop-browse', 'features/checkout/ui/stock-refused', 'features/identity/ui/sign-in']) {
  for (const f of walk(path.join(root, treeRoot, ui, 'assets'))) {
    if (f.endsWith('.png')) pngs++;
    if (f.endsWith('.prompt.txt')) prompts++;
  }
}
console.log(`on disk under those 5 ui assets/ dirs: ${pngs} .png, ${prompts} .prompt.txt (claimed ${dc.totalPngsIncludingHistory} pngs / ${dc.siblingPrompts} prompts)`);
