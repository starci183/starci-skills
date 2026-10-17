// sonar-stack.mjs - `starci gate sonar up|stop`: run the self-hosted Sonar stack of ext/sonar. Its Compose files hold no secret and
// read the database password, the admin password and (with --public) the tunnel token from the environment of the process that
// runs Compose; this verb builds that environment from the owner's secret.env (the resolved environment of the config) and
// passes it to the child, never on argv, never in a file, never in the report. A missing variable is a typed refusal naming it.
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {runProgram} from '../api/process/run-program.mjs';
import {STACK_VARIABLES,hostSecretRefusal,missingVariables} from './sonar-host-secrets.mjs';

/** Stack children share one argv spawn seam; secrets travel only in the child environment. */
const stackSpawn=(cfg,args,env,timeout=15000)=>(cfg.stackRun.spawn??runProgram)(cfg.docker,args,{cwd:cfg.stackRun.extRoot,env,timeout});

/** Public Compose services need the public profile on both start and stop. */
function stackCompose(cfg,command,files,env,publicTunnel){
  const profiles=publicTunnel?['public']:[];
  const custom=cfg.stackRun.composeRunner?.[command];
  if(custom)return custom({files,projectName:'starci',wait:false,profiles},{cwd:cfg.stackRun.extRoot,docker:cfg.docker,env});
  return stackSpawn(cfg,['compose','--project-directory',cfg.stackRun.extRoot,...files.flatMap(file=>['-f',file]),
    '--project-name','starci',...profiles.flatMap(profile=>['--profile',profile]),command,...(command==='up'?['-d']:[])],env,command==='up'?150000:120000);
}

/** Even short stack secrets and stop-only secrets must be scrubbed from child diagnostics. */
function stackCleaner(env,clean){
  const values=[...STACK_VARIABLES.base,...STACK_VARIABLES.public].map(name=>env[name]).filter(value=>typeof value==='string'&&value.length>0);
  const forms=values.flatMap(value=>[value,encodeURIComponent(value),Buffer.from(`${value}:`).toString('base64')]);
  return value=>forms.reduce((out,secret)=>out.split(secret).join('***'),clean(value));
}

/** Compose interpolation for stop uses stand-ins when secrets are absent; volumes are always kept. */
function stackEnvironment(cfg,env,variables,command){
  let port=null;
  try{port=new URL(cfg.host).port||null;}catch{}
  if(command==='up'&&!port)return null;
  const standIns=command==='stop'?Object.fromEntries(missingVariables(env,variables).map(name=>[name,'not-read-by-stop'])):{};
  return {...env,...standIns,STARCI_PORT_SONARQUBE:port??''};
}

/** Stack reports expose only file names and scrubbed, bounded process diagnostics. */
function stackReport(command,files,result,clean){
  const base={command,files:files.map(file=>path.basename(file))};
  if(result.error)return {...base,outcome:'blocked',message:clean(`docker could not start: ${result.error.code??result.error.message}`)};
  if(result.status!==0)return {...base,outcome:'blocked',message:clean(`docker compose ${command} exited ${result.status}: ${String(result.stderr||result.stdout).trim().split(/\r?\n/).slice(-3).join(' ')}`)};
  return {...base,outcome:command==='up'?'up':'ok'};
}

/** A typed stack refusal always names its code first and never includes an environment value. */
function stackRefusal(report,code,message,detail={}){
  const refusal={code,message:`${code}: ${message}`,...detail};
  return {...report,outcome:'refused',refusal,message:refusal.message};
}

/** Database diagnostics inspect both consumers without ever returning their raw logs. */
function stackPasswordMismatch(cfg,env,report){
  const prefix=env.STARCI_CONTAINER_PREFIX||'starci-';
  for(const name of ['sonarqube','sonarqube-postgres']){
    const result=stackSpawn(cfg,['logs','--tail','200',`${prefix}${name}`],env,5000);
    if(/password authentication failed for user/i.test(`${result.stdout??''}\n${result.stderr??''}`)){
      return stackRefusal(report,'SONAR_DB_PASSWORD_MISMATCH','the sonar Postgres volume starci-sonarqube-postgres-data was initialised with another password than SONARQUBE_DB_PASSWORD in secret.env (used by SONAR_JDBC_PASSWORD and POSTGRES_PASSWORD); either restore the old password in secret.env or, after a backup export, recreate the volume');
    }
  }
  return null;
}

/** Failed tunnel inspections report a scrubbed process error, absence, or container state. */
function stackTunnelState(result,running,status,clean){
  if(result.error)return clean(`docker-unavailable: ${result.error.code??result.error.message}`);
  if(result.status!==0)return clean('missing');
  return clean(status||running||'unknown');
}

/** Inspect immediately, then retry within the original deadline with at most one second between attempts. */
async function stackTunnelPoll(cfg,env,container,deadline,clean){
  const result=stackSpawn(cfg,['inspect','--format','{{.State.Running}}|{{.State.Status}}',container],env,Math.max(1,Math.min(5000,deadline-Date.now())));
  const [running,status]=String(result.stdout??'').trim().split('|');
  if(!result.error&&result.status===0&&running==='true')return {running:true,state:status||'running'};
  const state=stackTunnelState(result,running,status,clean);
  const remaining=deadline-Date.now();
  if(remaining<=0)return {running:false,state};
  await delay(Math.min(1000,remaining));
  if(Date.now()<=deadline)return stackTunnelPoll(cfg,env,container,deadline,clean);
  return {running:false,state};
}

/** Public start is successful only after the tunnel is running, with at most 30 seconds of retry. */
async function stackTunnel(cfg,env,report,clean){
  const container=`${env.STARCI_CONTAINER_PREFIX||'starci-'}cloudflared-sonarqube`;
  const deadline=Date.now()+Math.min(30000,Math.max(0,Number(cfg.stackRun.tunnelWaitMs??30000)));
  const {running,state}=await stackTunnelPoll(cfg,env,container,deadline,clean);
  if(running)return {...report,tunnel:{container,state}};
  const mismatch=stackPasswordMismatch(cfg,env,report);
  if(mismatch)return mismatch;
  const result=stackSpawn(cfg,['logs','--tail','20',container],env,5000);
  const logs=clean(`${result.stdout??''}\n${result.stderr??''}`.trim().split(/\r?\n/).slice(-20).join('\n'));
  return stackRefusal(report,'SONAR_TUNNEL_NOT_RUNNING',`container ${container} is ${state}; last 20 log lines: ${logs||'(none)'}`,{container,state,logs});
}

/** Start the host extension with the required secrets; refuse password drift before reporting success. */
export async function stackUp(cfg,{env,publicTunnel=false,scrub:clean=String,remember:retain=()=>{}}){
  clean=stackCleaner(env,clean);
  const variables=[...STACK_VARIABLES.base,...(publicTunnel?STACK_VARIABLES.public:[])];
  const missing=missingVariables(env,variables);
  if(missing.length){const refusal=hostSecretRefusal(missing);return {command:'up',outcome:'blocked',refusal,message:refusal.message};}
  for(const name of variables)retain(env[name]);
  const child=stackEnvironment(cfg,env,variables,'up');
  if(!child)return {command:'up',outcome:'blocked',message:`the Sonar host ${cfg.host} names no published port`};
  const files=['compose.yaml',...(publicTunnel?['cloudflared.yaml']:[])].map(name=>path.join(cfg.stackRun.extRoot,name));
  const result=stackCompose(cfg,'up',files,child,publicTunnel);
  const report=stackReport('up',files,result,clean);
  if(result.error)return report;
  const mismatch=stackPasswordMismatch(cfg,child,report);
  if(mismatch)return mismatch;
  if(publicTunnel)return stackTunnel(cfg,child,report,clean);
  return report;
}

/** Stop activates the same public profile as start and never removes a volume. */
export function stackStop(cfg,{env,publicTunnel=false,scrub:clean=String}){
  clean=stackCleaner(env,clean);
  const variables=[...STACK_VARIABLES.base,...(publicTunnel?STACK_VARIABLES.public:[])];
  const child=stackEnvironment(cfg,env,variables,'stop');
  const files=['compose.yaml',...(publicTunnel?['cloudflared.yaml']:[])].map(name=>path.join(cfg.stackRun.extRoot,name));
  return stackReport('stop',files,stackCompose(cfg,'stop',files,child,publicTunnel),clean);
}
