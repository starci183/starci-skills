import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const registry=read('./registry.json');
const runtimes=Object.fromEntries(registry.runtimes.map(name=>[name,read(`./${name}.json`)]));
/** Select policy only; never switch models, dispatch workers or grant tools. */
export function selectProfile({runtime,op,profile,model=null,imageGenerationAvailable=false}) {
  runtime=registry.aliases[runtime]??runtime;
  if(!Object.hasOwn(runtimes,runtime)||typeof op!=='string'||!op||typeof imageGenerationAvailable!=='boolean'||(model!==null&&(typeof model!=='string'||!model.trim())))throw Error('Invalid runtime/profile selection');
  const role=registry.reasoningOps.includes(op)?'reasoning':'working';
  const id=profile??registry.defaults[runtime][role];
  if(!Object.hasOwn(runtimes[runtime].profiles,id))throw Error('Unknown or retired profile');
  const selected=runtimes[runtime].profiles[id];
  if(selected.role!==role)throw Error('Profile role does not own this operator');
  return {runtime,profile:id,role,model,imageGeneration:selected.imageGeneration&&imageGenerationAvailable,allowDeferredArtwork:runtime==='claude'&&!selected.imageGeneration};
}
