import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {censusGrammar,ruleCatalog} from '../scripts/checks/grammar-knowledge.mjs';

/**
 * Two promises every Common renderer makes, measured by the same static census the grammar knowledge
 * snapshots are written from (`scripts/checks/grammar-knowledge.mjs`):
 *
 * 1. Its anatomy stamps at least one `data-contract` rule id, and every id it stamps is a canonical
 *    id of `packages/grammar/src/common/rule-catalog.generated.ts`.
 * 2. Every `starci-core-*` / `grammar-*` class it emits is selected by a rule in a shipped sheet
 *    (Common, Core, Heritage, Offset Pop), or is on `CONSUMER_HOOK_CLASSES` below: a stable name the
 *    package deliberately leaves unpainted for a consumer or a family to select, documented as such in
 *    the renderer that emits it.
 */

const root=fileURLToPath(new URL('..',import.meta.url));
const packageRoot=path.join(root,'packages','grammar');
const census=await censusGrammar({packageRoot});
const catalog=new Set(ruleCatalog(packageRoot).ids);

/**
 * Ids a renderer may stamp although the generated catalogue does not list them. The generator only
 * reads `PREFIX-n` headings, so `MARGIN-AUTO` (published by knowledge/ui/presentation/margin.yaml,
 * claimed by PageContainer for its `margin-inline: auto`) cannot be expressed there. Each entry must
 * still be a rule the knowledge tree publishes.
 */
const OUTSIDE_THE_GENERATED_CATALOGUE=Object.freeze({
  'MARGIN-AUTO':'knowledge/ui/presentation/margin.yaml',
});

const core=(...parts)=>`packages/grammar/src/core/${parts.join('/')}`;

/**
 * Classes a renderer emits on purpose with no Common paint. Two kinds:
 * - control identity: the root of a form control, painted as a whole by `.starci-core-field` or
 *   `.starci-core-choice`; the per-control name lets a consumer target one control kind by class.
 * - vendor slot: a HeroUI part whose vendor paint stands unchanged; the Grammar name lets a consumer
 *   select that part without reaching for vendor internals.
 * `documentedIn` is the renderer module whose doc comment names the class as a consumer hook.
 */
const CONSUMER_HOOK_CLASSES=Object.freeze({
  'starci-core-checkbox':{kind:'control identity',documentedIn:core('primitive','Checkbox','index.tsx')},
  'starci-core-radio':{kind:'control identity',documentedIn:core('composite','RadioGroup','index.tsx')},
  'starci-core-switch':{kind:'control identity',documentedIn:core('primitive','Switch','index.tsx')},
  'starci-core-choice-group':{kind:'control identity',documentedIn:core('composite','CheckboxGroup','index.tsx')},
  'starci-core-combo-box':{kind:'control identity',documentedIn:core('branch','ComboBox','index.tsx')},
  'starci-core-date-field':{kind:'control identity',documentedIn:core('primitive','DateField','index.tsx')},
  'starci-core-date-picker':{kind:'control identity',documentedIn:core('branch','DatePicker','index.tsx')},
  'starci-core-number-field':{kind:'control identity',documentedIn:core('primitive','NumberField','index.tsx')},
  'starci-core-search-field':{kind:'control identity',documentedIn:core('primitive','SearchField','index.tsx')},
  'starci-core-select':{kind:'control identity',documentedIn:core('branch','Select','index.tsx')},
  'starci-core-textarea':{kind:'control identity',documentedIn:core('primitive','Textarea','index.tsx')},
  'starci-core-time-field':{kind:'control identity',documentedIn:core('primitive','TimeField','index.tsx')},
  'starci-core-calendar-grid':{kind:'vendor slot',documentedIn:core('branch','DatePicker','index.tsx')},
  'starci-core-calendar-heading':{kind:'vendor slot',documentedIn:core('branch','Calendar','index.tsx')},
  'starci-core-calendar-weekday':{kind:'vendor slot',documentedIn:core('branch','Calendar','index.tsx')},
  'starci-core-date-popover':{kind:'vendor slot',documentedIn:core('branch','DatePicker','index.tsx')},
  'starci-core-date-suffix':{kind:'vendor slot',documentedIn:core('branch','DatePicker','index.tsx')},
  'starci-core-date-segment':{kind:'vendor slot',documentedIn:core('primitive','DateField','index.tsx')},
  'starci-core-list':{kind:'vendor slot',documentedIn:core('branch','Select','index.tsx')},
  'starci-core-list-popover':{kind:'vendor slot',documentedIn:core('branch','Select','index.tsx')},
  'starci-core-select-indicator':{kind:'vendor slot',documentedIn:core('branch','Select','index.tsx')},
  'starci-core-slider-track':{kind:'vendor slot',documentedIn:core('primitive','Slider','index.tsx')},
  'starci-core-slider-fill':{kind:'vendor slot',documentedIn:core('primitive','Slider','index.tsx')},
  'starci-core-data-table-body':{kind:'vendor slot',documentedIn:core('branch','DataTable','index.tsx')},
  'starci-core-data-table-sort':{kind:'vendor slot',documentedIn:core('branch','DataTable','index.tsx')},
  'starci-core-data-table-checkbox':{kind:'vendor slot',documentedIn:core('branch','DataTable','index.tsx')},
  'starci-core-disclosure-panel':{kind:'vendor slot',documentedIn:core('branch','Disclosure','index.tsx')},
  'starci-core-disclosure-body':{kind:'vendor slot',documentedIn:core('branch','Disclosure','index.tsx')},
  'starci-core-generic-accordion-root':{kind:'vendor slot',documentedIn:core('branch','Accordion','index.tsx')},
  'starci-core-generic-accordion-panel':{kind:'vendor slot',documentedIn:core('branch','Accordion','index.tsx')},
  'starci-core-generic-accordion-body':{kind:'vendor slot',documentedIn:core('branch','Accordion','index.tsx')},
  'starci-core-pagination-summary':{kind:'vendor slot',documentedIn:core('composite','Pagination','index.tsx')},
});

/** The doc comments of one source file, as plain text. */
const commentsOf=file=>(fs.readFileSync(path.join(root,file),'utf8').match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)??[]).join('\n');

/** Every token written inside a literal `data-contract="..."` anywhere in the package's renderer source. */
const literalContractTokens=()=>{
  const tokens=[];
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){if(!['stories','__test__','node_modules'].includes(entry.name))walk(full);continue;}
      if(!/\.tsx?$/.test(entry.name)||/\.(spec|test)\./.test(entry.name))continue;
      for(const m of fs.readFileSync(full,'utf8').matchAll(/data-contract="([^"]*)"/g)){
        for(const token of m[1].split(/\s+/).filter(Boolean))tokens.push({token,file:path.relative(root,full).replaceAll('\\','/')});
      }
    }
  };
  walk(path.join(packageRoot,'src','core'));
  return tokens;
};

const known=id=>catalog.has(id)||Object.hasOwn(OUTSIDE_THE_GENERATED_CATALOGUE,id);

test('the census reads the whole Common registry and the rule catalogue', ()=>{
  assert.ok(census.renderers.length>=95,`the registry holds ${census.renderers.length} renderers`);
  assert.ok(catalog.size>=150,`the catalogue holds ${catalog.size} ids`);
});

test('every Common renderer stamps at least one data-contract rule id on its anatomy', ()=>{
  const bare=census.renderers.filter(r=>r.claims.length+r.computedClaims.length===0).map(r=>`${r.group}/${r.component}`);
  assert.deepEqual(bare,[],`renderers that stamp no rule id:\n${bare.join('\n')}`);
});

test('every stamped rule id exists in the canonical catalogue', ()=>{
  const unknown=census.renderers.flatMap(r=>[...r.claims,...r.computedClaims].filter(id=>!known(id)).map(id=>`${r.component}: ${id}`));
  assert.deepEqual(unknown,[],`ids the catalogue does not publish:\n${unknown.join('\n')}`);
  // The census only credits ids whose prefix the catalogue knows; a literal with an invented family
  // (`LIST-1`, `TASTE-3`) would pass it silently, so every literal token is read here as well.
  const invented=literalContractTokens().filter(({token})=>!known(token)).map(({token,file})=>`${file}: ${token}`);
  assert.deepEqual(invented,[],`literal data-contract tokens outside the catalogue:\n${invented.join('\n')}`);
});

test('each id stamped outside the generated catalogue is still a rule the knowledge tree publishes', ()=>{
  for(const [id,file] of Object.entries(OUTSIDE_THE_GENERATED_CATALOGUE)){
    assert.equal(catalog.has(id),false,`${id} is in the catalogue now; drop it from the exception list`);
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),new RegExp(`rule: ${id}\\b`),`${file} no longer publishes ${id}`);
  }
});

test('every emitted class has a rule in a shipped sheet, or is a documented consumer hook', ()=>{
  const undocumented=census.unpaintedClasses.filter(cls=>!Object.hasOwn(CONSUMER_HOOK_CLASSES,cls))
    .map(cls=>`${cls} (${census.renderers.filter(r=>r.classes.includes(cls)).map(r=>r.component).join(', ')})`);
  assert.deepEqual(undocumented,[],`classes with no shipped rule and no consumer-hook entry:\n${undocumented.join('\n')}`);
});

test('the consumer-hook list is exact: each hook is emitted, unpainted, and documented where it is emitted', ()=>{
  const emitted=new Set(census.renderers.flatMap(r=>r.classes));
  const unpainted=new Set(census.unpaintedClasses);
  for(const [cls,{kind,documentedIn}] of Object.entries(CONSUMER_HOOK_CLASSES)){
    assert.ok(['control identity','vendor slot'].includes(kind),`${cls}: unknown hook kind ${kind}`);
    assert.ok(emitted.has(cls),`${cls} is no longer emitted; drop it from the consumer-hook list`);
    assert.ok(unpainted.has(cls),`${cls} now has a shipped rule; drop it from the consumer-hook list`);
    const docs=commentsOf(documentedIn);
    assert.match(docs,/consumer hook/i,`${documentedIn} documents no consumer hook`);
    assert.ok(docs.includes(`\`${cls}\``),`${documentedIn} does not name \`${cls}\` in its docs`);
  }
});
