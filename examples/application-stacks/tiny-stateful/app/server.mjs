import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const secretFile=process.env.APP_TOKEN_FILE??'/run/secrets/app_token';
const dataFile='/var/lib/app/counter.json';
let token;try{if(!fs.statSync(secretFile).isFile())throw Error('secret path is not a file');const match=fs.readFileSync(secretFile,'utf8').match(/^app_token:\s*['"]?([a-f0-9]{64})['"]?\s*$/m);if(!match)throw Error('invalid app_token document');token=match[1];}catch(e){console.error(`secret file unavailable: ${e.message}`);process.exit(1)}
fs.mkdirSync(path.dirname(dataFile),{recursive:true});
const read=()=>{try{const value=JSON.parse(fs.readFileSync(dataFile,'utf8'));if(!Number.isInteger(value?.count)||value.count<0)throw Error('invalid counter state');return value}catch(error){if(error?.code==='ENOENT')return {count:0};throw error}};
const write=value=>{const tmp=`${dataFile}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value));fs.renameSync(tmp,dataFile)};
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}))}if(req.url==='/count'&&req.method==='POST'){if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);return res.end()}const state=read();state.count++;write(state);res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(state))}if(req.url==='/count'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(read()))}res.writeHead(404);res.end()});
server.listen(8080,'0.0.0.0');
