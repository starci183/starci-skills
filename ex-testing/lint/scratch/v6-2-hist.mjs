/** Lane v6-2: tag + check-id histogram of two check-example-work runs, so the delta is measured, not assumed. */
import fs from 'node:fs';

const hist = file => {
  const tags = new Map();
  const ids = new Map();
  let refused = 0;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('REFUSED')) continue;
    refused += 1;
    const tag = /\[([A-Z_]+)\]$/.exec(line)?.[1] ?? '(untagged)';
    tags.set(tag, (tags.get(tag) ?? 0) + 1);
    const id = /^REFUSED [^:]+: (?:capture [^:]+: )?([a-z][a-z0-9-]+)(?: fails| could not run|:)/.exec(line)?.[1];
    if (id) ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  return { refused, tags, ids };
};

const [before, after] = [process.argv[2], process.argv[3]].map(hist);
const keys = [...new Set([...before.tags.keys(), ...after.tags.keys()])].sort();
console.log(`tag                         before  after   delta`);
for (const k of keys) {
  const b = before.tags.get(k) ?? 0, a = after.tags.get(k) ?? 0;
  console.log(`${k.padEnd(27)} ${String(b).padStart(5)} ${String(a).padStart(6)}   ${a - b > 0 ? '+' : ''}${a - b}`);
}
console.log(`${'ALL REFUSED'.padEnd(27)} ${String(before.refused).padStart(5)} ${String(after.refused).padStart(6)}   ${after.refused - before.refused}`);
const ikeys = [...new Set([...before.ids.keys(), ...after.ids.keys()])].sort();
console.log(`\ncheck id                    before  after   delta`);
for (const k of ikeys) {
  const b = before.ids.get(k) ?? 0, a = after.ids.get(k) ?? 0;
  console.log(`${k.padEnd(27)} ${String(b).padStart(5)} ${String(a).padStart(6)}   ${a - b > 0 ? '+' : ''}${a - b}`);
}
