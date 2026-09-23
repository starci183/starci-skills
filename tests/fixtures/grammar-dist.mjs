import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeStamp} from '../../packages/grammar/scripts/build-stamp.mjs';

/**
 * A miniature @starci/grammar package for the dist-freshness specs: source CSS and a module under src/,
 * the digest inputs the build stamp reads, and (optionally) a dist copied from that source and stamped by
 * the real stamp writer, so a fixture is fresh exactly when a real build would be.
 */
export const SRC_CSS=`:root{
  /* the family defaults */
  --starci-core-accent: oklch(56.50% 0.2534 286.60);
  --starci-core-danger: oklch(50.13% 0.1783 28.70);
}
[data-theme="dark"]{ --starci-core-accent: #9b7bff; }
`;
export const OLD_DANGER='oklch(65.32% 0.2 28.7)';

export function grammarFixture(t,{build=true,stamp=true,label='grammar',version='0.5.0',withSource=true}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`starci-${label}-`));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(relative,body)=>{
    const file=path.join(root,...relative.split('/'));
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,body);
    return file;
  };
  write('package.json',JSON.stringify({name:'@starci/grammar',version,type:'module',files:['dist'],
    exports:{'./core':{types:'./dist/core/index.d.ts',import:'./dist/core/index.js'},'./core/styles.css':'./dist/core/styles.css'}},null,2));
  if(withSource){
    write('src/core/styles.css',SRC_CSS);
    write('src/core/index.ts','export const family = "core"\n');
    write('src/core/index.spec.ts','// specs never ship and never enter the digest\n');
    write('src/stories/Button.stories.tsx','// stories never ship\n');
    write('tsconfig.build.json','{"compilerOptions":{"outDir":"dist","rootDir":"src"}}\n');
    write('scripts/copy-css.mjs','// copies src/<family>/*.css to dist/<family>/\n');
  }
  if(build){
    write('dist/core/styles.css',SRC_CSS);
    write('dist/core/index.js','export const family = "core"\n');
    write('dist/core/index.d.ts','export declare const family = "core"\n');
    if(stamp)writeStamp(root);
  }
  return {root,write,read:relative=>fs.readFileSync(path.join(root,...relative.split('/')),'utf8')};
}
