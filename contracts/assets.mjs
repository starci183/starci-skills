const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=message=>{throw Error(message);};
const shape=(x,keys)=>{if(!object(x)||keys.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!keys.includes(k)))fail('Invalid asset manifest fields');};
const text=x=>{if(typeof x!=='string'||!x.trim())fail('Asset text is required');};
const texts=xs=>{if(!Array.isArray(xs)||new Set(xs).size!==xs.length)fail('Invalid asset identity array');xs.forEach(text);};
export function validateAssets(manifest,{drawIds,allowDeferred=false,imageGeneration=true}={}) {
  shape(manifest,['reviewedDrawIds','items']);texts(manifest.reviewedDrawIds);
  if(drawIds&&(JSON.stringify([...manifest.reviewedDrawIds].sort())!==JSON.stringify([...drawIds].sort())))fail('Asset inventory must cover every input draw');
  if(!Array.isArray(manifest.items))fail('Asset inventory required');
  const ids=new Set();
  for(const asset of manifest.items) {
    shape(asset,['id','drawIds','usage','requiredForFlow','status','sourcePath','artifact','provenance','brief']);
    text(asset.id);if(ids.has(asset.id))fail('Duplicate asset');ids.add(asset.id);
    texts(asset.drawIds);if(!asset.drawIds.length||asset.drawIds.some(id=>!manifest.reviewedDrawIds.includes(id)))fail('Unbound asset draw');
    text(asset.usage);text(asset.provenance);if(typeof asset.requiredForFlow!=='boolean')fail('Asset functional requirement must be explicit');
    if(!['reused','generated','deferred'].includes(asset.status))fail('Unknown asset status');
    if(asset.status==='deferred') {
      if(!allowDeferred||asset.requiredForFlow||asset.sourcePath!==null||asset.artifact!==null)fail('Deferred asset cannot satisfy required artwork or claim a file');
      shape(asset.brief,['prompt','width','height','format','placement','placeholder']);
      for(const k of ['prompt','format','placement'])text(asset.brief[k]);
      if(asset.brief.placeholder!=='blank-reserved-slot'||!Number.isInteger(asset.brief.width)||asset.brief.width<1||!Number.isInteger(asset.brief.height)||asset.brief.height<1)fail('Deferred asset needs a blank slot and concrete dimensions');
    } else {
      text(asset.sourcePath);text(asset.artifact);
      if(asset.sourcePath.startsWith('/')||asset.sourcePath.includes('\\')||asset.sourcePath.includes(':')||asset.sourcePath.split('/').some(x=>!x||x==='..'||x==='.'))fail('Asset must have a safe repository-relative source path');
      if(asset.brief!==null)fail('Ready asset cannot retain a pending brief');
      // This flag governs AI raster generation. Code-native artwork is identified by provenance.
      if(asset.status==='generated'&&!imageGeneration&&!asset.provenance.startsWith('code-native:'))fail('Selected profile cannot claim AI-generated artwork');
    }
  }
  return true;
}
