import {isPlainObject as plain} from './plain-object.mjs';
import {invalid} from './invalid-config.mjs';

/** The keys of the sonar block. */
const SONAR_KEYS=Object.freeze(['organization']);
/** A SonarCloud organization key: lowercase letters, digits, hyphens and underscores, starting with a letter or a digit. */
const ORGANIZATION=/^[a-z0-9][a-z0-9_-]*$/;

/**
 * config.yaml `sonar` - {organization?}: the key of the SonarCloud organization the release's Sonar proof of the example apps analyses in
 * (the project key is <organization>_<key the example declares>). It is configuration, not a secret; the environment variable
 * SONAR_ORGANIZATION wins over it, the repository variable of the same name is what CI reads. Null or absent means "not set yet".
 */
export function validateSonar(sonar){
  if(sonar===null)return;
  const bad=invalid('sonar');
  if(!plain(sonar))bad(' must be {organization?: <SonarCloud organization key>} or null.');
  for(const key of Object.keys(sonar))if(!SONAR_KEYS.includes(key))bad(` has unknown key ${key} (allowed: ${SONAR_KEYS.join(', ')}).`);
  const value=sonar.organization;
  if(value!==undefined&&value!==null&&!(typeof value==='string'&&ORGANIZATION.test(value)))bad('.organization must be a SonarCloud organization key (lowercase letters, digits, - and _) or null.');
}
