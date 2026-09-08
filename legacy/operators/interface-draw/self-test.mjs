// Mechanical PNG/provenance gate fixture, not an ImageGen run or product visual proof.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {artHash,artDecisionId,artResponseErrors,pngShape} from '../../scripts/art-direction.mjs';
const root=path.resolve(import.meta.dirname,'../..');
export async function selfTest(){
 const branch=mkdtempSync(path.join(tmpdir(),'art-direction-gate-')),put=(ref,value)=>{const file=path.join(branch,ref);mkdirSync(path.dirname(file),{recursive:true});const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');writeFileSync(file,bytes);return{ref,sha256:artHash(bytes)};};
 try{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOw6dn3HwAFFAKGSpcEGQAAAABJRU5ErkJggg==','base64');
  // Real PNG container bytes are the fixture; no visual quality or generation provenance is claimed.
  const image=put('response/artifacts/module.png',png),concept={id:'focused-module',centralIdea:'Make the next allowed action clear.'},grammar={family:'starci',version:'fixture',manifestHash:artHash('manifest'),adoption:[{region:'main',component:'published',authority:{ref:'request/rule.txt',sha256:artHash('rule')},limits:'Geometry belongs to Grammar.'}]};
  const brief={target:'module-dashboard',route:'/module',concepts:[concept],grammar,regions:[{id:'main'}],imageryPlan:[],visual:{assets:[],elements:[{id:'surface'}]}},briefRef=put('request/art-direction-brief.json',brief),briefBytes=Buffer.from(JSON.stringify(brief,null,2)+'\n');
  const prompt=put('response/artifacts/module.prompt.txt',briefBytes.toString()+'\nConcept: '+JSON.stringify(concept));
  const request={sessionId:'fixture',step:1,parallel:1,expected:{goalVersion:1},requirements:{target:'module-dashboard',compare:'no'},contexts:[{alias:'@workspaces/fe',head:'a'.repeat(40)}]};
  const bundle={version:1,target:brief.target,route:brief.route,goalVersion:1,brief:briefRef,source:request.contexts[0],grammar,candidates:[{id:'module',concept:concept.id,title:'Focused module',rationale:'Expose the approved primary action.',limits:['Fixture bytes do not prove design quality.'],prompt,generation:{tool:'@tools/imagegen',sourceRef:'fixture:mechanical-provenance-only',inputHash:briefRef.sha256},png:{...image,width:1,height:1},regions:[{region:'main',realization:'One primary region',grammarCompatibility:'Published geometry retained'}],assets:[],anatomy:[{element:'surface',bounds:{x:0,y:0,width:1,height:1}}]}],selected:'module',decisionId:artDecisionId(request,briefBytes)};
  const ref='response/data/art-direction.json',response={status:'done',fields:{'frontend-art-direction':ref,'art-direction-png':[image.ref]},outcome:{primary:{kind:'image',ref:image.ref}}};put(ref,bundle);
  assert.deepEqual(pngShape(png),{width:1,height:1});
  assert.deepEqual(await artResponseErrors(root,branch,request,response),[]);
  const probe=async(change,pattern)=>{const changed=structuredClone(bundle);change(changed);put(ref,changed);assert.ok((await artResponseErrors(root,branch,request,response)).some(error=>pattern.test(error)));put(ref,bundle);};
  await probe(value=>value.candidates.push({...value.candidates[0],id:'other'}),/default is one/);
  await probe(value=>value.candidates[0].png.sha256=artHash('changed'),/changed artifact/);
  await probe(value=>value.candidates[0].concept='unbound',/frozen concept/);
  await probe(value=>value.candidates[0].regions=[],/short|exact declared/);
  const bad=Buffer.from(png);bad[bad.length-1]^=1;assert.throws(()=>pngShape(bad),/checksum/);
  assert.throws(()=>pngShape(Buffer.from('<html>not a drawing</html>')),/not a PNG/);
  return{valid:1,negative:6};
 }finally{rmSync(branch,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))selfTest().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
