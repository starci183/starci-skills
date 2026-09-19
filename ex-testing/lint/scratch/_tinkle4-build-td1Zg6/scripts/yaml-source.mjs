import {parseDocument,stringify} from 'yaml';
export function parseYaml(source){
 if(typeof source!=='string'||Buffer.byteLength(source)>4*1024*1024)throw Error('Invalid YAML size');
 const doc=parseDocument(source,{version:'1.2',schema:'core',uniqueKeys:true,strict:true});
 if(doc.errors.length||doc.warnings.length)throw Error('Invalid or unsupported YAML');
 return doc.toJS({maxAliasCount:0});
}
export const stringifyYaml=value=>stringify(value,{lineWidth:100,aliasDuplicateObjects:false});
