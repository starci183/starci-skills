import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {parseYaml} from '../core/yaml.mjs';
import {TOKEN_TOLERANCE,defaultGrammarRoot,deltaEOk,formatHex,oklabToOklch,parseColor,readBrandRecord,rgbToOklab} from './brand.mjs';

/**
 * A drawing is the installed grammar rendered in a browser, and this module checks that claim from the two
 * artefacts the drawing leaves behind: the PNG the browser captured and the markup it rendered. Both are read
 * as bytes, because both are the only things that cannot be argued with. A record may say "the palette is the
 * brand's" and a reviewer may agree with it while the capture is full of a purple no token declares; the
 * pixels settle it. The kept markup settles the other canon rule the same way: a list of entities wrapped in
 * a card is visible in the class attributes whatever the record says about sections.
 *
 * Nothing here renders, installs, downloads or edits: every check reads. The PNG decoder is implemented in
 * this file on top of `node:zlib` so a drawing is never checked by a dependency that may not be installed,
 * and the colour mathematics is the brand module's - one runtime, one definition of what two colours being
 * the same means.
 *
 * A check that cannot be performed is `skip` with the reason, never `pass`: a candidate with no markup beside
 * it, a PNG format this decoder does not read, a brand that names no mascot. An unproven claim must not read
 * as a proven one, so a `skip` never makes a run `ok:false` and never makes it green either.
 */
export const RENDER_CHECKS='starci/render-checks@1';
export const CHECK_IDS=['palette-off-brand','primary-absent','entity-list-in-card','mascot-slot-missing'];

/**
 * Every OKLab distance here is the brand module's x100 scale: black against white is 100, a just-noticeable
 * difference is roughly 2, and a brand token matches its source within `TOKEN_TOLERANCE` (0.5) there. A
 * capture is not a stylesheet: the same token arrives antialiased, blended over a surface, dithered by the
 * browser's own compositing, and quantised again by the bucket mean below. Twelve times the token tolerance -
 * deltaE 6, about three just-noticeable differences - is wide enough for a token that was painted at ninety
 * percent over a light surface and still narrow enough that a different hue stays a different hue.
 */
export const PALETTE_TOLERANCE=TOKEN_TOLERANCE*12;
/**
 * A bucket is an offender only when it dominates: two percent of the saturated pixels of a screen is a filled
 * button, a chart series or a banner, not the fringe of an antialiased glyph.
 */
export const MIN_BUCKET_SHARE=0.02;
/** OKLab chroma below this is grey to a reader; the brand's palette question is about colour, not about ink. */
export const CHROMA_FLOOR=0.04;
/** Lightness outside this band is the page's paper and its ink: near-white and near-black are never a palette. */
export const MIN_LIGHTNESS=0.12;
export const MAX_LIGHTNESS=0.95;
/** Steps per OKLab axis. Eight steps put roughly a tenth of the gamut in a bucket - a hue, not a shade. */
export const DEFAULT_BUCKETS=8;
/** Under half opaque is not painted: a pixel the reader cannot see is not part of the palette. */
const ALPHA_FLOOR=128;
/** Three is a list. Two rows are a pair the reader reads as two facts; three are a collection. */
export const MIN_REPEATED_ITEMS=3;
/** The card classes to look for when the family's DNA snapshot cannot be read. Only the family we ship. */
export const FALLBACK_CARD_CLASSES={starci:['starci-core-surface','starci-core-surface-card']};
const OFFENDER_CAP=20;

const slash=value=>String(value??'').replaceAll('\\','/');
const round=(value,places=4)=>Number.parseFloat(Number(value).toFixed(places));
const listOf=value=>(Array.isArray(value)?value:[]).filter(item=>item&&typeof item==='object');
const text=value=>typeof value==='string'?value:'';
const check=(id,outcome,detail,evidence={})=>({id,outcome,detail,evidence});

// ---------------------------------------------------------------------------
// The PNG decoder: signature, IHDR, IDAT, the five filters. No dependency.
// ---------------------------------------------------------------------------

const SIGNATURE=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
/** Channels per pixel by colour type. 3 is palette and is refused, so it is absent on purpose. */
const CHANNELS={0:1,2:3,4:2,6:4};
const COLOUR_TYPE_NAMES={0:'greyscale',2:'truecolour',3:'palette',4:'greyscale with alpha',6:'truecolour with alpha'};

/** The Paeth predictor of the PNG specification: the neighbour the gradient points at. */
function paeth(left,above,upperLeft){
  const estimate=left+above-upperLeft;
  const toLeft=Math.abs(estimate-left),toAbove=Math.abs(estimate-above),toUpperLeft=Math.abs(estimate-upperLeft);
  if(toLeft<=toAbove&&toLeft<=toUpperLeft)return left;
  return toAbove<=toUpperLeft?above:upperLeft;
}

/**
 * Reads the PNG shapes a headless browser capture actually is: 8 bits per channel, non-interlaced, colour
 * type 0, 2, 4 or 6. Everything else throws `unsupported png: <why>` rather than guessing: a palette image
 * decoded as truecolour would report colours nothing in the file has, and a check must never invent evidence.
 */
export function decodePng(bytes){
  const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes??[]);
  if(data.length<8)throw Error('unsupported png: the file is shorter than a PNG signature');
  for(let index=0;index<SIGNATURE.length;index+=1){
    if(data[index]!==SIGNATURE[index])throw Error('unsupported png: the first eight bytes are not a PNG signature');
  }
  let header=null;
  const parts=[];
  let offset=8;
  while(offset+8<=data.length){
    const length=data.readUInt32BE(offset);
    const type=data.toString('latin1',offset+4,offset+8);
    const start=offset+8;
    if(length>data.length||start+length+4>data.length)throw Error(`unsupported png: chunk ${type||'(unnamed)'} runs past the end of the file`);
    const body=data.subarray(start,start+length);
    if(type==='IHDR'){
      if(length<13)throw Error('unsupported png: the IHDR chunk is shorter than thirteen bytes');
      header={width:body.readUInt32BE(0),height:body.readUInt32BE(4),bitDepth:body[8],colourType:body[9],
        compression:body[10],filterMethod:body[11],interlace:body[12]};
    } else if(type==='IDAT')parts.push(body);
    else if(type==='IEND')break;
    offset=start+length+4;
  }
  if(!header)throw Error('unsupported png: the file carries no IHDR header chunk');
  if(!header.width||!header.height)throw Error('unsupported png: the header declares an empty image');
  if(header.bitDepth!==8)throw Error(`unsupported png: bit depth ${header.bitDepth} is not read, only 8`);
  if(header.colourType===3)throw Error('unsupported png: palette images are not read');
  if(!CHANNELS[header.colourType])throw Error(`unsupported png: colour type ${header.colourType} (${COLOUR_TYPE_NAMES[header.colourType]??'unknown'}) is not read`);
  if(header.compression!==0||header.filterMethod!==0)throw Error('unsupported png: the file declares a compression or filter method this decoder does not read');
  if(header.interlace!==0)throw Error('unsupported png: interlaced (Adam7) images are not read');
  if(!parts.length)throw Error('unsupported png: the file carries no IDAT image data');
  let raw;
  try{raw=zlib.inflateSync(Buffer.concat(parts));}
  catch(error){throw Error(`unsupported png: the image data does not inflate (${String(error.message??error)})`);}
  const channels=CHANNELS[header.colourType];
  const stride=header.width*channels;
  if(raw.length<(stride+1)*header.height)throw Error('unsupported png: the inflated image data is shorter than the header declares');
  const pixels=new Uint8Array(stride*header.height);
  let prior=new Uint8Array(stride);
  for(let row=0;row<header.height;row+=1){
    const at=row*(stride+1);
    const filter=raw[at];
    if(filter>4)throw Error(`unsupported png: filter type ${filter} is not one of 0 to 4`);
    const line=raw.subarray(at+1,at+1+stride);
    const out=pixels.subarray(row*stride,(row+1)*stride);
    for(let index=0;index<stride;index+=1){
      const left=index>=channels?out[index-channels]:0;
      const above=prior[index];
      const upperLeft=index>=channels?prior[index-channels]:0;
      const value=filter===0?line[index]
        :filter===1?line[index]+left
        :filter===2?line[index]+above
        :filter===3?line[index]+((left+above)>>1)
        :line[index]+paeth(left,above,upperLeft);
      out[index]=value&0xff;
    }
    prior=out;
  }
  return {width:header.width,height:header.height,channels,colourType:header.colourType,bitDepth:header.bitDepth,pixels};
}

/** The pixel at this offset as `[red, green, blue, alpha]`, whatever the colour type spells it as. */
function pixelAt(png,at){
  const {pixels,channels}=png;
  if(channels===1)return [pixels[at],pixels[at],pixels[at],255];
  if(channels===2)return [pixels[at],pixels[at],pixels[at],pixels[at+1]];
  if(channels===3)return [pixels[at],pixels[at+1],pixels[at+2],255];
  return [pixels[at],pixels[at+1],pixels[at+2],pixels[at+3]];
}

/**
 * The colours the capture is actually made of, as OKLab buckets of its saturated pixels. Near-white,
 * near-black, grey and anything under half opaque are dropped first: they are the page's paper, its ink and
 * its borders, and no brand is judged by them. What remains is bucketed on a fixed OKLab grid so a gradient
 * or an antialiased edge collapses into the colour it is a shade of, and each bucket reports the mean of the
 * pixels that landed in it - the colour a reader would name if asked.
 */
export function dominantColours(png,{buckets=DEFAULT_BUCKETS,chromaFloor=CHROMA_FLOOR,minLightness=MIN_LIGHTNESS,maxLightness=MAX_LIGHTNESS}={}){
  const steps=Math.max(2,Math.floor(buckets));
  const grid=new Map();
  let saturated=0,considered=0;
  const quantize=(value,low,high)=>Math.min(steps-1,Math.max(0,Math.floor((value-low)/(high-low)*steps)));
  for(let at=0;at<png.pixels.length;at+=png.channels){
    const [red,green,blue,alpha]=pixelAt(png,at);
    if(alpha<ALPHA_FLOOR)continue;
    considered+=1;
    const oklab=rgbToOklab([red,green,blue]);
    if(oklab.L<minLightness||oklab.L>maxLightness)continue;
    if(Math.hypot(oklab.a,oklab.b)<chromaFloor)continue;
    saturated+=1;
    const key=`${quantize(oklab.L,0,1)}:${quantize(oklab.a,-0.4,0.4)}:${quantize(oklab.b,-0.4,0.4)}`;
    const bucket=grid.get(key);
    if(bucket){bucket.count+=1;bucket.L+=oklab.L;bucket.a+=oklab.a;bucket.b+=oklab.b;}
    else grid.set(key,{count:1,L:oklab.L,a:oklab.a,b:oklab.b});
  }
  const found=[...grid.values()].map(bucket=>{
    const oklab={L:bucket.L/bucket.count,a:bucket.a/bucket.count,b:bucket.b/bucket.count};
    return {hex:hexOfOklab(oklab),share:round(bucket.count/saturated,4),count:bucket.count,oklab,
      chroma:round(Math.hypot(oklab.a,oklab.b),4)};
  }).sort((first,second)=>second.count-first.count||first.hex.localeCompare(second.hex));
  found.saturated=saturated;
  found.considered=considered;
  return found;
}

/** The mean of a bucket back as a hex colour, through the same sRGB transfer function the brand module uses. */
function hexOfOklab(oklab){
  const parsed=parseColor(`oklch(${oklab.L} ${round(oklabToOklch(oklab).C,6)} ${round(oklabToOklch(oklab).h,4)})`);
  return parsed?parsed.hex:'#000000';
}

// ---------------------------------------------------------------------------
// The brand's own colours, as a flat list every check compares against.
// ---------------------------------------------------------------------------

/**
 * Every colour the brand record declares, flattened: the tokens with their roles, every step of every scale,
 * and the dark answer when the record gives one. A capture may be the dark theme, and a scale step is as much
 * the brand as the token it was derived from, so all of them count as "a brand colour".
 */
export function brandColours(brand){
  const found=[];
  const push=(label,value,role=null,scope='base')=>{
    const parsed=parseColor(value);
    if(parsed)found.push({label,value:String(value),role,scope,hex:parsed.hex,color:parsed});
  };
  const set=(source,scope)=>{
    for(const token of listOf(source?.tokens))if(typeof token.token==='string')push(token.token,token.value,token.role??null,scope);
    for(const scale of listOf(source?.scales)){
      for(const step of listOf(scale.steps))push(`${scale.name??'scale'}/${step.step??'?'}`,step.value,null,scope);
    }
  };
  set(brand?.color,'base');
  set(brand?.color?.dark,'dark');
  return found;
}

const nearest=(colour,palette)=>palette.reduce((best,entry)=>{
  const distance=deltaEOk(colour,entry.color);
  return !best||distance<best.distance?{...entry,distance:round(distance,2)}:best;
},null);

/**
 * The two colour rules of the canon, read from the capture's own pixels.
 *
 * `palette-off-brand` fails when a colour the render is largely made of is not a colour the brand declares:
 * the render's palette is the brand's tokens and scale steps, and nothing else. `primary-absent` fails when
 * the brand's primary is nowhere in the capture - a screen drawn in the brand's neutrals with the brand's
 * primary missing is off-brand exactly as much as one drawn in a foreign purple.
 */
export function checkPalette({png,brand,buckets=DEFAULT_BUCKETS}){
  const palette=brandColours(brand);
  const base={tolerance:PALETTE_TOLERANCE,scale:'OKLab delta-E x100',minimumShare:MIN_BUCKET_SHARE,
    brandColours:palette.length,chromaFloor:CHROMA_FLOOR,lightnessBand:[MIN_LIGHTNESS,MAX_LIGHTNESS]};
  if(!palette.length)return [
    check('palette-off-brand','skip','The brand record declares no colour this runtime can parse, so the capture\'s palette was compared against nothing.',base),
    check('primary-absent','skip','The brand record declares no colour this runtime can parse, so no primary could be looked for.',base)];
  const found=dominantColours(png,{buckets});
  const evidence={...base,saturatedPixels:found.saturated,pixels:found.considered,buckets:found.length,
    dominant:found.filter(bucket=>bucket.share>=MIN_BUCKET_SHARE).slice(0,OFFENDER_CAP).map(bucket=>({hex:bucket.hex,share:bucket.share}))};
  const offenders=[];
  for(const bucket of found){
    if(bucket.share<MIN_BUCKET_SHARE)continue;
    const match=nearest({oklab:bucket.oklab},palette);
    if(match.distance>PALETTE_TOLERANCE)offenders.push({hex:bucket.hex,share:bucket.share,pixels:bucket.count,
      nearest:match.label,nearestHex:match.hex,nearestScope:match.scope,deltaE:match.distance});
  }
  const offBrand=!found.saturated
    ?check('palette-off-brand','skip','The capture carries no saturated pixel at all, so it holds no palette to compare against the brand.',evidence)
    :offenders.length
      ?check('palette-off-brand','fail',`${offenders.length} dominant colour${offenders.length===1?'':'s'} of the capture match no brand token or scale step: ${offenders.map(entry=>`${entry.hex} (${Math.round(entry.share*100)}% of the saturated pixels, nearest ${entry.nearest} at deltaE ${entry.deltaE})`).join(', ')}.`,
        {...evidence,offenders:offenders.slice(0,OFFENDER_CAP),offenderCount:offenders.length,capped:offenders.length>OFFENDER_CAP})
      :check('palette-off-brand','pass',`Every colour the capture is largely made of is a brand token or scale step within deltaE ${PALETTE_TOLERANCE}.`,{...evidence,offenders:[],offenderCount:0});
  const primary=palette.find(entry=>entry.role==='primary'&&entry.scope==='base')??palette.find(entry=>entry.role==='primary');
  const absent=(()=>{
    const at={...evidence,primary:primary?{token:primary.label,value:primary.value,hex:primary.hex}:null};
    if(!primary)return check('primary-absent','skip','The brand declares no colour token with the role `primary`, so none could be looked for in the capture.',at);
    if(primary.color.oklch.C<CHROMA_FLOOR)return check('primary-absent','skip',`The brand's primary \`${primary.label}\` is itself a grey (OKLab chroma ${round(primary.color.oklch.C,3)} under the ${CHROMA_FLOOR} floor), and this check reads saturated pixels only.`,at);
    if(!found.saturated)return check('primary-absent','fail',`The capture carries no saturated pixel at all, so the brand's primary \`${primary.label}\` (${primary.hex}) appears nowhere in it.`,at);
    const closest=found.reduce((best,bucket)=>{
      const distance=deltaEOk({oklab:bucket.oklab},primary.color);
      return !best||distance<best.deltaE?{hex:bucket.hex,share:bucket.share,deltaE:round(distance,2)}:best;
    },null);
    return closest.deltaE<=PALETTE_TOLERANCE
      ?check('primary-absent','pass',`The brand's primary \`${primary.label}\` (${primary.hex}) is in the capture as ${closest.hex}, ${Math.round(closest.share*100)}% of its saturated pixels.`,{...at,closest})
      :check('primary-absent','fail',`The brand's primary \`${primary.label}\` (${primary.hex}) appears in no bucket of the capture; the closest colour it carries is ${closest.hex} at deltaE ${closest.deltaE} (floor ${PALETTE_TOLERANCE}).`,{...at,closest});
  })();
  return [offBrand,absent];
}

// ---------------------------------------------------------------------------
// The kept markup: a tolerant tag scanner, and the card rule read from it.
// ---------------------------------------------------------------------------

const VOID_TAGS=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const HEADING_TAGS=new Set(['h1','h2','h3','h4']);
const SECTION_HEADER_CLASS=/(^|-)section-header$/;
/** Tags a repeated entity row is actually made of; a run of three siblings of any other tag is not a list. */
const ROW_TAGS=new Set(['div','li','tr','article','section','a']);

/**
 * A tolerant scanner, not a parser: it reads start tags, end tags and their class attributes and builds the
 * ancestry from them. No DOM library is installed for a runtime that must run anywhere, and none is needed -
 * the two questions asked of this markup are "which element carries a card class" and "which elements are
 * repeated siblings", and both are answered by tag names, class lists and nesting. Unclosed tags, stray end
 * tags, comments, doctypes and the contents of `script`/`style` are survived rather than rejected, because a
 * browser survived them too when it captured the picture beside the file.
 */
export function scanMarkup(html){
  const source=String(html??'');
  const root={tag:'#root',classes:[],children:[],parent:null,depth:0};
  const stack=[root];
  const pattern=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!\s*[^>]*>|<\/\s*([A-Za-z][\w:-]*)\s*>|<([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let nodes=0;
  for(const match of source.matchAll(pattern)){
    const closing=match[1],opening=match[2];
    if(closing){
      const tag=closing.toLowerCase();
      const at=stack.map(node=>node.tag).lastIndexOf(tag);
      if(at>0)stack.length=at;
      continue;
    }
    if(!opening)continue;
    const tag=opening.toLowerCase();
    const attributes=match[3]??'';
    const selfClosing=match[4]==='/';
    const classAttribute=/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
    const classes=(classAttribute?.[1]??classAttribute?.[2]??classAttribute?.[3]??'').trim().split(/\s+/).filter(Boolean);
    const parent=stack[stack.length-1];
    const node={tag,classes,children:[],parent,depth:parent.depth+1};
    parent.children.push(node);
    nodes+=1;
    if(!selfClosing&&!VOID_TAGS.has(tag)&&tag!=='script'&&tag!=='style')stack.push(node);
  }
  root.nodes=nodes;
  return root;
}

const walk=function*(node){
  for(const child of node.children){yield child;yield* walk(child);}
};

/**
 * The card classes of one grammar family, from the family's own DNA snapshot when the host carries one. Only
 * the classes that name the card surface itself are kept - a class ending in `-surface` or `-surface-card`,
 * with any `--modifier` suffix removed - because the DNA lists a card's inner parts (`-surface-content`,
 * `-surface-label`) under the same component and those are regions inside a card, not a card.
 */
export function cardClassesOf({family,grammarRoot=defaultGrammarRoot()}={}){
  const fallback=FALLBACK_CARD_CLASSES[String(family??'')]??[];
  if(!family||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(family)))return {source:'fallback',classes:fallback,error:'the drawing names no usable grammar family'};
  const candidates=['DNA.yaml','DNA.yml','DNA.json'].map(name=>path.join(grammarRoot,String(family),name));
  const file=candidates.find(candidate=>fs.existsSync(candidate)&&fs.lstatSync(candidate).isFile());
  if(!file)return {source:'fallback',classes:fallback,error:`the host carries no DNA snapshot for grammar family \`${family}\``};
  try{
    const body=fs.readFileSync(file,'utf8');
    const dna=path.extname(file).toLowerCase()==='.json'?JSON.parse(body):parseYaml(body);
    const cards=(Array.isArray(dna?.renderers)?dna.renderers:[]).filter(entry=>/card$/i.test(String(entry?.component??'')));
    const classes=[...new Set(cards.flatMap(entry=>(Array.isArray(entry.classes)?entry.classes:[])
      .filter(name=>typeof name==='string')
      .map(name=>name.split('--')[0])
      .filter(name=>/-surface(-card)?$/.test(name))))].sort();
    return classes.length?{source:slash(file),classes,error:null}:{source:'fallback',classes:fallback,error:'the DNA snapshot declares no card surface class'};
  }catch(error){return {source:'fallback',classes:fallback,error:`unreadable DNA snapshot: ${String(error.message??error)}`};}
}

/** The repeated-sibling groups of one element: three or more `li`/`tr` children, or three sharing one class. */
function repeatedGroups(node){
  const groups=[];
  const byTag=new Map();
  const byClass=new Map();
  for(const child of node.children){
    if(child.tag==='li'||child.tag==='tr')byTag.set(child.tag,(byTag.get(child.tag)??0)+1);
    if(!ROW_TAGS.has(child.tag))continue;
    for(const name of new Set(child.classes))byClass.set(name,(byClass.get(name)??0)+1);
  }
  for(const [tag,count] of byTag)if(count>=MIN_REPEATED_ITEMS)groups.push({by:'tag',item:tag,items:count});
  for(const [name,count] of byClass)if(count>=MIN_REPEATED_ITEMS)groups.push({by:'class',item:name,items:count});
  return groups.sort((first,second)=>second.items-first.items||first.item.localeCompare(second.item));
}

/** The nearest ancestor carrying a card class of this family, or null when the element sits outside every card. */
const cardAncestor=(node,cards)=>{
  for(let at=node.parent;at;at=at.parent){
    const found=at.classes.find(name=>cards.has(name));
    if(found)return {class:found,tag:at.tag};
  }
  return null;
};

/**
 * Whether an element is a page section: the `section` element wins wherever it sits in the ancestry, and an
 * element a heading introduces - an `h1` to `h4`, or the grammar's own section header - is one too.
 */
function sectionContext(node){
  for(let at=node;at;at=at.parent)if(at.tag==='section')return {as:'section',tag:'section'};
  for(let at=node;at;at=at.parent){
    const siblings=at.parent?.children??[];
    const heading=siblings.slice(0,siblings.indexOf(at)).reverse()
      .find(sibling=>HEADING_TAGS.has(sibling.tag)||sibling.classes.some(name=>SECTION_HEADER_CLASS.test(name)));
    if(heading)return {as:'heading',tag:heading.tag,heading:heading.classes.find(name=>SECTION_HEADER_CLASS.test(name))??heading.tag};
  }
  return null;
}

/**
 * COLLECTION-1 read from the markup the browser rendered: a list of entities is a page section with a
 * heading, never wrapped in a card. A card is one item (COLLECTION-2), so three or more repeated rows inside
 * one - a `ul`/`ol`/`table` of `li`/`tr`, or three siblings sharing a class - is the defect the owner ruled on.
 * The same list in a `section`, or under a heading, is what the rule asks for and passes.
 */
export function checkEntityListInCard(html,{family='starci',grammarRoot=defaultGrammarRoot(),cards=null}={}){
  const id='entity-list-in-card';
  const known=cards?{source:'given',classes:cards,error:null}:cardClassesOf({family,grammarRoot});
  const evidence={family:family??null,cardClasses:known.classes,cardClassSource:known.source,minimumItems:MIN_REPEATED_ITEMS};
  if(!String(html??'').trim())return check(id,'skip','No markup was kept beside this capture, so the render\'s own structure could not be read.',evidence);
  if(!known.classes.length)return check(id,'skip',`No card class is known for this render (${known.error??'the family declares none'}), so a card could not be told from a section.`,evidence);
  const root=scanMarkup(html);
  const cardSet=new Set(known.classes);
  const inCards=[],inSections=[];
  for(const node of walk(root)){
    const groups=repeatedGroups(node);
    if(!groups.length)continue;
    const group=groups[0];
    const holder=node.tag==='tbody'||node.tag==='thead'?node.parent??node:node;
    const card=cardAncestor(holder,cardSet);
    const entry={list:holder.tag,items:group.items,by:group.by,item:group.item};
    if(card)inCards.push({...entry,card:card.class,cardTag:card.tag});
    else {
      const section=sectionContext(holder);
      inSections.push({...entry,...(section?{section:section.as,heading:section.heading??section.tag}:{outside:'no section or heading introduces it'})});
    }
  }
  const measured={...evidence,elements:root.nodes,inCards:inCards.slice(0,OFFENDER_CAP),inSections:inSections.slice(0,OFFENDER_CAP),
    inCardCount:inCards.length,inSectionCount:inSections.length};
  if(inCards.length)return check(id,'fail',`${inCards.length} list${inCards.length===1?'':'s'} of repeated entities sit inside a card surface: ${inCards.slice(0,OFFENDER_CAP).map(entry=>`${entry.items} \`${entry.item}\` items in a \`${entry.list}\` inside \`${entry.card}\``).join(', ')}. A list of entities is a page section with a heading; a card is one item.`,measured);
  return check(id,'pass',inSections.length
    ?`Every list of repeated entities in the kept markup (${inSections.length}) sits outside a card surface.`
    :'The kept markup carries no list of three or more repeated entities, so no collection is wrapped in a card.',measured);
}

// ---------------------------------------------------------------------------
// The mascot: where the brand allows it, the drawing declares a slot for it.
// ---------------------------------------------------------------------------

const MASCOT_REFERENCE=/brand\/assets\/mascot/i;
const normalize=value=>String(value??'').toLowerCase().trim();
/** Two names name the same thing when one contains the other; three characters at the least, or `ui` matches everything. */
const names=(one,two)=>{
  const first=normalize(one),second=normalize(two);
  if(first.length<3||second.length<3)return false;
  return first.includes(second)||second.includes(first);
};

/**
 * BRAND-2 as far as a record can answer it: the mascot appears exactly where the brand names a slot. Where the
 * brand's `mascot.allowedIn` names this surface, the drawing must declare an `artworkSlots` entry for the
 * mascot - naming it, or naming a `brand/assets/mascot` master - so the asset operation can draw it and the
 * build can wire it. A surface the brand does not name skips: an allowance is not an obligation everywhere.
 */
export function checkMascotSlot({record,brand,screen}){
  const id='mascot-slot-missing';
  const mascot=brand?.mascot;
  const surface=typeof screen==='string'?{name:screen,route:null}:(screen??{});
  const evidence={screen:surface.name??null,route:surface.route??null,mascot:mascot?.name??null,
    allowedIn:Array.isArray(mascot?.allowedIn)?mascot.allowedIn:[]};
  if(!mascot||!mascot.name)return check(id,'skip','The brand record names no mascot, so no surface can be missing one.',evidence);
  if(!evidence.allowedIn.length)return check(id,'skip',`The brand names the mascot \`${mascot.name}\` but allows it on no surface, so none is missing it.`,evidence);
  const allowed=evidence.allowedIn.filter(entry=>names(entry,surface.name)||names(entry,surface.route));
  if(!allowed.length)return check(id,'skip',`The brand does not allow the mascot on \`${surface.name??surface.route??'this surface'}\`, so no slot is expected there.`,evidence);
  const slots=listOf(record?.ui?.artworkSlots).filter(slot=>!slot.screen||names(slot.screen,surface.name)||names(slot.screen,surface.route));
  const carrying=slots.filter(slot=>{
    const words=[text(slot.purpose),text(slot.brief),...(Array.isArray(slot.references)?slot.references.map(text):[])].join(' ');
    return normalize(words).includes(normalize(mascot.name))||MASCOT_REFERENCE.test(words);
  });
  const measured={...evidence,allowedBy:allowed,slotsOnScreen:slots.map(slot=>slot.id??slot.purpose??'(unnamed)'),
    carrying:carrying.map(slot=>slot.id??slot.purpose??'(unnamed)')};
  return carrying.length
    ?check(id,'pass',`The brand allows the mascot \`${mascot.name}\` on \`${surface.name??surface.route}\` (${allowed.join(', ')}) and the record declares ${carrying.length} artwork slot${carrying.length===1?'':'s'} for it.`,measured)
    :check(id,'fail',`The brand allows the mascot \`${mascot.name}\` on \`${surface.name??surface.route}\` (${allowed.join(', ')}) but the record declares no artwork slot naming it or a brand/assets/mascot master.`,measured);
}

// ---------------------------------------------------------------------------
// The run: every candidate of one ui node, against one brand.
// ---------------------------------------------------------------------------

const readNodeRecord=uiDir=>{
  const file=path.join(path.resolve(uiDir),'index.yaml');
  if(!fs.existsSync(file)||!fs.lstatSync(file).isFile())throw Error(`No design record: expected ${slash(file)}.`);
  const record=parseYaml(fs.readFileSync(file,'utf8'));
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('A design record must be a YAML mapping.');
  if(!record.ui||typeof record.ui!=='object'||Array.isArray(record.ui))throw Error('The node at this path carries no `ui:` design specification.');
  return {file,record};
};

/** The PNG captures the record declares, with the markup kept beside each one. */
function candidatesOf(uiDir,record){
  const root=path.resolve(uiDir);
  return listOf(record?.ui?.assets).filter(asset=>typeof asset.path==='string'&&/\.png$/i.test(asset.path)).map(asset=>{
    const declared=slash(asset.path);
    const entry={path:declared,role:asset.role??null,provenance:asset.provenance??null};
    if(path.isAbsolute(declared)||declared.split('/').includes('..'))return {...entry,error:'the declared path escapes the ui node'};
    const png=path.resolve(root,declared);
    if(path.relative(root,png).startsWith('..'))return {...entry,error:'the declared path escapes the ui node'};
    if(!fs.existsSync(png)||!fs.lstatSync(png).isFile())return {...entry,error:'this node does not carry the declared capture'};
    const markup=png.replace(/\.png$/i,'.html');
    return {...entry,png,markup:fs.existsSync(markup)&&fs.lstatSync(markup).isFile()?markup:null};
  });
}

/**
 * Every render check of one ui node against one brand record. `uiDir` is the design node that owns the
 * captures; `brandTree` is the Work tree (or a repository root) whose brand record they were drawn against.
 * The result is `ok` only when no check failed - a skipped check never makes a drawing proven.
 */
export function runRenderChecks({uiDir,brandTree,family=null,grammarRoot=defaultGrammarRoot()}={}){
  if(!uiDir)throw Error('runRenderChecks needs a ui node directory.');
  if(!brandTree)throw Error('runRenderChecks needs the Work tree that owns the brand record.');
  const {file,record}=readNodeRecord(uiDir);
  const identity=readBrandRecord(brandTree);
  const grammarFamily=family??identity.family??null;
  const cards=cardClassesOf({family:grammarFamily,grammarRoot});
  const found=candidatesOf(uiDir,record);
  const checks=[];
  const candidates=[];
  for(const candidate of found){
    const at={...candidate,png:candidate.png?slash(path.relative(path.resolve(uiDir),candidate.png)):null,
      markup:candidate.markup?slash(path.relative(path.resolve(uiDir),candidate.markup)):null};
    if(candidate.error){
      candidates.push({...at,decoded:false});
      for(const id of ['palette-off-brand','primary-absent'])checks.push(check(id,'skip',`The candidate \`${candidate.path}\` could not be read: ${candidate.error}.`,{candidate:candidate.path}));
      checks.push(check('entity-list-in-card','skip',`The candidate \`${candidate.path}\` could not be read: ${candidate.error}.`,{candidate:candidate.path}));
      continue;
    }
    let png=null,failure=null;
    try{png=decodePng(fs.readFileSync(candidate.png));}
    catch(error){failure=String(error.message??error);}
    candidates.push({...at,decoded:Boolean(png),...(png?{width:png.width,height:png.height,colourType:png.colourType}:{error:failure})});
    if(png)for(const result of checkPalette({png,brand:identity.brand}))checks.push({...result,evidence:{...result.evidence,candidate:at.png}});
    else for(const id of ['palette-off-brand','primary-absent'])checks.push(check(id,'skip',`The capture \`${at.png}\` could not be decoded: ${failure}.`,{candidate:at.png}));
    const markup=candidate.markup?fs.readFileSync(candidate.markup,'utf8'):'';
    const structure=candidate.markup
      ?checkEntityListInCard(markup,{family:grammarFamily,grammarRoot,cards:cards.classes.length?cards.classes:null})
      :check('entity-list-in-card','skip',`No markup is kept beside \`${at.png}\` as \`${slash(path.basename(at.png).replace(/\.png$/i,'.html'))}\`, so the render's own structure could not be read.`,{candidate:at.png});
    checks.push({...structure,evidence:{...structure.evidence,candidate:at.png}});
  }
  if(!found.length){
    for(const id of ['palette-off-brand','primary-absent','entity-list-in-card'])
      checks.push(check(id,'skip','The design record declares no PNG capture under its assets/, so there is no render to read.',{record:slash(path.relative(path.resolve(uiDir),file))}));
  }
  const surfaces=listOf(record?.ui?.surfaces);
  if(surfaces.length)for(const surface of surfaces)checks.push(checkMascotSlot({record,brand:identity.brand,screen:surface}));
  else checks.push(check('mascot-slot-missing','skip','The design record names no surface, so no surface could be checked for a mascot slot.',{record:slash(path.relative(path.resolve(uiDir),file))}));
  return {schema:RENDER_CHECKS,ok:checks.every(result=>result.outcome!=='fail'),checks,candidates,
    node:{record:slash(file),surfaces:surfaces.length,candidates:found.length},
    brand:{rev:identity.rev,family:grammarFamily,revSource:identity.revSource,record:slash(identity.file)},
    grammar:{family:grammarFamily,cardClasses:cards.classes,source:cards.source,...(cards.error?{note:cards.error}:{})}};
}

/** One line per check, for a person reading a terminal. */
export function formatRenderChecks(result){
  const mark={pass:'pass',fail:'FAIL',skip:'skip'};
  const lines=[`render ${result.brand.family??'(no family)'} rev ${result.brand.rev}: ${result.node.candidates} candidate${result.node.candidates===1?'':'s'}, ${result.ok?'no failing check':'failing checks'}`];
  for(const entry of result.checks)lines.push(`  [${mark[entry.outcome]}] ${entry.id}: ${entry.detail}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// The kernel hook.
// ---------------------------------------------------------------------------

/**
 * The ui node an operation wrote, from the allowlist it was given or from the files its diff touched. An
 * allowlist names either the record (`.../ui/<node>/index.yaml`) or the folder (`.../ui/<node>/**`), and a
 * diff names the record; all three point at the same directory, which is what the checks read.
 */
export function uiDirOf({op={},files=[]}={}){
  const paths=[...(Array.isArray(op.allowlist)?op.allowlist:[]),...(Array.isArray(files)?files:[])].map(slash).filter(Boolean);
  for(const entry of paths){
    const trimmed=entry.replace(/\/\*+$/,'').replace(/\/+$/,'');
    if(!/(^|\/)ui(\/|$)/.test(trimmed))continue;
    return /\.[A-Za-z0-9]+$/.test(trimmed)?path.posix.dirname(trimmed):trimmed;
  }
  return null;
}

/**
 * The hook the kernel calls on an accepted drawing, before the validator: the two canon rules, read from the
 * bytes the operation produced. It returns `null` - not a green result - when the operation wrote no design
 * record, so an operation that has nothing to do with a drawing is never reported as a drawing that passed.
 */
export function renderChecksFor({op={},state=null,ctx={},files=[]}={}){
  const declared=uiDirOf({op,files});
  if(!declared)return null;
  const at=ctx?.work?.at??{};
  const workRoot=at.workRoot?String(at.workRoot):at.repoRoot?path.join(String(at.repoRoot),'.starciwork'):null;
  if(!workRoot)return null;
  const uiDir=path.isAbsolute(declared)?declared:path.resolve(workRoot,declared);
  if(!fs.existsSync(path.join(uiDir,'index.yaml')))return null;
  try{
    const result=runRenderChecks({uiDir,brandTree:workRoot});
    return {ok:result.ok,checks:result.checks};
  }catch(error){
    // A tree with no brand record, or a node with no `ui:` spec, is a broken input rather than a failed
    // drawing: it is reported as one unproven claim, never as a passing one and never as a defect.
    return {ok:true,checks:[check('render-checks-unavailable','skip',`The render checks could not run: ${String(error.message??error)}`,{uiDir:slash(uiDir),workRoot:slash(workRoot)})]};
  }
}
