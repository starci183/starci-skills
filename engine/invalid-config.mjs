import path from 'node:path';
import {isPlainObject as plain} from './plain-object.mjs';
/** The one `Invalid config.yaml:` raiser every section validator shares: bad('<rest>') throws it. */
export const invalid=section=>message=>{throw new Error(`Invalid config.yaml: ${section}${message}`);};

/** The host roots the owner may relocate (config.yaml `roots`): the archive root, the lanes root and the temp root. */
const ROOT_KEYS=Object.freeze(['archive','lanes','temp']);
/** config.yaml `roots` - {archive?, lanes?, temp?}: absolute directories, or null; an absent key means <starciLocalRoot>/archive and the per-user lanes directory (scripts/machine/home.mjs lanesDefault). */
export function validateRoots(roots){
  if(roots===null)return;
  const bad=invalid('roots');
  if(!plain(roots))bad(` must be {archive?: <absolute directory>, lanes?: <absolute directory>, temp?: <absolute directory>} or null.`);
  for(const key of Object.keys(roots))if(!ROOT_KEYS.includes(key))bad(` has unknown key ${key} (allowed: ${ROOT_KEYS.join(', ')}).`);
  for(const key of ROOT_KEYS)if(roots[key]!==undefined&&roots[key]!==null&&!(typeof roots[key]==='string'&&roots[key].trim()&&path.isAbsolute(roots[key])))bad(`.${key} must be an absolute directory path or null.`);
}
