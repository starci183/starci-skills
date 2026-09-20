// w7/tinkle-13 check 4: produces:/consumes: vars in ops yaml vs legality.yaml vocabulary
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modDir = root + 'modules/ops/ops/';
const leg = parseYaml(readFileSync(root + 'modules/goal/legality.yaml', 'utf8'));
const vocab = new Set(leg.producesVocabulary?.stateVariables ?? []);
const opProd = leg.producesVocabulary?.opProduces ?? {};
// normalize a var to its family pattern: "business.X: decided" style
const fam = v => String(v).replace(/^([a-zA-Z]+)\.[^:]*/, '$1.X');
const vocabFams = new Set([...vocab].map(fam));
const used = new Map(); // var -> [ops]
const missing = [];
for (const f of readdirSync(modDir).filter(f => f.endsWith('.yaml'))) {
  const id = f.replace(/\.yaml$/, '');
  const m = parseYaml(readFileSync(modDir + f, 'utf8'));
  const prod = m.route?.produces ?? m.produces ?? [];
  const cons = m.route?.consumes ?? m.consumes ?? [];
  for (const v of [...(Array.isArray(prod)?prod:[prod]), ...(Array.isArray(cons)?cons:[cons])].filter(Boolean)) {
    if (!used.has(v)) used.set(v, []);
    used.get(v).push(`${id}:${m.route?.produces?.includes?.(v)?'P':'C'}`);
    // defined if exact match in stateVariables OR in opProduces values OR family pattern present
    const exact = vocab.has(v);
    const inOpProd = Object.values(opProd).flat().includes(v);
    const famMatch = vocabFams.has(fam(v)) || Object.values(opProd).flat().some(x => fam(x) === fam(v));
    if (!exact && !inOpProd && !famMatch) missing.push({v, op: id});
  }
  // also: does opProduces[op] agree with route.produces?
  const declared = opProd[id];
  if (declared) {
    const declSet = new Set(declared.map(String));
    const routeSet = new Set((Array.isArray(prod)?prod:[prod]).map(String));
    const onlyRoute = [...routeSet].filter(x => !declSet.has(x));
    const onlyDecl = [...declSet].filter(x => !routeSet.has(x));
    if (onlyRoute.length || onlyDecl.length)
      console.log(`PRODUCES-DIFF ${id}: route-only=${JSON.stringify(onlyRoute)} legality-only=${JSON.stringify(onlyDecl)}`);
  } else {
    console.log(`NO-OPPRODUCES-ENTRY ${id} (route.produces=${JSON.stringify(prod)})`);
  }
}
console.log('\n--- distinct vars used:', used.size);
console.log('--- vars NOT defined in vocabulary (exact or family):', missing.length);
for (const m of missing) console.log('  UNDEF:', m.v, 'used by', m.op);
console.log('\n--- all used vars:');
for (const [v, ops] of [...used.entries()].sort()) console.log(`  ${v}  <- ${ops.join(', ')}`);
