import {build} from 'esbuild';
await build({entryPoints:['scripts/yaml-source.mjs'],bundle:true,platform:'node',format:'esm',outfile:'core/yaml.mjs',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"}});
