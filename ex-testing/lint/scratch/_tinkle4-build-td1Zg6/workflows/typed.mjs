import {canonicalJSON} from '../core/index.mjs';

/** Shared closed output-shape predicate for dispatch and later producer reviews. */
export function typed(value,schema) {
 if(schema.enum&&!schema.enum.some(v=>canonicalJSON(v)===canonicalJSON(value)))return false;
 if(schema.type==='null')return value===null;
 if(schema.type==='array')return Array.isArray(value)&&value.every(v=>typed(v,schema.items));
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&schema.required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>Object.hasOwn(schema.properties,k)&&typed(value[k],schema.properties[k]));
 return typeof value===schema.type&&(schema.type!=='number'||Number.isFinite(value));
}
