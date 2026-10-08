// sonar-stack.mjs - `starci gate sonar up|stop`: run the self-hosted Sonar stack of ext/sonar. Its Compose files hold no secret and
// read the database password, the admin password and (with --public) the tunnel token from the environment of the process that
// runs Compose; this verb builds that environment from the owner's secret.env (the resolved environment of the config) and
// passes it to the child, never on argv, never in a file, never in the report. A missing variable is a typed refusal naming it.
import path from 'node:path';
import {composeUp} from '../api/docker/compose-up.mjs';
import {composeStop} from '../api/docker/compose-stop.mjs';
import {STACK_VARIABLES,hostSecretRefusal,missingVariables} from './sonar-host-secrets.mjs';

const PROJECT='starci';
const BASE_FILE='compose.yaml';
const PUBLIC_FILE='cloudflared.yaml';
const PORT_ENV='STARCI_PORT_SONARQUBE';
/** What a stopped stack's Compose interpolation needs when the owner's variable is absent: stop reads no secret. */
const STOP_STAND_IN='not-read-by-stop';

/** The Compose files and the secret variables of the stack part: the local server, plus the public tunnel with `publicTunnel`. */
export function stackPlan({root,publicTunnel=false}){
  const files=[BASE_FILE,...(publicTunnel?[PUBLIC_FILE]:[])].map(name=>path.join(root,name));
  const variables=[...STACK_VARIABLES.base,...(publicTunnel?STACK_VARIABLES.public:[])];
  return {files,variables};
}

const publishedPort=host=>{
  try{return new URL(host).port||null;}catch{return null;}
};

const composeOptions=(cfg,env)=>({cwd:cfg.extRoot,docker:cfg.docker,env});

/** The Compose call owners; a spec passes its own as `composeRunner` (docker is not run). */
const runnerOf=cfg=>cfg.composeRunner??{up:composeUp,stop:composeStop};

/** The report of one Compose result: ok, or blocked with the last lines of its output (scrubbed). */
function composeReport({command,result,scrub,files}){
  const base={command,files:files.map(file=>path.basename(file))};
  if(result.error)return {...base,outcome:'blocked',message:scrub(`docker could not start: ${result.error.code??result.error.message}`)};
  if(result.status!==0)return {...base,outcome:'blocked',message:scrub(`docker compose ${command} exited ${result.status}: ${String(result.stderr||result.stdout).trim().split(/\r?\n/).slice(-3).join(' ')}`)};
  return {...base,outcome:command==='up'?'up':'ok'};
}

/** `up`: refuse naming the missing variables, else start the stack (detached) with the secrets in the child environment only. */
export function stackUp(cfg,{env,publicTunnel=false,scrub,remember}){
  const plan=stackPlan({root:cfg.extRoot,publicTunnel});
  const missing=missingVariables(env,plan.variables);
  if(missing.length>0){
    const refusal=hostSecretRefusal(missing);
    return {command:'up',outcome:'blocked',refusal,message:refusal.message};
  }
  for(const name of plan.variables)remember(env[name]);
  const port=publishedPort(cfg.host);
  if(!port)return {command:'up',outcome:'blocked',message:`the Sonar host ${cfg.host} names no published port`};
  const child={...env,[PORT_ENV]:port};
  const result=runnerOf(cfg).up({files:plan.files,projectName:PROJECT,wait:false},composeOptions(cfg,child));
  return composeReport({command:'up',result,scrub,files:plan.files});
}

/** `stop`: stop the stack's containers (data kept); no secret is read, so an absent variable never refuses it. */
export function stackStop(cfg,{env,publicTunnel=false,scrub}){
  const plan=stackPlan({root:cfg.extRoot,publicTunnel});
  const child={...env,...Object.fromEntries(missingVariables(env,plan.variables).map(name=>[name,STOP_STAND_IN])),[PORT_ENV]:publishedPort(cfg.host)??''};
  const result=runnerOf(cfg).stop({files:plan.files,projectName:PROJECT},composeOptions(cfg,child));
  return composeReport({command:'stop',result,scrub,files:plan.files});
}
