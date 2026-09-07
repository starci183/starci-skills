// Synthetic transport/measurement records test the refusal protocol, not product visual quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {artHash,pngShape} from './art-direction.mjs';
import {visualBrief,visualCandidate,visualAdoption,visualFidelity,transparencyProof,rgbaPixels} from './art-visual-proof.mjs';
import {validateAgainst} from './json-schema.mjs';
function png(pixels,width=3,height=3){
 const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(kind,data)=>{const b=Buffer.concat([Buffer.from(kind),data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);b.copy(out,4);out.writeUInt32BE(crc(b),out.length-4);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const rows=[];for(let y=0;y<height;y++)rows.push(Buffer.from([0]),Buffer.from(pixels.slice(y*width*4,(y+1)*width*4)));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
function specimen(){
 const map=new Map(),put=(ref,bytes)=>{map.set(ref,bytes);return{ref,sha256:artHash(bytes)};};
 const io={hash:artHash,pngShape,verified:(_branch,item)=>{const bytes=map.get(item.ref);assert.ok(bytes,'evidence exists');assert.equal(artHash(bytes),item.sha256,'exact evidence hash');return bytes;},reference:item=>map.get(item.ref),source:()=>Buffer.from('actual source fixture')};
 const pixels=Array.from({length:36},(_,i)=>i%4===3?0:255);pixels.splice(16,4,255,255,255,255);
 const asset={id:'figure',region:'main',...put('figure.png',png(pixels)),alt:'Synthetic subject'},pass={verdict:'pass',observation:'Explicit synthetic reviewer attestation, not an image recognition claim.'};
 const declared={id:'figure',region:'main',subject:'Subject',medium:'raster',transparency:'required',reference:put('original.png',png(pixels)),transparentAreas:[{id:'enclosed',bounds:{x:0,y:0,width:1,height:1}}],preservedAreas:[{id:'body',bounds:{x:1,y:1,width:1,height:1}}]};
 const review={assetHash:asset.sha256,referenceHash:declared.reference.sha256,reviewer:'fixture:review-of-composites',outer:pass,subject:pass,silhouette:pass,edges:pass,enclosed:[{id:'enclosed',...pass}],preserved:[{id:'body',...pass}]};
 for(const[name,bg]of [['black',[0,0,0]],['white',[255,255,255]],['chromatic',[255,0,255]]]){const combined=[];for(let i=0;i<pixels.length;i+=4)combined.push(...bg.map((b,c)=>Math.round((pixels[i+c]*pixels[i+3]+b*(255-pixels[i+3]))/255)),255);review[name]=put(name+'.png',png(combined));}
 asset.transparencyReview=review;
 return{io,map,put,pixels,asset,declared,review,pass};
}
test('transparent assets require exact contrasting composites, enclosed cleanup and original subject preservation',()=>{
 const f=specimen();assert.deepEqual([...rgbaPixels(f.map.get('figure.png'),pngShape).pixels],f.pixels);assert.doesNotThrow(()=>transparencyProof(f.asset,f.declared,'',f.io));
 const mutate=(change,pattern)=>{const asset=structuredClone(f.asset);change(asset.transparencyReview);assert.throws(()=>transparencyProof(asset,f.declared,'',f.io),pattern);};
 mutate(p=>p.assetHash=artHash('old'),/stale/);
 mutate(p=>p.referenceHash=artHash('different reference'),/pre-extraction/);
 mutate(p=>p.black=p.white,/not derived/);
 mutate(p=>p.enclosed=[],/exact frozen/);
 mutate(p=>p.enclosed[0].verdict='fail',/contamination/);
 mutate(p=>p.subject.verdict='fail',/subject/);
 mutate(p=>p.preserved[0].verdict='fail',/damage/);
 const damaged=Buffer.from(f.map.get('black.png'));damaged[damaged.length-1]^=1;f.map.set('black.png',damaged);assert.throws(()=>transparencyProof(f.asset,f.declared,'',f.io),/exact evidence hash/);
});
function briefFixture(){
 const asset=id=>({id,region:'main',subject:id,medium:'raster',transparency:'opaque',reference:{ref:'request/original.png',sha256:artHash('original')},transparentAreas:[],preservedAreas:[]});
 const element=(id,kind='asset')=>({id,region:'main',kind,purpose:id,asset:kind==='asset'?id:null,registry:kind==='icon'?{name:'verify',meaning:'Verified outcome',source:{ref:'knowledge/grammars/family/icons.json',sha256:artHash('registry')}}:null,connects:kind==='connector'?['actor','agent']:[],anatomy:'Bound original anatomy',dimensions:[{viewport:'wide',width:[20,100],height:[20,100]}],responsive:'Bound responsive intent',motion:'Static or explicit reduced motion'});
 return{regions:[{id:'main',states:['loaded']}],surface:{viewports:[{id:'wide',width:1440,height:900}]},visual:{assets:['actor','agent','system'].map(asset),elements:['actor','agent','system'].map(id=>element(id)).concat(element('link','connector'),element('status','icon'))}};
}
test('frozen independent assets and native connector/icon anatomy cannot collapse into a strip or substitute a glyph',()=>{
 const brief=briefFixture();assert.doesNotThrow(()=>visualBrief(brief));
 const candidate={png:{width:1440,height:900},assets:brief.visual.assets.map(a=>({id:a.id,subject:a.subject,region:a.region})),anatomy:brief.visual.elements.map(e=>({element:e.id,bounds:{x:0,y:0,width:100,height:100}}))};
 assert.doesNotThrow(()=>visualCandidate(brief,candidate));
 const strip=structuredClone(candidate);strip.assets=[{id:'strip',subject:'all',region:'main'}];assert.throws(()=>visualCandidate(brief,strip),/exact frozen/);
 const flattened=structuredClone(brief);flattened.visual.elements.find(e=>e.id==='link').asset='actor';assert.throws(()=>visualBrief(flattened),/flattened/);
 const foreign=structuredClone(brief);foreign.visual.elements.at(-1).registry.source.ref='request/random-symbol.svg';assert.throws(()=>visualBrief(foreign),/bound registry/);
 const fixture=specimen(),adoption={elements:brief.visual.elements.map(e=>({element:e.id,source:{path:'surface.tsx',sha256:artHash('actual source fixture')},asset:e.asset,registry:e.registry})),assets:brief.visual.assets.map(a=>({id:a.id,ref:a.id+'.png',sha256:artHash(a.id)}))};
 assert.doesNotThrow(()=>visualAdoption(brief,candidate,adoption,'',fixture.io));
 adoption.assets[1].ref=adoption.assets[0].ref;assert.throws(()=>visualAdoption(brief,candidate,adoption,'',fixture.io),/shared strip/);adoption.assets[1].ref='agent.png';
 adoption.assets[1].sha256=adoption.assets[0].sha256;assert.throws(()=>visualAdoption(brief,candidate,adoption,'',fixture.io),/same raster/);adoption.assets[1].sha256=artHash('agent');
 adoption.elements.at(-1).registry=structuredClone(adoption.elements.at(-1).registry);adoption.elements.at(-1).registry.name='circle';assert.throws(()=>visualAdoption(brief,candidate,adoption,'',fixture.io),/icon semantics/);
});
test('fidelity refuses overflow-only rows, wrong element measurements, stale captures and out-of-bounds geometry',()=>{
 const f=specimen(),brief=briefFixture();brief.visual.assets=[];brief.visual.elements=[{...brief.visual.elements[0],kind:'control',asset:null}];
 const axes=['anatomy','dimensions','responsive','motion','semantics'],capture={matrixId:'wide',viewport:[1440,900],state:'loaded',driver:{measurementsRef:'measured.json',walkRef:'walk.json',resultRef:'result.json'}},bbox={x:0,y:0,width:50,height:50};
 f.map.set('capture.json',Buffer.from(JSON.stringify(capture)));f.map.set('measured.json',Buffer.from(JSON.stringify({elements:[{ref:'button "Act"',bbox}]})));f.map.set('verdicts.json',Buffer.from(JSON.stringify({entries:[{matrixId:'wide',results:[{path:'button "Act"',rule:'A11Y-1',verdict:'pass'}]}]})));
 const screenshot=f.put('response/artifacts/wide.png',f.map.get('black.png')),evidence=f.put('result.json',Buffer.from('actual fixture walk result')),response={fields:{capture:['capture.json'],screenshot:[screenshot.ref],verdicts:'verdicts.json'}};
 const checks=axes.map(axis=>({element:'actor',axis,matrixId:'wide',path:'button "Act"',rule:'A11Y-1',capture:screenshot,measurement:{ref:'measured.json',element:'button "Act"',bbox},evidence,verdict:'pass',observation:'Synthetic evidence-join assertion only.'})),fidelity={checks,verdict:'pass'},io={...f.io,read:(_branch,ref)=>JSON.parse(f.map.get(ref))};
 assert.doesNotThrow(()=>visualFidelity(brief,{},fidelity,response,'',io,axes));
 assert.throws(()=>visualFidelity(brief,{}, {...fidelity,checks:checks.filter(c=>c.axis==='responsive')},response,'',io,axes),/exact frozen/);
 const wrong=structuredClone(fidelity);wrong.checks[0].measurement.bbox.width=49;assert.throws(()=>visualFidelity(brief,{},wrong,response,'',io,axes),/actually measured/);
 const huge=structuredClone(brief);huge.visual.elements[0].dimensions[0].width=[200,300];assert.throws(()=>visualFidelity(huge,{},fidelity,response,'',io,axes),/outside the frozen/);
 const stale=structuredClone(fidelity);stale.checks[0].capture.ref='response/artifacts/other.png';assert.throws(()=>visualFidelity(brief,{},stale,response,'',io,axes),/measured screenshot/);
});
test('closed contracts require the visual manifest and composite reviewer evidence',()=>{
 const schema=JSON.parse(readFileSync(new URL('../templates/kinds/art-direction-brief.schema.json',import.meta.url)));assert.ok(validateAgainst(schema,{}).some(e=>e.includes('visual')));
 const assetSchema=JSON.parse(readFileSync(new URL('../templates/kinds/art-direction-adoption.schema.json',import.meta.url))).properties.assets.items.properties.transparencyReview;
 const f=specimen();assert.deepEqual(validateAgainst(assetSchema,f.review),[]);
 for(const key of ['black','white','chromatic','subject','silhouette','edges','enclosed','preserved','referenceHash']){const absent=structuredClone(f.review);delete absent[key];assert.ok(validateAgainst(assetSchema,absent).length,key);}
 const anchor=JSON.parse(readFileSync(new URL('../templates/kinds/frontend-art-direction.schema.json',import.meta.url))).properties.candidates.items.properties.anatomy.items;
 assert.ok(validateAgainst(anchor,{element:'surface',bounds:{x:0,y:0,width:0,height:1}}).length,'empty PNG anatomy is not a valid anchor');
});
