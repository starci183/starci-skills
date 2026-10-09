import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../engine/yaml.mjs';
import {repositoryName,repositoryHome} from '../hfs/repo-identity.mjs';

// scripts/gates/sonar-declaration.mjs — which stack declaration governs a repository.
export const DECLARATION='application-stacks.yaml';

/**
 * Find the stack declaration that governs a repository: its own .starcistacks/application-stacks.yaml,
 * or a sibling repository's declaration whose `sources` list this repository (a frontend declared by its
 * backend's stack). Returns {file, repoRoot} or null.
 */
export function findDeclaration(cwd){
  if(!cwd)return null;
  const repo=path.resolve(cwd);
  const own=path.join(repo,'.starcistacks',DECLARATION);
  if(fs.existsSync(own))return {file:own,repoRoot:repo};
  const name=repositoryName(repo);
  const parent=path.dirname(repositoryHome(repo));
  let siblings=[];
  try{siblings=fs.readdirSync(parent,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!==name);}catch{/* no parent listing */}
  for(const entry of siblings){
    const file=path.join(parent,entry.name,'.starcistacks',DECLARATION);
    if(!fs.existsSync(file))continue;
    try{
      const doc=parseYaml(fs.readFileSync(file,'utf8'));
      if((doc?.sources??[]).some(s=>s?.repository===name))return {file,repoRoot:path.dirname(path.dirname(file))};
    }catch{/* unreadable declaration is not this repository's */}
  }
  return null;
}
