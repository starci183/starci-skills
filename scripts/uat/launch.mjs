// How a UAT command (an assisted-uat manifest command, or `uat-slots.mjs run -- <command...>`) is spawned.
// A leaf module with no local imports: uat-slots.mjs and assisted-runner.mjs both import it, and
// assisted-runner.mjs imports uat-slots.mjs, so uat-slots.mjs must never import assisted-runner.mjs —
// under uat-slots' own top-level await that cycle never settles (starci-next inc-f681bbed166f).
//
// On Windows, Node refuses to spawn .cmd/.bat files without a shell (CVE-2024-27980, spawn EINVAL), so
// npm and npx run as node <npm>/bin/<tool>-cli.js from the running Node install — no shell, the
// arguments stay an argv array. pnpm and yarn keep their .cmd shims.
import path from 'node:path';

export const launchFor=(command,{platform=process.platform,execPath=process.execPath}={})=>{
  const [head,...rest]=command;
  if(platform!=='win32')return {file:head,args:rest};
  if(head==='node')return {file:execPath,args:rest};
  if(head==='npm'||head==='npx'){
    const cli=path.win32.join(path.win32.dirname(execPath),'node_modules','npm','bin',`${head}-cli.js`);
    return {file:execPath,args:[cli,...rest]};
  }
  if(head==='pnpm'||head==='yarn')return {file:`${head}.cmd`,args:rest};
  return {file:head,args:rest};
};
