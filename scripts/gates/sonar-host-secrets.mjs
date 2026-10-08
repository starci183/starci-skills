// sonar-host-secrets.mjs - the secrets of the self-hosted Sonar stack (ext/sonar) are variables of the owner's untracked
// .claude/secret.env, read through engine/secrets.mjs secretEnv and handed to Compose and to sonar-local.mjs as environment.
// This module names them once (the stack start verb, the admin-token reader and the owner's import verb share the table) and
// turns an absent one into a typed refusal that names the variable. Pure: the environment comes in as a parameter.
import {credentialPresent} from '../../engine/secrets.mjs';

/** The prefix of a custody reference that names an environment variable instead of a file: `env:SONARQUBE_ADMIN_TOKEN`. */
const ENV_REFERENCE='env:';

/** The variable the admin token comes from: sonar-local.mjs provisions product projects with it. */
export const ADMIN_TOKEN_ENV='SONARQUBE_ADMIN_TOKEN';
const DB_PASSWORD_ENV='SONARQUBE_DB_PASSWORD';
const ADMIN_PASSWORD_ENV='SONARQUBE_ADMIN_PASSWORD';
const TUNNEL_TOKEN_ENV='CLOUDFLARE_TUNNEL_TOKEN';

/** What `starci gate sonar up` needs per stack part: the variables its Compose files interpolate without a default. */
export const STACK_VARIABLES=Object.freeze({
  base:Object.freeze([DB_PASSWORD_ENV,ADMIN_PASSWORD_ENV]),
  public:Object.freeze([TUNNEL_TOKEN_ENV]),
});

/**
 * The sealed members the public runtime repository once tracked, and what replaced each: the secret.env variable it moved to (null
 * for a retired member nothing reads any more); the two demo secrets of an example are retired without an entry and who reads it. `starci runtime import-held-secret` moves one member's value from
 * git history into secret.env. The members are deleted from the tree; their ciphertext stays in history.
 */
export const HELD_MEMBERS=Object.freeze([
  {path:'ext/sonar/secrets/sonarqube-db-password.txt.enc',variable:DB_PASSWORD_ENV,reader:'ext/sonar/compose.yaml, through starci gate sonar up'},
  {path:'ext/sonar/secrets/sonarqube-admin-password.txt.enc',variable:ADMIN_PASSWORD_ENV,reader:'ext/sonar/compose.yaml (the admin-password bootstrap), through starci gate sonar up'},
  {path:'ext/sonar/secrets/sonarqube-admin-token.key.enc',variable:ADMIN_TOKEN_ENV,reader:'scripts/gates/sonar-local.mjs (ensure-project, status, scan --isolate)'},
  {path:'ext/sonar/secrets/cloudflare-starci-local-services-tunnel-token.key.enc',variable:TUNNEL_TOKEN_ENV,reader:'ext/sonar/cloudflared.yaml, through starci gate sonar up --public'},
  {path:'ext/sonar/secrets/sonarqube-analysis-token.txt.enc',variable:null,reader:'retired: no code reads a server-wide analysis token of the extension; a product reads the analysis token of its own custody'},
]);

/** The custody reference that reads `name` from the environment. */
export const environmentReference=name=>`${ENV_REFERENCE}${name}`;

/** True for a reference built by environmentReference. */
export const isEnvironmentReference=ref=>typeof ref==='string'&&ref.startsWith(ENV_REFERENCE);

/** The variables of `names` that `env` does not supply (blank and template markers count as absent). */
export const missingVariables=(env,names)=>names.filter(name=>!credentialPresent(env[name]));

/** The typed refusal of absent variables: {code 'sonar-host-secret-missing' (modules/kernel/failure-codes.yaml), variables, message}; the message names each variable and where it goes, never a value. */
export const hostSecretRefusal=variables=>({code:'sonar-host-secret-missing',variables:[...variables],
  message:`${variables.join(', ')} ${variables.length===1?'is':'are'} not set: add ${variables.length===1?'it':'them'} to .claude/secret.env (secret.env.example describes each); the stack takes its secrets from there and holds none`});

/**
 * A custody entry for a reference naming a variable: {present, value?, via:'environment', name} or an absent entry carrying the refusal.
 * `remember` registers the value for scrubbing; the value is for a header or a child env only.
 */
export function readEnvironmentCustody(env,ref,{remember}){
  const name=ref.slice(ENV_REFERENCE.length);
  if(missingVariables(env,[name]).length===0)return {present:true,value:remember(String(env[name]).trim()),via:'environment',name};
  const refusal=hostSecretRefusal([name]);
  return {present:false,name,reason:refusal.message,refusal};
}
