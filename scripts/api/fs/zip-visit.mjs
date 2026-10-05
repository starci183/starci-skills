// zip-visit.mjs — bounded archive verification with one payload visited at a time.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {sha256,sha256File} from '../../../engine/digest.mjs';
import {zipLimits} from './zip-limits.mjs';
import {validZipName,zipRefuse as refuse} from './lib.mjs';

/** Visit one entry at a time; payloads are not retained. A callback must not commit effects before verification returns. */
export function zipVisit(file,visit,options={}){
  const limits=zipLimits(options),fd=fs.openSync(file,'r'),entries=[];
  try{
    const stat=fs.fstatSync(fd),length=stat.size;
    if(length<22)throw refuse(`${file}: truncated ZIP`);
    if(length>limits.maxArchiveBytes)throw refuse(`${file}: archive exceeds resource cap`,'zip-limit');
    const read=(at,n)=>{if(!Number.isInteger(at)||!Number.isInteger(n)||at<0||n<0||at+n>length)throw refuse(`${file}: out-of-bounds ZIP record`);const data=Buffer.alloc(n);let done=0;while(done<n){const got=fs.readSync(fd,data,done,n-done,at+done);if(!got)throw refuse(`${file}: truncated ZIP record`);done+=got;}return data;};
    const tailAt=Math.max(0,length-22-0xffff),tail=read(tailAt,length-tailAt);
    let end=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
    if(end<0)throw refuse(`${file}: no end-of-central-directory record`);
    const eocd=tailAt+end,count=tail.readUInt16LE(end+10),cdSize=tail.readUInt32LE(end+12),cdStart=tail.readUInt32LE(end+16);
    if(tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6)||tail.readUInt16LE(end+8)!==count||count===0xffff||cdStart===0xffffffff||cdSize===0xffffffff)throw refuse(`${file}: multi-disk/ZIP64 unsupported`);
    if(count>limits.maxEntries)throw refuse(`${file}: entry count exceeds resource cap`,'zip-limit');
    if(cdStart+cdSize!==eocd)throw refuse(`${file}: invalid central directory bounds`);
    let p=cdStart,total=0;const catalog=[],names=new Set();
    for(let n=0;n<count;n++){
      if(p+46>eocd)throw refuse(`${file}: truncated central directory`);
      const h=read(p,46);if(h.readUInt32LE(0)!==0x02014b50)throw refuse(`${file}: bad central entry`);
      const flags=h.readUInt16LE(8),method=h.readUInt16LE(10),crc=h.readUInt32LE(16),csize=h.readUInt32LE(20),size=h.readUInt32LE(24),nlen=h.readUInt16LE(28),xlen=h.readUInt16LE(30),clen=h.readUInt16LE(32),at=h.readUInt32LE(42);
      if((flags&~0x0800)||![0,8].includes(method)||h.readUInt16LE(34))throw refuse(`${file}: encrypted/descriptor/unsupported ZIP entry`);
      if(size>limits.maxEntryBytes||csize>limits.maxCompressedEntryBytes||(total+=size)>limits.maxTotalBytes||nlen>limits.maxNameBytes)throw refuse(`${file}: entry exceeds resource cap`,'zip-limit');
      if(p+46+nlen+xlen+clen>eocd)throw refuse(`${file}: central name/extra exceeds directory`);
      const name=read(p+46,nlen).toString('utf8');p+=46+nlen+xlen+clen;
      if(!validZipName(name)||names.has(name))throw refuse(`${file}: unsafe/duplicate ZIP entry name`);names.add(name);
      if(at+30>cdStart)throw refuse(`${file}: local header overlaps central directory`);
      const local=read(at,30),localN=local.readUInt16LE(26),start=at+30+localN+local.readUInt16LE(28);
      if(local.readUInt32LE(0)!==0x04034b50||local.readUInt16LE(6)!==flags||local.readUInt16LE(8)!==method||local.readUInt32LE(14)!==crc||local.readUInt32LE(18)!==csize||local.readUInt32LE(22)!==size||localN!==nlen||start+csize>cdStart||read(at+30,localN).toString('utf8')!==name)throw refuse(`${file}: local/central header mismatch`);
      if(method===0&&csize!==size)throw refuse(`${file}: stored size mismatch`);
      catalog.push({name,at,start,csize,size,method,crc});
    }
    if(p!==eocd)throw refuse(`${file}: central directory count/size mismatch`);
    const ranges=catalog.slice().sort((a,b)=>a.at-b.at);for(let n=1;n<ranges.length;n++)if(ranges[n].at<ranges[n-1].start+ranges[n-1].csize)throw refuse(`${file}: overlapping ZIP entries`);
    for(const entry of catalog){
      const body=read(entry.start,entry.csize);let data;
      try{data=entry.method===0?body:zlib.inflateRawSync(body,{maxOutputLength:Math.max(1,entry.size)});}catch(error){throw refuse(`${file}: entry inflate refused (${error.code??'invalid deflate'})`);}
      if(data.length!==entry.size)throw refuse(`${file}: inflated size mismatch`);
      const actual=zlib.crc32(data)>>>0,crcOk=actual===entry.crc,metadata={name:entry.name,bytes:data.length,sha256:sha256(data),crc32:actual,crcOk};
      entries.push(metadata);visit?.({...metadata,data});
    }
    const archiveSha256=sha256File(fd),after=fs.fstatSync(fd);
    if(after.size!==length||after.mtimeMs!==stat.mtimeMs)throw refuse(`${file}: archive changed during verification`);
    return {file,bytes:length,sha256:archiveSha256,entries};
  }finally{fs.closeSync(fd);}
}
