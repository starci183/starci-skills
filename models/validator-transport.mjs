export const VALIDATOR_REFERENCE_BYTES=128*1024;
export const VALIDATOR_REFERENCE_FILE_BYTES=32*1024;
const text=value=>typeof value==='string'?value:Buffer.isBuffer(value)||value instanceof Uint8Array?Buffer.from(value).toString('utf8'):String(value??'');
export function normalizeResolvedReferences(entries,{maxBytes=VALIDATOR_REFERENCE_BYTES,maxFileBytes=VALIDATOR_REFERENCE_FILE_BYTES}={}){
  let used=0,truncated=false;const normalized=[];
  for(const item of Array.isArray(entries)?entries:[]){const path=String(item?.path??'').replaceAll('\\','/'),source=text(item?.bytes??item?.text??item?.content),bytes=Buffer.byteLength(source);if(!path)continue;const remaining=Math.max(0,Math.min(maxFileBytes,maxBytes-used));if(bytes>remaining)truncated=true;if(!remaining){truncated=true;continue;}const content=Buffer.from(source).subarray(0,remaining).toString('utf8');used+=Buffer.byteLength(content);normalized.push({path,
    ...(item?.rootId?{rootId:String(item.rootId)}:{}),...(item?.rootRole?{rootRole:String(item.rootRole)}:{}),
    ...(item?.sourceRef?{sourceRef:String(item.sourceRef)}:{}),...(item?.ref?{ref:String(item.ref)}:{}),
    ...(item?.fragment!==undefined&&item?.fragment!==null?{fragment:String(item.fragment)}:{}),
    text:content,bytes,transportBytes:Buffer.byteLength(content),truncated:bytes>remaining});}
  return {entries:normalized,truncated,bytes:used,limit:maxBytes};
}
