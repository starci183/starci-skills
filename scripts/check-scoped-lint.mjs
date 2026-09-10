import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// A result-integrity guard, not a replacement for canonical config/structural audits.
export function inspectLintResults(expectedFiles, results) {
  const expected=new Set(expectedFiles.map(p=>path.resolve(p)));
  const seen=new Set();
  const issues=[];
  for(const result of results) {
    const file=path.resolve(result.filePath);
    if(!expected.has(file)) issues.push({file,code:'UNEXPECTED_FILE'});
    if(seen.has(file)) issues.push({file,code:'DUPLICATE_RESULT'});
    seen.add(file);
    for(const message of result.messages??[]) if(message.fatal || message.severity>0) issues.push({file,code:'LINT_MESSAGE',ruleId:message.ruleId,line:message.line,message:message.message});
    for(const message of result.suppressedMessages??[]) issues.push({file,code:'SUPPRESSED_MESSAGE',ruleId:message.ruleId,line:message.line});
  }
  for(const file of expected) if(!seen.has(file)) issues.push({file,code:'MISSING_RESULT'});
  return issues;
}

export async function checkScopedLint(root, inputs) {
  const repository=fs.realpathSync(root);
  if(!inputs.length) throw Error('Explicit owned file paths are required; no globs or implicit whole-repo run.');
  const files=inputs.map(input=>{
    if(/[?*]/.test(input)) throw Error('Globs are not supported: '+input);
    const file=fs.realpathSync(path.resolve(repository,input));
    const relative=path.relative(repository,file);
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!fs.statSync(file).isFile()) throw Error('File must be inside repository: '+input);
    return file;
  });
  if(new Set(files).size!==files.length) throw Error('Duplicate file inputs.');
  const require=createRequire(path.join(repository,'package.json'));
  const {ESLint}=require('eslint');
  const eslint=new ESLint({cwd:repository,fix:false,warnIgnored:true});
  const configuration=[];
  for(const file of files) {
    if(await eslint.isPathIgnored(file)) throw Error('Owned file is ignored: '+file);
    const config=await eslint.calculateConfigForFile(file);
    if(!config) throw Error('No effective lint configuration: '+file);
    configuration.push({file,noInlineConfig:config.linterOptions?.noInlineConfig===true,rules:config.rules});
  }
  const results=await eslint.lintFiles(files);
  const issues=inspectLintResults(files,results);
  return {ok:issues.length===0,scope:'lint-result-integrity-only',structuralConformance:'not-proven',configuration,issues};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const result=await checkScopedLint(process.argv[2]??'.',process.argv.slice(3));
    process.stdout.write(JSON.stringify(result)+'\n');
    if(!result.ok) process.exitCode=1;
  } catch(error) {process.stderr.write(error.message+'\n');process.exitCode=1;}
}
