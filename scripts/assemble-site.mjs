import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
fs.cpSync(path.join(root,'sites/docs/dist'),path.join(root,'sites/skills/dist/docs'),{recursive:true});
console.log(JSON.stringify({ok:true,site:'sites/skills/dist',docs:'/docs/'}));
