// v8-3 scratch: list top-level declarations in the lane script that are referenced only where they are defined.
import fs from 'node:fs';

const source = fs.readFileSync('scripts/check-work-history.mjs', 'utf8');
const names = [...source.matchAll(/^(?:export )?(?:function|const) ([A-Za-z_]\w*)/gm)].map(match => match[1]);
for (const name of names) {
  const uses = source.split(new RegExp(`(?<![\\w$])${name}(?![\\w$])`)).length - 1;
  if (uses < 2) console.log(`UNUSED  ${name}`);
}
console.log(`checked ${names.length} top-level names`);
