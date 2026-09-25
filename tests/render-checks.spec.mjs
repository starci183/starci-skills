import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import {encodePng,screen,crc32} from './helpers/png.mjs';
import {
  CHECK_IDS,MIN_BUCKET_SHARE,PALETTE_TOLERANCE,RENDER_CHECKS,
  cardClassesOf,checkEntityListInCard,checkMascotSlot,checkPalette,decodePng,dominantColours,
  formatRenderChecks,renderChecksFor,runRenderChecks,scanMarkup,uiDirOf
} from '../scripts/checks/render.mjs';
import {decodePng as decodeWorkPng} from '../scripts/work/png.mjs';

const grammarRoot=fileURLToPath(new URL('../knowledge/grammars',import.meta.url));
const ACCENT='#7547ff';
const DANGER='#b3261e';
const FOREIGN='#12b886';

function temporary(t,label){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`starci-render-${label}-`));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
const write=(root,relative,body)=>{
  const file=path.join(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
  return file;
};

/** A brand whose primary and danger are the two colours every synthetic capture below is painted with. */
const brandSpec=({mascot=true}={})=>({
  rev:'brand-7',
  identity:{name:'StarCi',family:'starci',owner:'the founder'},
  color:{tokens:[
    {token:'--starci-core-accent',value:ACCENT,foreground:'#ffffff',role:'primary'},
    {token:'--starci-core-danger',value:DANGER,foreground:'#ffffff',role:'danger'},
    {token:'--starci-core-surface',value:'#ffffff',role:'surface'}],
    scales:[{name:'primary',steps:[{step:'500',value:ACCENT},{step:'700',value:'#5a2fe0'}]}],
    policy:{dangerMayMatchPrimary:false,minContrast:4.5}},
  typography:{family:'Inter'},
  ...(mascot?{mascot:{name:'Nova',assets:[{path:'brand/assets/mascot.svg',purpose:'Empty state companion'}],
    allowedIn:['Dashboard','empty states'],forbiddenIn:['error states'],rules:['never smaller than 48px']}}:{}),
  iconography:{set:['@heroicons/react']},
  imagery:{style:['calm']},
  forbidden:['gradient text'],
  sources:[{repository:'starci-fe',path:'styles/globals.css',kind:'css'}]
});

/** A Work tree carrying one brand record; `readBrandRecord` resolves either the tree or the repository root. */
function tree(t,{brand=brandSpec(),label='tree'}={}){
  const root=temporary(t,label);
  const work=path.join(root,'.starciwork');
  write(work,'brand/index.yaml',stringifyYaml({schema:'work/node@1',id:'brand',kind:'brand',required:true,state:'todo',
    rev:brand.rev,description:'Product brand record.',brand}));
  write(work,'brand/assets/mascot.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
  return {repoRoot:root,work};
}

const png=(bands,extra={})=>encodePng({...screen({width:24,height:24,bands,...extra}),filter:0});
const IN_BRAND=()=>png([{hex:ACCENT,rows:8},{hex:DANGER,rows:3}]);
const OFF_BRAND=()=>png([{hex:FOREIGN,rows:8},{hex:'#f59f00',rows:4}]);
const NO_PRIMARY=()=>png([{hex:DANGER,rows:8}]);

const CARD_LIST=`<main><div class="starci-core-surface-card"><h3>Courses</h3>
  <ul class="starci-core-surface-list"><li>Algebra</li><li>Calculus</li><li>Statistics</li></ul>
</div></main>`;
const SECTION_LIST=`<main><section><h2 class="starci-core-section-header">Courses</h2>
  <ul><li>Algebra</li><li>Calculus</li><li>Statistics</li></ul>
</section></main>`;
const CARD_ONE=`<main><div class="starci-core-surface-card"><h3>Streak</h3><ul><li>12 days</li></ul></div></main>`;

/** One ui node: the record, its captures and the markup kept beside each of them. */
function uiNode(t,{label='ui',assets=null,surfaces=null,artworkSlots=null,markup=CARD_LIST,capture=IN_BRAND()}={}){
  const root=temporary(t,label);
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets','dashboard-desktop.png'),capture);
  if(markup!==null)fs.writeFileSync(path.join(root,'assets','dashboard-desktop.html'),markup);
  const record={schema:'work/node@1',id:'ui',kind:'ui',required:true,state:'todo',description:'Dashboard design record.',
    assets:[{path:'assets/dashboard-desktop.png'}],
    ui:{status:'proposed',intent:'The dashboard main state.',
      surfaces:surfaces??[{name:'Dashboard',route:'/dashboard',purpose:'See the week',actors:['learner']}],
      states:[{name:'populated',trigger:'the week has data',behavior:'the bands render'}],
      accessibility:['every control is reachable by keyboard'],responsive:['one column below 768px'],
      assets:assets??[{path:'assets/dashboard-desktop.png',role:'Dashboard main state, desktop',
        provenance:'Captured by headless Chrome from the installed grammar.'}],
      observations:[],gaps:[],
      ...(artworkSlots?{artworkSlots}:{})}};
  fs.writeFileSync(path.join(root,'index.yaml'),stringifyYaml(record));
  return root;
}

const MASCOT_SLOT={id:'dashboard-companion',screen:'Dashboard',state:'populated',purpose:'The Nova mascot greets the learner',
  brief:'Nova waving beside the weekly goal',references:['brand/assets/mascot.svg']};

const outcome=(result,id)=>result.checks.filter(entry=>entry.id===id).map(entry=>entry.outcome);

/**
 * The decoder is the whole palette check: if it reads the bytes wrongly, every colour it reports is invented.
 * render.mjs reads captures with the runtime's one PNG decoder (scripts/work/png.mjs): each of the five filters
 * reconstructs the same picture as RGBA, and a file it cannot follow says so rather than returning something plausible.
 */
test('the decoder is scripts/work/png.mjs: exact RGBA pixels for every filter and capture shape, a refusal for what it cannot read',()=>{
  assert.equal(decodePng,decodeWorkPng,'one PNG decoder in the runtime');
  const rgbaOf=({width,height,channels,pixels})=>{
    const out=new Uint8Array(width*height*4);
    for(let i=0;i<width*height;i+=1){
      const px=Array.from(pixels.subarray(i*channels,(i+1)*channels));
      const [r,g,b,alpha]=channels===1?[px[0],px[0],px[0],255]:channels===2?[px[0],px[0],px[0],px[1]]:channels===3?[...px,255]:px;
      out.set([r,g,b,alpha],i*4);
    }
    return Buffer.from(out);
  };
  const image=screen({width:17,height:9,bands:[{hex:ACCENT,rows:3},{hex:DANGER,rows:2},{hex:'#101014',rows:1}]});
  for(const filter of [0,1,2,3,4]){
    const decoded=decodePng(encodePng({...image,filter}));
    assert.equal(decoded.width,17);
    assert.equal(decoded.height,9);
    assert.deepEqual(Buffer.from(decoded.data),rgbaOf(image),`filter ${filter} round-trips`);
  }
  // Alpha, greyscale and greyscale-with-alpha are the other three shapes a browser capture arrives in.
  const rgba=screen({width:5,height:4,channels:4,bands:[{hex:ACCENT,rows:2}]});
  assert.deepEqual(Buffer.from(decodePng(encodePng({...rgba,filter:3})).data),rgbaOf(rgba));
  const grey={width:4,height:3,channels:1,pixels:Uint8Array.from([0,40,80,120,160,200,240,255,10,20,30,40])};
  assert.deepEqual(Buffer.from(decodePng(encodePng({...grey,filter:2})).data),rgbaOf(grey));
  const greyAlpha={width:2,height:2,channels:2,pixels:Uint8Array.from([10,255,20,128,30,0,40,255])};
  assert.deepEqual(Buffer.from(decodePng(encodePng({...greyAlpha,filter:4})).data),rgbaOf(greyAlpha));

  assert.throws(()=>decodePng(Buffer.from('not a png at all')),/unsupported png: not a PNG signature/);
  assert.throws(()=>decodePng(Buffer.alloc(4)),/unsupported png: not a PNG signature/);
  assert.throws(()=>decodePng(encodePng({...image,filter:0,colourType:3})),/unsupported png: palette image without PLTE/);
  assert.throws(()=>decodePng(encodePng({...image,filter:0,interlace:1})),/unsupported png: interlaced/);
  const headerOnly=encodePng({...image,filter:0}).subarray(0,8+25);
  assert.throws(()=>decodePng(Buffer.concat([headerOnly,Buffer.alloc(4)])),/unsupported png: image data does not inflate/);
  // The CRC of the helper is the format's own: a chunk this decoder walked past is a chunk a browser wrote.
  assert.equal(crc32(Buffer.from('IEND','latin1')),0xae426082);
});

/**
 * A screen is mostly paper and ink. Only what a reader would call a colour is bucketed, so a palette verdict
 * is about the brand's colours and not about how much white the layout breathes.
 */
test('the dominant colours of a capture are its saturated pixels, bucketed in OKLab',()=>{
  const decoded=decodePng(png([{hex:ACCENT,rows:8},{hex:DANGER,rows:4},{hex:'#000000',rows:2},{hex:'#8a8a8a',rows:2}]));
  const found=dominantColours(decoded,{buckets:8});
  assert.equal(found.considered,24*24);
  assert.equal(found.saturated,24*12,'black, grey and the white page are not a palette');
  assert.deepEqual(found.map(bucket=>bucket.hex),[ACCENT,DANGER]);
  assert.deepEqual(found.map(bucket=>bucket.share),[0.6667,0.3333]);
  assert.equal(found.reduce((total,bucket)=>total+bucket.count,0),found.saturated);
  // A gradient of one hue collapses into the hue it is a gradient of, instead of reporting a hundred colours.
  const shaded=dominantColours(decodePng(png([{hex:'#7547ff',rows:4},{hex:'#7a4dff',rows:4},{hex:'#7040f8',rows:4}])),{buckets:8});
  assert.equal(shaded.length,1);
});

test('the palette of a capture is the brand tokens, and the primary has to be in it',t=>{
  const brand=brandSpec();
  const inBrand=checkPalette({png:decodePng(IN_BRAND()),brand});
  assert.deepEqual(inBrand.map(entry=>[entry.id,entry.outcome]),[['palette-off-brand','pass'],['primary-absent','pass']]);
  assert.equal(inBrand[0].evidence.tolerance,PALETTE_TOLERANCE);
  assert.equal(inBrand[0].evidence.minimumShare,MIN_BUCKET_SHARE);
  assert.match(inBrand[1].detail,/--starci-core-accent/);

  const foreign=checkPalette({png:decodePng(OFF_BRAND()),brand});
  assert.deepEqual(foreign.map(entry=>[entry.id,entry.outcome]),[['palette-off-brand','fail'],['primary-absent','fail']]);
  assert.deepEqual(foreign[0].evidence.offenders.map(entry=>entry.hex).sort(),[FOREIGN,'#f59f00'].sort());
  for(const offender of foreign[0].evidence.offenders){
    assert.ok(offender.nearest.startsWith('--')||offender.nearest.includes('/'),'every offender names the nearest brand colour');
    assert.ok(offender.deltaE>PALETTE_TOLERANCE);
  }
  assert.match(foreign[0].detail,new RegExp(FOREIGN));

  // A capture in the brand's own danger, with the primary nowhere: on-palette and still off-brand.
  const missing=checkPalette({png:decodePng(NO_PRIMARY()),brand});
  assert.deepEqual(missing.map(entry=>[entry.id,entry.outcome]),[['palette-off-brand','pass'],['primary-absent','fail']]);
  assert.match(missing[1].detail,/appears in no bucket/);

  // A scale step is as much the brand as the token it was derived from.
  const onScale=checkPalette({png:decodePng(png([{hex:'#5a2fe0',rows:6},{hex:ACCENT,rows:4}])),brand});
  assert.deepEqual(onScale.map(entry=>entry.outcome),['pass','pass']);

  // Both spellings of the call reach the same check: the options object, and the positional PNG.
  assert.deepEqual(checkPalette(decodePng(IN_BRAND()),{brand}).map(entry=>entry.outcome),['pass','pass']);

  // Nothing to compare against is a skip, never a pass.
  const bare=checkPalette({png:decodePng(IN_BRAND()),brand:{color:{tokens:[{token:'--x',value:'var(--y)',role:'primary'}]}}});
  assert.deepEqual(bare.map(entry=>entry.outcome),['skip','skip']);
  const blank=checkPalette({png:decodePng(png([])),brand});
  assert.deepEqual(blank.map(entry=>[entry.id,entry.outcome]),[['palette-off-brand','skip'],['primary-absent','fail']]);
  assert.match(blank[0].detail,/no saturated pixel/);
  assert.ok(t);
});

/**
 * COLLECTION-1 read from the markup: a list of entities belongs to a page section with a heading. The same
 * three rows inside a card is the defect the owner ruled on from a real render.
 */
test('a list of entities inside a card fails, the same list in a section passes, and one item in a card is a card',()=>{
  const failed=checkEntityListInCard(CARD_LIST,{family:'starci',grammarRoot});
  assert.equal(failed.outcome,'fail');
  assert.equal(failed.id,'entity-list-in-card');
  assert.equal(failed.evidence.inCards.length,1);
  assert.deepEqual({card:failed.evidence.inCards[0].card,items:failed.evidence.inCards[0].items,list:failed.evidence.inCards[0].list},
    {card:'starci-core-surface-card',items:3,list:'ul'});
  assert.match(failed.detail,/3 `li` items in a `ul` inside `starci-core-surface-card`/);

  assert.equal(checkEntityListInCard(SECTION_LIST,{family:'starci',grammarRoot}).outcome,'pass');
  assert.equal(checkEntityListInCard(SECTION_LIST,{family:'starci',grammarRoot}).evidence.inSections[0].section,'section');
  assert.equal(checkEntityListInCard(CARD_ONE,{family:'starci',grammarRoot}).outcome,'pass');

  // A table of rows and a run of divs sharing one class are lists too, wherever they hide in the card.
  const table=checkEntityListInCard(`<div class="starci-core-surface"><div><table><tbody>
    <tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr></tbody></table></div></div>`,{family:'starci',grammarRoot});
  assert.equal(table.outcome,'fail');
  assert.equal(table.evidence.inCards[0].list,'table');
  const divs=checkEntityListInCard(`<div class="starci-core-surface-card"><div>
    <div class="row">a</div><div class="row">b</div><div class="row">c</div></div></div>`,{family:'starci',grammarRoot});
  assert.equal(divs.outcome,'fail');
  assert.equal(divs.evidence.inCards[0].item,'row');

  // Nothing readable is a skip with the reason, never a pass.
  assert.equal(checkEntityListInCard('',{family:'starci',grammarRoot}).outcome,'skip');
  assert.equal(checkEntityListInCard(CARD_LIST,{family:'nobody',grammarRoot}).outcome,'skip');
  // The card classes come from the family's own DNA when the host carries it, and fall back when it does not.
  const known=cardClassesOf({family:'starci',grammarRoot});
  assert.ok(known.classes.includes('starci-core-surface-card')&&known.classes.includes('starci-core-surface'));
  assert.match(known.source,/DNA\.yaml$/);
  assert.deepEqual(cardClassesOf({family:'starci',grammarRoot:path.join(grammarRoot,'nowhere')}),
    {source:'fallback',classes:['starci-core-surface','starci-core-surface-card'],error:'the host carries no DNA snapshot for grammar family `starci`'});
});

test('the tag scanner survives markup a browser survived, and keeps the ancestry the check asks it for',()=>{
  const root=scanMarkup(`<!doctype html><!-- a comment --><div class='a b'><p>unclosed<span/></div></p><img src=x>`);
  assert.equal(root.children[0].tag,'div');
  assert.deepEqual(root.children[0].classes,['a','b']);
  // The unclosed `p` is closed by its ancestor's end tag, the stray `</p>` after it changes nothing, and what
  // follows belongs to the root - which is where a browser put the image too.
  assert.deepEqual(root.children.map(node=>node.tag),['div','img']);
  assert.deepEqual(root.children[0].children.map(node=>node.tag),['p']);
  assert.deepEqual(root.children[0].children[0].children.map(node=>node.tag),['span']);
  assert.equal(root.nodes,4);
  // A script's contents are not markup, and an attribute that merely spells `<` does not open an element.
  const guarded=scanMarkup('<div><script>if(a<b){}</script><b title="a > b">x</b></div>');
  assert.deepEqual(guarded.children[0].children.map(node=>node.tag),['script','b']);
});

test('the mascot has a slot exactly where the brand allows it',()=>{
  const brand=brandSpec();
  const record={ui:{artworkSlots:[MASCOT_SLOT]}};
  const dashboard={name:'Dashboard',route:'/dashboard'};
  assert.equal(checkMascotSlot({record,brand,screen:dashboard}).outcome,'pass');
  assert.equal(checkMascotSlot(record,{brand,screen:dashboard}).outcome,'pass','the positional spelling reaches the same check');
  const missing=checkMascotSlot({record:{ui:{artworkSlots:[{id:'hero',screen:'Dashboard',purpose:'A chart placeholder',brief:'A weekly bar chart'}]}},brand,screen:dashboard});
  assert.equal(missing.outcome,'fail');
  assert.equal(missing.id,'mascot-slot-missing');
  assert.match(missing.detail,/allows the mascot `Nova` on `Dashboard`/);
  assert.deepEqual(checkMascotSlot({record:{ui:{}},brand,screen:dashboard}).outcome,'fail');
  // A reference to the master names the mascot as well as its name does.
  assert.equal(checkMascotSlot({record:{ui:{artworkSlots:[{id:'hero',screen:'Dashboard',purpose:'A companion',brief:'waving',references:['brand/assets/mascot-front.png']}]}},brand,screen:dashboard}).outcome,'pass');
  // A surface the brand does not name, and a brand with no mascot, are skips: an allowance is not an obligation.
  assert.equal(checkMascotSlot({record,brand,screen:{name:'Checkout',route:'/checkout'}}).outcome,'skip');
  assert.equal(checkMascotSlot({record,brand:brandSpec({mascot:false}),screen:dashboard}).outcome,'skip');
  assert.equal(checkMascotSlot({record,brand:{mascot:{name:'Nova',allowedIn:[]}},screen:dashboard}).outcome,'skip');
});

test('a run over a ui node reads every candidate, its markup and the mascot slots of every surface',t=>{
  const {work,repoRoot}=tree(t);
  const clean=uiNode(t,{label:'clean',markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]});
  const result=runRenderChecks({uiDir:clean,brandTree:work,grammarRoot});
  assert.equal(result.schema,RENDER_CHECKS);
  assert.equal(result.ok,true);
  assert.deepEqual([...new Set(result.checks.map(entry=>entry.id))].sort(),[...CHECK_IDS].sort());
  assert.deepEqual(result.checks.map(entry=>entry.outcome),['pass','pass','pass','pass']);
  assert.equal(result.brand.family,'starci');
  assert.equal(result.brand.rev,'brand-7');
  assert.deepEqual(result.candidates.map(entry=>[entry.png,entry.markup,entry.decoded]),
    [['assets/dashboard-desktop.png','assets/dashboard-desktop.html',true]]);
  assert.equal(result.node.surfaces,1);
  // The repository root resolves to its own Work tree, exactly as the brand checks accept one.
  assert.equal(runRenderChecks({uiDir:clean,brandTree:repoRoot,grammarRoot}).ok,true);

  const broken=uiNode(t,{label:'broken',markup:CARD_LIST,capture:OFF_BRAND()});
  const failing=runRenderChecks({uiDir:broken,brandTree:work,grammarRoot});
  assert.equal(failing.ok,false);
  assert.deepEqual(failing.checks.filter(entry=>entry.outcome==='fail').map(entry=>entry.id).sort(),
    ['entity-list-in-card','mascot-slot-missing','palette-off-brand','primary-absent']);
  for(const entry of failing.checks)assert.ok(entry.detail.length>10,`${entry.id} says why`);

  // A candidate with no markup beside it leaves the structure rule unproven, and a skip is not a failure.
  const bare=uiNode(t,{label:'bare',markup:null,artworkSlots:[MASCOT_SLOT]});
  const unproven=runRenderChecks({uiDir:bare,brandTree:work,grammarRoot});
  assert.equal(unproven.ok,true);
  assert.deepEqual(outcome(unproven,'entity-list-in-card'),['skip']);
  assert.match(unproven.checks.find(entry=>entry.id==='entity-list-in-card').detail,/No markup is kept beside/);

  // A capture the decoder cannot read, and one the record declares but the node does not carry.
  const undecodable=uiNode(t,{label:'undecodable',markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]});
  fs.writeFileSync(path.join(undecodable,'assets','dashboard-desktop.png'),encodePng({...screen({width:4,height:4,bands:[{hex:ACCENT,rows:2}]}),filter:0,bitDepth:16}));
  const skipped=runRenderChecks({uiDir:undecodable,brandTree:work,grammarRoot});
  assert.equal(skipped.ok,true);
  assert.deepEqual(outcome(skipped,'palette-off-brand'),['skip']);
  assert.match(skipped.checks.find(entry=>entry.id==='palette-off-brand').detail,/could not be decoded: unsupported png: image data shorter than the header declares/);
  assert.equal(skipped.candidates[0].decoded,false);

  const absent=uiNode(t,{label:'absent',markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]});
  fs.rmSync(path.join(absent,'assets','dashboard-desktop.png'));
  assert.match(runRenderChecks({uiDir:absent,brandTree:work,grammarRoot}).checks[0].detail,/does not carry the declared capture/);

  // A record with no capture at all is three unproven claims, named as such.
  const empty=uiNode(t,{label:'empty',assets:[],artworkSlots:[MASCOT_SLOT]});
  const nothing=runRenderChecks({uiDir:empty,brandTree:work,grammarRoot});
  assert.equal(nothing.ok,true);
  assert.deepEqual(nothing.checks.map(entry=>entry.outcome),['skip','skip','skip','pass']);

  // A broken input is a throw, not a check: "no record" must never look like a drawing with nothing wrong.
  assert.throws(()=>runRenderChecks({uiDir:path.join(clean,'nowhere'),brandTree:work}),/No design record/);
  assert.throws(()=>runRenderChecks({uiDir:path.dirname(work),brandTree:work}),/No design record/);
  assert.throws(()=>runRenderChecks({brandTree:work}),/needs a ui node directory/);
  assert.throws(()=>runRenderChecks({uiDir:clean}),/needs the Work tree/);
  assert.throws(()=>runRenderChecks({uiDir:clean,brandTree:temporary(t,'no-brand')}),/No brand record/);

  assert.match(formatRenderChecks(result),/^render starci rev brand-7: 1 candidate, no failing check$/m);
  assert.match(formatRenderChecks(failing),/\[FAIL\] palette-off-brand:/);
  assert.match(formatRenderChecks(unproven),/\[skip\] entity-list-in-card:/);
});

/**
 * The kernel hands the module an operation and the files it wrote and expects a verdict or nothing. Nothing is
 * the honest answer for an operation that drew no screen: a green result there would report a drawing that
 * never happened as a drawing that passed.
 */
test('the kernel hook finds the ui node the operation wrote, and answers null when it wrote none',t=>{
  const {work}=tree(t,{label:'hook'});
  const node=path.join(work,'features','learning','ui','dashboard');
  fs.mkdirSync(path.dirname(node),{recursive:true});
  fs.cpSync(uiNode(t,{label:'hook-node',markup:CARD_LIST,artworkSlots:[MASCOT_SLOT]}),node,{recursive:true});
  const ctx={work:{at:{workRoot:work}}};
  const op={id:'op-1',kind:'interface.draw',allowlist:['features/learning/ui/dashboard/index.yaml']};
  const result=renderChecksFor({op,state:null,ctx,files:[]});
  assert.equal(result.ok,false);
  assert.deepEqual(result.checks.filter(entry=>entry.outcome==='fail').map(entry=>entry.id),['entity-list-in-card']);

  // The allowlist may be the folder, and the record may only be among the files the diff touched.
  assert.equal(renderChecksFor({op:{...op,allowlist:['features/learning/ui/dashboard/**']},ctx}).ok,false);
  assert.equal(renderChecksFor({op:{...op,allowlist:[]},ctx,files:['features/learning/ui/dashboard/index.yaml']}).ok,false);
  assert.equal(renderChecksFor({op:{id:'implement',kind:'frontend.implement',allowlist:['apps/core/src/dashboard.tsx'],references:['features/learning/ui/dashboard/index.yaml']},ctx}).ok,false,
    'the actual implementation follows its design reference rather than needing a UI path in its source allowlist');
  // A repository root instead of a Work root resolves the same tree.
  assert.equal(renderChecksFor({op,ctx:{work:{at:{repoRoot:path.dirname(work)}}}}).ok,false);
  assert.equal(renderChecksFor({op:{id:'repository-ref',kind:'frontend.implement',references:['.starciwork/features/learning/ui/dashboard/index.yaml']},ctx:{work:{at:{repoRoot:path.dirname(work)}}}}).ok,false,
    'repository-relative Work references do not resolve through a duplicate .starciwork namespace');
  const implementation=path.join(work,'features','learning','implementation','frontend','dashboard');
  fs.mkdirSync(path.dirname(implementation),{recursive:true});fs.cpSync(node,implementation,{recursive:true});
  const absolute=renderChecksFor({op:{id:'absolute-ref',kind:'frontend.implement',references:[path.join(node,'index.yaml')],
    allowlist:['features/learning/implementation/frontend/dashboard/assets/**']},ctx});
  assert.equal(absolute.ok,false);
  assert.deepEqual(absolute.checks.filter(entry=>entry.outcome==='fail').map(entry=>entry.id),['entity-list-in-card'],
    'an absolute UI reference resolves the real node and returns its actual render-check result');

  assert.equal(renderChecksFor({op:{id:'op-2',kind:'backend.implement',allowlist:['src/orders/intake.ts']},ctx}),null);
  assert.equal(renderChecksFor({op,ctx:{}}),null);
  assert.equal(renderChecksFor({op:{...op,allowlist:['features/learning/ui/nowhere/index.yaml']},ctx}),null);
  const missing=renderChecksFor({op:{id:'missing',kind:'frontend.implement',references:['features/learning/ui/nowhere/index.yaml']},ctx});
  assert.equal(missing.ok,false);assert.equal(missing.checks[0].id,'implementation-ui-input-missing');
  assert.equal(renderChecksFor(),null);
  assert.deepEqual([uiDirOf({op}),uiDirOf({op:{allowlist:['features/a/ui/**']}}),uiDirOf({op:{},files:['docs/a.md']})],
    ['features/learning/ui/dashboard','features/a/ui',null]);

  // A tree with no brand record leaves the claim unproven rather than passing or failing the drawing.
  const orphan=temporary(t,'orphan');
  fs.cpSync(node,path.join(orphan,'features','learning','ui','dashboard'),{recursive:true});
  const unavailable=renderChecksFor({op,ctx:{work:{at:{workRoot:orphan}}}});
  assert.equal(unavailable.ok,true);
  assert.deepEqual(unavailable.checks.map(entry=>[entry.id,entry.outcome]),[['render-checks-unavailable','skip']]);
  const implementationUnavailable=renderChecksFor({op:{...op,id:'implementation',kind:'frontend.implement'},ctx:{work:{at:{workRoot:orphan}}}});
  assert.equal(implementationUnavailable.ok,false);assert.deepEqual(implementationUnavailable.checks.map(entry=>entry.outcome),['fail']);
});

test('ImageGen directions are not misreported as exact browser render proof',t=>{
  const {work}=tree(t,{label:'imagegen-hook'}),node=path.join(work,'features','learning','ui','dashboard');
  fs.mkdirSync(path.dirname(node),{recursive:true});
  const generated=uiNode(t,{label:'imagegen-node',assets:[{path:'assets/dashboard-desktop.png',role:'Representative direction',
    provenance:'Generated through built-in ImageGen; not a running render.',generation:{tool:'image_gen.imagegen',promptPath:'assets/dashboard.prompt.txt',inputRefs:['business','sds','brand','grammar']}}]});
  fs.cpSync(generated,node,{recursive:true});
  const result=runRenderChecks({uiDir:node,brandTree:work,grammarRoot});assert.equal(result.node.generatedDirections,1);assert.equal(result.node.candidates,0);
  assert.equal(renderChecksFor({op:{id:'draw',kind:'interface.draw',allowlist:['features/learning/ui/dashboard/index.yaml']},ctx:{work:{at:{workRoot:work}}}}),null);
  const implementation=renderChecksFor({op:{id:'build',kind:'frontend.implement',references:['features/learning/ui/dashboard/index.yaml']},ctx:{work:{at:{workRoot:work}}}});
  assert.equal(implementation.ok,false);assert.equal(implementation.checks[0].id,'implementation-capture-owner-unbound');
});

test('capture classification is structural and cannot be changed by provenance wording',t=>{
  const {work}=tree(t,{label:'structural'}),node=uiNode(t,{label:'structural-node',assets:[{path:'assets/dashboard-desktop.png',role:'Dashboard',provenance:'artifact'}],markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]});
  assert.equal(runRenderChecks({uiDir:node,brandTree:work,grammarRoot}).node.candidates,1);
  const record=parseYaml(fs.readFileSync(path.join(node,'index.yaml'),'utf8'));record.ui.assets[0].generation={tool:'image_gen.imagegen',promptPath:'assets/prompt.txt',inputRefs:['brand']};fs.writeFileSync(path.join(node,'index.yaml'),stringifyYaml(record));
  assert.equal(runRenderChecks({uiDir:node,brandTree:work,grammarRoot}).node.candidates,0);
});

test('frontend implementation audits real captures from its implementation owner while reading the referenced ui design',t=>{
  const {work}=tree(t,{label:'implementation-owner'}),design=path.join(work,'features','learning','ui','dashboard');
  fs.mkdirSync(path.dirname(design),{recursive:true});fs.cpSync(uiNode(t,{label:'implementation-design',markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]}),design,{recursive:true});
  const implementation=path.join(work,'features','learning','implementation','frontend','dashboard');
  fs.mkdirSync(path.join(implementation,'assets'),{recursive:true});
  fs.copyFileSync(path.join(design,'assets','dashboard-desktop.png'),path.join(implementation,'assets','dashboard-desktop.png'));
  fs.copyFileSync(path.join(design,'assets','dashboard-desktop.html'),path.join(implementation,'assets','dashboard-desktop.html'));
  const op={id:'build',nodeId:'implementation-dashboard',kind:'frontend.implement',references:['features/learning/ui/dashboard/index.yaml'],
    allowlist:['apps/web/dashboard.tsx','.starciwork/features/learning/implementation/frontend/dashboard/assets/**']};
  const result=renderChecksFor({op,ctx:{work:{at:{workRoot:work},node:id=>id===op.nodeId?{path:'features/learning/implementation/frontend/dashboard/index.yaml'}:null}}});
  assert.equal(result.ok,true,JSON.stringify(result.checks));assert.deepEqual(result.checks.filter(item=>item.outcome==='pass').map(item=>item.id).sort(),CHECK_IDS.slice().sort());
});

test('the render check formats one line per check and fails when a check fails or the input is broken',t=>{
  const {work}=tree(t,{label:'cli'});
  const clean=uiNode(t,{label:'cli-clean',markup:SECTION_LIST,artworkSlots:[MASCOT_SLOT]});
  const broken=uiNode(t,{label:'cli-broken',markup:CARD_LIST,capture:OFF_BRAND()});

  const text=formatRenderChecks(runRenderChecks({uiDir:clean,brandTree:work}));
  for(const id of CHECK_IDS)assert.match(text,new RegExp(`\\[pass\\] ${id}:`),id);

  const parsed=runRenderChecks({uiDir:clean,brandTree:work});
  assert.equal(parsed.schema,RENDER_CHECKS);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.brand.family,'starci');

  const failed=runRenderChecks({uiDir:broken,brandTree:work});
  assert.equal(failed.ok,false);
  assert.deepEqual(failed.checks.filter(entry=>entry.outcome==='fail').map(entry=>entry.id).sort(),
    ['entity-list-in-card','mascot-slot-missing','palette-off-brand','primary-absent']);

  assert.equal(runRenderChecks({uiDir:clean,brandTree:work,family:'starci'}).ok,true);
  assert.throws(()=>runRenderChecks({}),/ui node directory/);
  assert.throws(()=>runRenderChecks({uiDir:clean}),/Work tree/,'the brand tree is not optional: nothing binds the palette without it');
  assert.throws(()=>runRenderChecks({uiDir:path.join(clean,'nowhere'),brandTree:work}),'a missing ui dir cannot be checked');
  assert.ok(zlib&&t);
});
