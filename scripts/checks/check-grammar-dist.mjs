// check-grammar-dist.mjs - the self-check CLI over scripts/gates/grammar-dist.mjs: fails unless the grammar dist is the
// build of the current source.
import {isMain} from '../lib/is-main.mjs';
import {GRAMMAR_DIST_FIX,defaultGrammarPackageRoot,grammarDistMessage,grammarDistStatus} from '../gates/grammar-dist.mjs';

export function grammarDistMain(argv=[]){
  if(argv.includes('--help'))return {exitCode:0,text:`Usage: node scripts/checks/check-grammar-dist.mjs [--root <packages/grammar>] [--json]\n\nFails unless the grammar dist is the build of the current source (build stamp + source digest + dist digest + --* tokens). Fix: ${GRAMMAR_DIST_FIX}.\n`};
  const at=argv.indexOf('--root');
  const status=grammarDistStatus(at>=0?argv[at+1]:defaultGrammarPackageRoot());
  if(argv.includes('--json'))return {exitCode:status.ok?0:1,text:`${JSON.stringify(status,null,2)}\n`};
  if(status.ok)return {exitCode:0,text:`grammar dist: ${status.state} (${status.detail})\n`};
  const lines=[`FAIL: ${grammarDistMessage(status)}`];
  for(const d of status.tokens?.differences??[])lines.push(`  ${d.file} ${d.token??''} src=${d.src??'(absent)'} dist=${d.dist??'(absent)'}`);
  return {exitCode:1,text:`${lines.join('\n')}\n`};
}

if(isMain(import.meta.url)){
  const {exitCode,text}=grammarDistMain(process.argv.slice(2));
  (exitCode?process.stderr:process.stdout).write(text);
  process.exitCode=exitCode;
}
