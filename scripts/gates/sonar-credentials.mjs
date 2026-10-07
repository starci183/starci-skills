import {credentialPresent} from '../../engine/secrets.mjs';
import {trimTrailingSlashes} from '../lib/path-key.mjs';

const contexts=new WeakMap();
const TOKEN_NAME='SONAR_TOKEN';
const HOST_NAME='SONAR_HOST_URL';
const ACTIONS=new Set(['token','scan','dashboard']);

/** Bind an analysis environment privately to resolved configuration; returned config never contains values. */
export function bindSonarCredentials(config,env,selectedHost,remember,administrativeHost){
  const token=credentialPresent(env.SONAR_TOKEN)?env.SONAR_TOKEN.trim():null;
  if(token)remember(token);
  contexts.set(config,{env,selectedHost,token,administrativeHost});
  return config;
}

const validHost=value=>{
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&Boolean(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{return false;}
};

/** Keep invalid or credential-bearing URL inputs out of configuration and reports. */
export const safeSonarHost=value=>validHost(value)?trimTrailingSlashes(String(value)):null;

/** Identify the analysis actions whose credentials are supplied independently from administrative custody. */
export const sonarAnalysisAction=action=>ACTIONS.has(action);

/** Keep administrative calls on their original configured server when shared analysis selects another host. */
export function sonarAdministrativeConfig(config){
  const context=contexts.get(config);
  if(!context)return config;
  const host=safeSonarHost(context.administrativeHost)??'';
  if(config.host===host)return config;
  const administrative={...config,host};contexts.set(administrative,context);
  return administrative;
}

/** Administrative custody may assist analysis only on the server it is configured to manage. */
export const sonarAdminForAnalysis=config=>config.host===(safeSonarHost(contexts.get(config)?.administrativeHost)??null);

/** Derive names-only selected analysis requirements from the actual resolved Sonar owner configuration. */
export function sonarCredentialRequirements({action,config}){
  if(!sonarAnalysisAction(action)||config?.disabled)return [];
  const context=contexts.get(config);
  const token=context?.token;
  return [
    {feature:'sonar-analysis',kind:'env',name:TOKEN_NAME,present:token!==undefined&&token!==null},
    {feature:'sonar-analysis',kind:'config',name:HOST_NAME,present:validHost(context?.selectedHost)},
  ];
}

/** Validate a supplied analysis token without touching encrypted custody, minting, or provider credentials. */
export async function suppliedSonarToken(config,{validate,remember}){
  if(config?.disabled)return {present:false,name:TOKEN_NAME,reason:'Sonar analysis is disabled'};
  const missing=sonarCredentialRequirements({action:'scan',config}).filter(row=>!row.present).map(row=>row.name);
  if(missing.length)return {present:false,name:TOKEN_NAME,reason:`missing credential inputs: ${missing.join(', ')}`};
  const value=remember(contexts.get(config).token);
  const accepted=await validate(value);
  if(accepted===false)return {present:false,name:TOKEN_NAME,via:'environment',rejected:true,reason:`${TOKEN_NAME} is rejected by the server`};
  return {present:true,name:TOKEN_NAME,via:'environment',value,accepted};
}

/** Return the private analysis environment only to the scanner/child invocation owner; never serialize it. */
export function sonarAnalysisEnvironment(config){return contexts.get(config)?.env??{};}
