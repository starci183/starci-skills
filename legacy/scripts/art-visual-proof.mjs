import {inflateSync} from 'node:zlib';
const bad=message=>{throw Error('ART_VISUAL_PROOF_INVALID: '+message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function ids(actual,wanted,label){if(actual.length!==new Set(actual).size||actual.length!==wanted.length||wanted.some(x=>!actual.includes(x)))bad(label+' must cover exact frozen identities');}
// PNG transport decoding, not semantic transparency classification. The caller validates CRC,
// chunk structure and decompressed byte bounds through the existing PNG gate first.
export function rgbaPixels(bytes,pngShape){
 const {width,height}=pngShape(bytes);let at=8,header,palette,alpha,parts=[];
 while(at<bytes.length){const n=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8),data=bytes.subarray(at+8,at+8+n);if(type==='IHDR')header=data;if(type==='PLTE')palette=data;if(type==='tRNS')alpha=data;if(type==='IDAT')parts.push(data);at+=12+n;}
 const depth=header[8],color=header[9],channels={0:1,2:3,3:1,4:2,6:4}[color],raw=inflateSync(Buffer.concat(parts),{maxOutputLength:256*1024*1024}),out=Buffer.alloc(width*height*4),bpp=Math.max(1,Math.ceil(channels*depth/8));
 const passes=header[12]?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 let offset=0;
 for(const[x0,y0,dx,dy]of passes){
  const w=Math.max(0,Math.ceil((width-x0)/dx)),h=Math.max(0,Math.ceil((height-y0)/dy));if(!w||!h)continue;
  const stride=Math.ceil(w*channels*depth/8);let before=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
   const filter=raw[offset++],row=Buffer.from(raw.subarray(offset,offset+stride));offset+=stride;
   for(let i=0;i<stride;i++){const left=i>=bpp?row[i-bpp]:0,up=before[i],ul=i>=bpp?before[i-bpp]:0;row[i]=(row[i]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,ul)][filter])&255;}
   const sample=i=>depth===16?row.readUInt16BE(i*2):depth===8?row[i]:(row[Math.floor(i*depth/8)]>>(8-depth-(i*depth%8)))&((1<<depth)-1);
   const scale=n=>Math.round(n*255/(2**depth-1));
   for(let x=0;x<w;x++){const base=x*channels,s=Array.from({length:channels},(_,i)=>sample(base+i));let r,g,b,a=255;
    if(color===3){if(s[0]*3+2>=palette.length)bad('palette index exceeds actual palette');[r,g,b]=palette.subarray(s[0]*3,s[0]*3+3);a=alpha?.[s[0]]??255;}
    else if(color===0||color===4){r=g=b=scale(s[0]);if(color===4)a=scale(s[1]);else if(alpha?.length===2&&s[0]===alpha.readUInt16BE())a=0;}
    else{[r,g,b]=s.slice(0,3).map(scale);if(color===6)a=scale(s[3]);else if(alpha?.length===6&&s.slice(0,3).every((v,i)=>v===alpha.readUInt16BE(i*2)))a=0;}
    out.set([r,g,b,a],((y0+y*dy)*width+x0+x*dx)*4);
   }
   before=row;
  }
 }
 return{width,height,pixels:out};
}
export function visualBrief(brief){
 if(!brief.visual)bad('missing frozen visual element and independent asset manifest');
 const {assets,elements}=brief.visual,regions=brief.regions.map(r=>r.id),viewports=brief.surface.viewports.map(v=>v.id);
 ids(assets.map(a=>a.id),[...new Set(assets.map(a=>a.id))],'assets');ids(elements.map(e=>e.id),[...new Set(elements.map(e=>e.id))],'elements');
 for(const region of regions)if(!elements.some(e=>e.region===region))bad('required region has no explicit anatomy');
 for(const asset of assets){if(!regions.includes(asset.region))bad('asset has a foreign region');if(asset.medium!=='raster'&&asset.transparency==='required')bad('raster transparency proof cannot describe a code-native asset');if(asset.transparency==='required'&&!asset.preservedAreas.length)bad('transparent extraction must identify preserved subject areas');ids(asset.transparentAreas.map(a=>a.id),[...new Set(asset.transparentAreas.map(a=>a.id))],'transparent areas');ids(asset.preservedAreas.map(a=>a.id),[...new Set(asset.preservedAreas.map(a=>a.id))],'preserved areas');}
 for(const element of elements){
  if(!regions.includes(element.region))bad('element has a foreign region');
  ids(element.dimensions.map(d=>d.viewport),viewports,'responsive dimension expectations');
  for(const d of element.dimensions)if(d.width[0]>d.width[1]||d.height[0]>d.height[1])bad('reversed dimension bounds');
  if(element.kind==='asset'){if(!assets.some(a=>a.id===element.asset&&a.region===element.region))bad('anatomy asset has no independent manifest member');}
  else if(element.asset!==null)bad('native control/icon/connector cannot be flattened into raster art');
  if(element.kind==='icon'){if(!element.registry||!element.registry.source.ref.startsWith('knowledge/'))bad('semantic icon must map to a bound registry identity');}
  else if(element.registry!==null)bad('only a semantic icon names a registry glyph');
  if(element.kind==='connector'){if(element.connects.length<2||element.connects.some(id=>id===element.id||!elements.some(e=>e.id===id)))bad('connector requires actual code-native endpoint identities');}
  else if(element.connects.length)bad('only code-native connectors join endpoints');
 }
 for(const asset of assets)if(!elements.some(e=>e.asset===asset.id))bad('unmapped independent asset');
}
export function visualCandidate(brief,candidate){
 if(!brief.visual)bad('missing frozen visual contract');
 ids(candidate.assets.map(a=>a.id),brief.visual.assets.map(a=>a.id),'separately usable assets');
 for(const asset of candidate.assets){const wanted=brief.visual.assets.find(a=>a.id===asset.id);if(asset.region!==wanted.region||asset.subject!==wanted.subject)bad('independent asset identity or subject changed');}
 ids(candidate.anatomy?.map(a=>a.element)??[],brief.visual.elements.map(e=>e.id),'PNG anatomy anchors');
 for(const {bounds:b}of candidate.anatomy)if(b.x+b.width>candidate.png.width||b.y+b.height>candidate.png.height)bad('anatomy anchor leaves selected PNG');
}
export function transparencyProof(asset,declared,branch,io){
 const proof=asset.transparencyReview;if(!proof)bad('missing multi-background transparency review');
 if(proof.assetHash!==asset.sha256)bad('transparency review is stale for this asset');
 const source=rgbaPixels(io.verified(branch,asset),io.pngShape);
 if(!source.pixels.some((v,i)=>i%4===3&&v<255))bad('declared transparent asset is wholly opaque');
 if(io.hash(io.reference(declared.reference))!==proof.referenceHash)bad('subject preservation is not bound to the pre-extraction reference');
 for(const[name,background]of [['black',[0,0,0]],['white',[255,255,255]],['chromatic',[255,0,255]]]){
  const composite=rgbaPixels(io.verified(branch,proof[name]),io.pngShape);
  if(composite.width!==source.width||composite.height!==source.height)bad('composite dimensions differ from actual asset');
  for(let i=0;i<source.pixels.length;i+=4){
   if(composite.pixels[i+3]!==255)bad('review composite is not opaque');
   for(let c=0;c<3;c++)if(composite.pixels[i+c]!==Math.round((source.pixels[i+c]*source.pixels[i+3]+background[c]*(255-source.pixels[i+3]))/255))bad('review composite is not derived from exact asset pixels');
  }
 }
 ids(proof.enclosed.map(r=>r.id),declared.transparentAreas.map(r=>r.id),'enclosed transparency review');
 ids(proof.preserved.map(r=>r.id),declared.preservedAreas.map(r=>r.id),'preserved subject review');
 if([proof.outer,proof.subject,proof.silhouette,proof.edges,...proof.enclosed,...proof.preserved].some(r=>r.verdict!=='pass'))bad('matte contamination or subject/silhouette/edge damage remains unresolved');
 for(const area of [...declared.transparentAreas,...declared.preservedAreas]){const b=area.bounds;if(b.x+b.width>source.width||b.y+b.height>source.height)bad('enclosed/preserved review bounds leave asset');}
}
export function visualAdoption(brief,candidate,adoption,branch,io){
 ids(adoption.elements?.map(e=>e.element)??[],brief.visual.elements.map(e=>e.id),'implemented anatomy');
 for(const item of adoption.elements){
  const wanted=brief.visual.elements.find(e=>e.id===item.element);
  if(item.asset!==wanted.asset||!equal(item.registry,wanted.registry))bad('implemented asset/icon semantics differ from frozen element');
  if(io.hash(io.source(item.source.path))!==item.source.sha256)bad('element implementation differs from actual committed source');
 }
 if(new Set(adoption.assets.map(a=>a.ref)).size!==adoption.assets.length)bad('independent assets cannot be replaced by a shared strip');
 for(const asset of adoption.assets)if(adoption.assets.some(other=>other.id!==asset.id&&other.sha256===asset.sha256&&brief.visual.assets.find(a=>a.id===other.id)?.subject!==brief.visual.assets.find(a=>a.id===asset.id)?.subject))bad('different independent subjects cannot be copies of the same raster');
 for(const asset of adoption.assets){const declared=brief.visual.assets.find(a=>a.id===asset.id);if(!declared)bad('unrequested asset');if(declared.transparency==='required')transparencyProof(asset,declared,branch,io);}
}
export function visualFidelity(brief,candidate,fidelity,response,branch,io,axes){
 const captures=(response.fields.capture??[]).map(ref=>io.read(branch,ref)),verdicts=io.read(branch,response.fields.verdicts);
 const keys=[];
 for(const element of brief.visual.elements)for(const viewport of brief.surface.viewports)for(const state of brief.regions.find(r=>r.id===element.region).states)for(const axis of axes)keys.push([element.id,viewport.id,state,axis].join(':'));
 const actual=[];
 for(const check of fidelity.checks??[]){
  const element=brief.visual.elements.find(e=>e.id===check.element),capture=captures.find(c=>c.matrixId===check.matrixId);if(!element||!capture)bad('visual check has no expected element or actual capture');
  const viewport=brief.surface.viewports.find(v=>v.width===capture.viewport[0]&&v.height===capture.viewport[1]);if(!viewport)bad('visual check has no frozen viewport');
  actual.push([element.id,viewport.id,capture.state,check.axis].join(':'));
  if(check.capture.ref!=='response/artifacts/'+check.matrixId+'.png'||!(response.fields.screenshot??[]).includes(check.capture.ref))bad('visual check is not its declared measured screenshot');io.pngShape(io.verified(branch,check.capture));
  const result=verdicts.entries.find(e=>e.matrixId===check.matrixId)?.results.find(r=>r.path===check.path&&r.rule===check.rule);
  if(!result||check.verdict!==result.verdict)bad('visual check is not in the actual owner-routed verdict');
  if(check.measurement.ref!==capture.driver?.measurementsRef)bad('dimension evidence is not the measured capture record');
  const measured=io.read(branch,check.measurement.ref).elements.find(e=>e.ref===check.measurement.element);
  if(!measured||check.path!==measured.ref||!equal(measured.bbox,check.measurement.bbox))bad('visual dimensions were not actually measured for the judged node');
  const bounds=element.dimensions.find(d=>d.viewport===viewport.id);
  if(check.verdict==='pass'&&check.axis==='dimensions'&&(['width','height'].some(key=>measured.bbox[key]<bounds[key][0]||measured.bbox[key]>bounds[key][1])))bad('passing dimensions are outside the frozen PNG/responsive expectation');
  if(![capture.driver?.walkRef,capture.driver?.resultRef].includes(check.evidence.ref))bad('visual/motion review requires the actual capture walk or result');io.verified(branch,check.evidence);
 }
 ids(actual,keys,'anatomy/dimensions/responsive/motion/semantic matrix');
 if(fidelity.verdict==='pass'&&(fidelity.checks??[]).some(c=>c.verdict!=='pass'))bad('fidelity hides a failed required element');
}
