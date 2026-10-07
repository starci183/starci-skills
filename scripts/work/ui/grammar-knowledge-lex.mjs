import fs from 'node:fs';
import path from 'node:path';

/**
 * Source and stylesheet readers of the grammar knowledge census (grammar-knowledge.mjs): a small TS/TSX lexer,
 * the declarations and `var()` reads of a stylesheet, and the order of an entry stylesheet's relative imports.
 */
export const read=file=>fs.readFileSync(file,'utf8');
export const uniq=values=>[...new Set(values)];
const lineAt=(text,offset)=>{let line=1;for(let i=0;i<offset&&i<text.length;i++){if(text.codePointAt(i)===10)line++;}return line;};

// ---------------------------------------------------------------------------
// Source lexing: comments blanked (offsets kept), string literals collected.
// ---------------------------------------------------------------------------

const blank=(out,from,to)=>{for(let k=from;k<to;k++)if(out[k]!=='\n'&&out[k]!=='\r')out[k]=' ';};

/** A template chunk from `start`: pushed as a string; `open` says the chunk ended on `${`. */
function scanTemplate(lexer,start){
  const {source,strings}=lexer;
  const n=source.length;
  let j=start,chunk='';
  while(j<n){
    const c=source[j];
    if(c==='\\'){chunk+=source.slice(j,j+2);j+=2;continue;}
    if(c==='`'){strings.push({value:chunk,start});return {end:j+1,open:false};}
    if(c==='$'&&source[j+1]==='{'){strings.push({value:chunk,start});return {end:j+2,open:true};}
    chunk+=c;j++;
  }
  strings.push({value:chunk,start});return {end:n,open:false};
}

/** The offset after a template chunk read from `start`; a chunk that ends on `${` opens one more brace level. */
function enterTemplate(lexer,start){
  const result=scanTemplate(lexer,start);
  if(result.open){lexer.templateDepth.push(lexer.braces);lexer.braces++;}
  return result.end;
}

/** The offset after the comment at `i`, blanked. */
function skipComment(lexer,i){
  const {source,out}=lexer;
  const line=source[i+1]==='/';
  const end=line?source.indexOf('\n',i):source.indexOf('*/',i+2);
  let stop=source.length;
  if(end>=0)stop=line?end:end+2;
  blank(out,i,stop);
  return stop;
}

/** The offset after the quoted string at `i`; a quote that does not close on its own line is code. */
function scanQuoted(lexer,i){
  const {source,strings}=lexer;
  const quote=source[i];
  let j=i+1,value='',closed=false;
  while(j<source.length&&source[j]!=='\n'){
    if(source[j]==='\\'){value+=source.slice(j,j+2);j+=2;continue;}
    if(source[j]===quote){closed=true;break;}
    value+=source[j];j++;
  }
  if(!closed)return i+1;
  strings.push({value,start:i});
  return j+1;
}

/** The offset after the `}` at `i`; one that closes a `${` resumes the template. */
function closeBrace(lexer,i){
  lexer.braces--;
  if(lexer.templateDepth.length&&lexer.templateDepth.at(-1)===lexer.braces){
    lexer.templateDepth.pop();
    return enterTemplate(lexer,i+1);
  }
  return i+1;
}

/** The offset after the token at `i`. */
function lexStep(lexer,i){
  const {source}=lexer;
  const c=source[i];
  if(c==='/'&&(source[i+1]==='/'||source[i+1]==='*'))return skipComment(lexer,i);
  if(c==='"'||c==='\'')return scanQuoted(lexer,i);
  if(c==='`')return enterTemplate(lexer,i+1);
  if(c==='{'){lexer.braces++;return i+1;}
  if(c==='}')return closeBrace(lexer,i);
  return i+1;
}

/**
 * A small TS/TSX lexer. Comments become spaces (newlines kept, so offsets and lines survive); every
 * single-, double-quoted and template string chunk is returned with its offset. A quote that does not
 * close on its own line is JSX text (an apostrophe), not a string, and is left as code.
 */
export function lexSource(source){
  const lexer={source,out:source.split(''),strings:[],templateDepth:[],braces:0};
  let i=0;
  while(i<source.length)i=lexStep(lexer,i);
  return {code:lexer.out.join(''),strings:lexer.strings};
}

// ---------------------------------------------------------------------------
// Stylesheets.
// ---------------------------------------------------------------------------

/** CSS with every comment blanked, offsets and lines kept. */
export function stripCssComments(css){
  return css.replace(/\/\*[\s\S]*?\*\//g,match=>match.replace(/[^\n\r]/g,' '));
}

/** The declaration `text` holds when it is a custom property assignment: `{name, value, at}`. */
function customProperty(text){
  const match=/^\s*(--[A-Za-z0-9_-]+)\s*:([\s\S]*)$/.exec(text);
  return match?{name:match[1],value:match[2].replace(/\s+/g,' ').trim(),at:text.indexOf(match[1])}:null;
}

/**
 * Every declaration in a stylesheet with the stack of block preludes it sits in
 * (`@layer x`, `@media (...)`, the rule's selector list), its custom-property name and its value.
 */
export function cssDeclarations(css){
  const code=stripCssComments(css);
  const declarations=[];
  const stack=[];
  let segmentStart=0;
  let depthParen=0;
  for(let i=0;i<code.length;i++){
    const c=code[i];
    if(c==='(')depthParen++;
    else if(c===')')depthParen=Math.max(0,depthParen-1);
    else if(depthParen)continue;
    else if(c==='{'){stack.push(code.slice(segmentStart,i).replace(/\s+/g,' ').trim());segmentStart=i+1;}
    else if(c==='}'||c===';'){
      const declaration=customProperty(code.slice(segmentStart,i));
      if(declaration&&stack.length&&!stack.at(-1).startsWith('@')){
        declarations.push({name:declaration.name,value:declaration.value,context:[...stack],line:lineAt(code,segmentStart+declaration.at)});
      }
      if(c==='}')stack.pop();
      segmentStart=i+1;
    }
  }
  return declarations;
}

/** The offset just after the parenthesis that closes the one already open before `from`. */
function closeParen(code,from){
  let depth=1,j=from;
  while(j<code.length&&depth){
    if(code[j]==='(')depth++;
    else if(code[j]===')')depth--;
    j++;
  }
  return j;
}

/** Every `var(--name[, fallback])` read in a stylesheet, fallback kept verbatim (whitespace collapsed). */
export function cssReads(css){
  const code=stripCssComments(css);
  const reads=[];
  const pattern=/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g;
  let match;
  while((match=pattern.exec(code))){
    let fallback=null;
    if(match[2]){
      const start=pattern.lastIndex;
      fallback=code.slice(start,closeParen(code,start)-1).replace(/\s+/g,' ').trim();
    }
    reads.push({name:match[1],fallback,line:lineAt(code,match.index)});
  }
  return reads;
}

/** A stylesheet and the relative sheets it `@import`s, in cascade order, with no repeats. */
export function stylesheetSet(entry,{include=()=>true}={}){
  const seen=[];
  const visit=file=>{
    if(seen.includes(file))return;
    const text=stripCssComments(read(file));
    const imports=[...text.matchAll(/@import\s+["']([^"']+)["']\s*;/g)].map(m=>path.resolve(path.dirname(file),m[1]));
    for(const imported of imports)if(include(imported))visit(imported);
    seen.push(file);
  };
  visit(entry);
  return seen;
}
