// brand-value-source.mjs - how a colour token the app has not written yet is traced (brand.mjs tokens-match-source). Two forms:
//   {path, value, token?, line?, sha256?}  the reference render the value was read from: the file is read, never written.
//   {ruling, token, value}                 the answered ask that ruled the value, read from the ledger's recorded answer; the
//                                          declaration the app still has to make is owed to interface.implement.
// Both pass at the decide stage and are refused at the verify stage while the app source lacks the token (planned-source-missing).
import fs from 'node:fs';
import path from 'node:path';
import {sha256 as digest} from '../../../engine/digest.mjs';
import {slash} from '../../lib/path-key.mjs';
import {parseColor,deltaEOk,TOKEN_TOLERANCE} from './brand-colour.mjs';
import {readSourceTokens,lookupToken} from './brand-tokens.mjs';

const round=(value,places=4)=>Number.parseFloat(Number(value).toFixed(places));
const collapse=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
const CUSTOM_PROPERTY=/^--[A-Za-z0-9_-]+$/;
const COLOUR_IN_TEXT=/#[0-9a-f]{3,8}\b|(?:oklch|rgba?)\([^)]*\)/gi;
/** The answerers whose recorded answer is a ruling: the owner, the owner's standing autopilot ruling, and the config's auto-accept of the recommended option. */
const RULING_ANSWERERS=Object.freeze(['owner','autopilot','auto-recommended']);
/** The op that writes the app theme, so the one that owes the declaration of a planned token. */
export const OWED_TO='interface.implement';

const invalid=why=>({status:'value-source-invalid',why});

/** The first recorded answer of `ruling` given by one of RULING_ANSWERERS, or the first refusal. */
function rulingAnswer({ruling,brandDir,findReceipt}){
  if(typeof findReceipt!=='function')return {ok:false,why:'no ledger was given to read the ruling from'};
  const attempts=RULING_ANSWERERS.map(answerer=>findReceipt({acceptedBy:ruling,brandDir,answerer}));
  return attempts.find(attempt=>attempt.ok)??attempts[0];
}

/** Whether the answer's own words (the chosen option, the note, the picks) carry `value`, as the same text or as a colour equal to it. */
function answerCarries(answer,value){
  const wanted=parseColor(value);
  const texts=[answer.option,answer.note,...Object.values(answer.picks??{})].filter(text=>typeof text==='string');
  const sameColour=text=>[...text.matchAll(COLOUR_IN_TEXT)].some(found=>{const colour=parseColor(found[0]);return Boolean(colour&&wanted&&deltaEOk(colour,wanted)<=TOKEN_TOLERANCE);});
  return texts.some(text=>collapse(text).includes(collapse(value))||sameColour(text));
}

/** The shape of a ruling reference, or the refusal naming what is wrong with it. */
function rulingShapeProblem(reference){
  if(typeof reference.ruling!=='string'||!reference.ruling.trim())return 'valueSource.ruling must be the dispatch id of the answered ask that ruled this value';
  if(typeof reference.token!=='string'||!CUSTOM_PROPERTY.test(reference.token))return 'valueSource.token must be the custom property the app has to declare';
  if(typeof reference.value!=='string'||!reference.value.trim())return 'valueSource.value must be the exact value the ruling carries';
  if(['path','sha256','line'].some(key=>Object.hasOwn(reference,key)))return 'a ruling valueSource is {ruling, token, value}; a file reference names path and has no ruling';
  return null;
}

/** A token traced to the ledger's recorded answer: the answer exists, was given by a ruling answerer, carries the value, and the value is the brand value. */
function checkRulingSource({token,reference,brandDir,findReceipt}){
  const problem=rulingShapeProblem(reference);
  if(problem)return invalid(problem);
  if(reference.token!==token.token)return invalid(`valueSource.token ${reference.token} must be this brand token, ${token.token}: the app declares it under its brand token name`);
  const evidence={ruling:reference.ruling,token:reference.token,value:reference.value,owedTo:OWED_TO};
  const answer=rulingAnswer({ruling:reference.ruling,brandDir,findReceipt});
  if(!answer.ok)return {...evidence,status:'ruling-unrecorded',why:answer.why};
  const given={answeredBy:answer.answeredBy,provisional:answer.provisional,answeredAt:answer.at,receipt:answer.file};
  if(!answerCarries(answer,reference.value))return {...evidence,...given,status:'ruling-differs',why:`the answer to ${reference.ruling} does not carry ${reference.value}`};
  const expected=parseColor(token.value),ruled=parseColor(reference.value);
  if(!expected||!ruled)return {...evidence,...given,status:'unparseable-reference-value',why:'the brand value or the ruled value is not a colour this runtime can parse'};
  const delta=round(deltaEOk(expected,ruled),3);
  if(delta>TOKEN_TOLERANCE)return {...evidence,...given,deltaE:delta,status:'ruling-differs',why:`the brand value ${token.value} is not the ruled value ${reference.value}`};
  return {...evidence,...given,deltaE:delta,status:'planned-from-ruling'};
}

/**
 * A token the app has not written yet may name the external render it was read from:
 * `valueSource: {path, value, token?, line?, sha256?}`. `path` is relative to the same --source root as
 * `sources[]` (for example `acme-fe/src/app/globals.css`) and is only ever read; `token` is the
 * name the reference declares (default: the brand token's own name); `value` is the exact value it declares
 * there. The reference passes when that declaration exists in the default (light) scope with exactly that
 * text, its colour is the brand value, and a declared sha256 still names the file's bytes.
 */
function checkFileSource({sourceRoot,token,reference}){
  if(typeof reference.path!=='string'||!reference.path.trim())return invalid('valueSource.path must name the reference file, relative to the --source root');
  if(typeof reference.value!=='string'||!reference.value.trim())return invalid('valueSource.value must be the exact value the reference declares');
  const name=reference.token??token.token;
  if(typeof name!=='string'||!CUSTOM_PROPERTY.test(name))return invalid('valueSource.token must be the custom property the reference declares');
  const evidence={path:slash(reference.path),token:name,value:reference.value,line:reference.line??null,declaredSha256:reference.sha256??null};
  const extension=path.extname(reference.path).toLowerCase();
  const read=readSourceTokens(sourceRoot,{path:reference.path,kind:extension==='.css'?'css':'tokens'});
  if(read.error)return {...evidence,status:'reference-unreadable',why:read.error};
  if(reference.sha256!==undefined&&reference.sha256!==null){
    const computed=digest(fs.readFileSync(path.resolve(sourceRoot,reference.path)));
    if(String(reference.sha256).toLowerCase()!==computed)
      return {...evidence,computedSha256:computed,status:'reference-digest-mismatch',why:'the reference file is no longer the bytes the brand read'};
  }
  const found=lookupToken([read],name);
  if(!found)return {...evidence,status:'reference-absent',why:`the reference does not declare ${name}`};
  if(found.scope==='dark')return {...evidence,actual:found.value,selector:found.selector,status:'reference-only-in-dark-scope',why:`the reference declares ${name} only in a dark scope`};
  const declared=[found.value,found.declaredValue].filter(value=>value!==undefined).map(collapse);
  if(!declared.includes(collapse(reference.value)))
    return {...evidence,actual:found.declaredValue??found.value,selector:found.selector,status:'reference-differs',why:`the reference declares ${name}: ${found.declaredValue??found.value}, not ${reference.value}`};
  const expected=parseColor(token.value),planned=parseColor(reference.value);
  if(!expected||!planned)return {...evidence,status:'unparseable-reference-value',why:'the brand value or the reference value is not a colour this runtime can parse'};
  const delta=round(deltaEOk(expected,planned),3);
  if(delta>TOKEN_TOLERANCE)return {...evidence,deltaE:delta,status:'reference-differs',why:`the brand value ${token.value} is not the reference value ${reference.value}`};
  return {...evidence,selector:found.selector,deltaE:delta,status:'planned-from-reference'};
}

/** One planned token's trace: its reference file or its ruling. `findReceipt` reads an answered ask from the ledger (brand.mjs findOwnerReceipt). */
export function checkValueSource({sourceRoot,token,brandDir=null,findReceipt=null}){
  const reference=token?.valueSource;
  if(!reference||typeof reference!=='object'||Array.isArray(reference))return invalid('valueSource must be an object {path, value, token?, line?, sha256?} or {ruling, token, value}');
  if(Object.hasOwn(reference,'ruling'))return checkRulingSource({token,reference,brandDir,findReceipt});
  return checkFileSource({sourceRoot,token,reference});
}
