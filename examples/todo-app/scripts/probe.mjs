import fs from 'node:fs';
const [url,mode]=process.argv.slice(2),match=fs.readFileSync('/run/secrets/app_token','utf8').match(/^app_token:\s*['"]?([a-f0-9]{64})['"]?\s*$/m);if(!match)throw Error('invalid probe secret');const token=match[1];
let response;for(let attempt=0;attempt<30;attempt++){try{response=await fetch(url+'/count',{method:mode==='increment'?'POST':'GET',headers:mode==='increment'?{authorization:`Bearer ${token}`}:{}});break}catch(error){if(attempt===29)throw error;await new Promise(resolve=>setTimeout(resolve,250))}}
if(!response.ok)throw Error(`probe failed ${response.status}`);const body=await response.json();if(!Number.isInteger(body.count))throw Error('invalid count');process.stdout.write(JSON.stringify({count:body.count}));
