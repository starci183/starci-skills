// brand-colour.mjs - the colour mathematics of the brand checks (brand.mjs): sRGB <-> linear <-> OKLab <-> oklch, colour
// parsing and WCAG contrast. Pure: nothing here reads a file, so a brand is never proven by a dependency that may not be installed.

const COLOUR_REGEX=Object.freeze({percent:new RegExp(['^[-+]?',String.raw`\d*`,String.raw`\.?`,String.raw`\d+%$`].join('')),number:new RegExp(['^[-+]?',String.raw`\d*`,String.raw`\.?`,String.raw`\d+`,String.raw`(?:e[-+]?\d+)?$`].join(''),'i'),important:new RegExp([String.raw`\s*`,'!important$'].join(''),'i'),call:new RegExp(['^(oklch|rgba?)',String.raw`\(`,String.raw`\s*`,'([^)]*)',String.raw`\)$`].join(''),'i')});

/** `value` without a trailing `!important`. */
export const stripImportant=value=>value.replace(COLOUR_REGEX.important,'');

// ---------------------------------------------------------------------------
// Colour mathematics: sRGB <-> linear <-> OKLab <-> oklch, and WCAG contrast.
// ---------------------------------------------------------------------------

const clamp01=value=>{if(value<0){return 0;}if(value>1){return 1;}return value;};
/** sRGB transfer function and its inverse; the piecewise form, not the 2.2 approximation. */
const srgbToLinear=channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
const linearToSrgb=channel=>channel<=0.0031308?channel*12.92:1.055*channel**(1/2.4)-0.055;

/** Linear-light sRGB (0..1 each) to OKLab. */
function linearRgbToOklab([red,green,blue]){
  const long=Math.cbrt(0.4122214708*red+0.5363325363*green+0.0514459929*blue);
  const medium=Math.cbrt(0.2119034982*red+0.6806995451*green+0.1073969566*blue);
  const short=Math.cbrt(0.0883024619*red+0.2817188376*green+0.6299787005*blue);
  return {L:0.2104542553*long+0.7936177850*medium-0.0040720468*short,
    a:1.9779984951*long-2.4285922050*medium+0.4505937099*short,
    b:0.0259040371*long+0.7827717662*medium-0.8086757660*short};
}

/** OKLab to linear-light sRGB (unclamped: a value outside 0..1 is outside the sRGB gamut). */
function oklabToLinearRgb({L,a,b}){
  const long=(L+0.3963377774*a+0.2158037573*b)**3;
  const medium=(L-0.1055613458*a-0.0638541728*b)**3;
  const short=(L-0.0894841775*a-1.2914855480*b)**3;
  return [4.0767416621*long-3.3077115913*medium+0.2309699292*short,
    -1.2684380046*long+2.6097574011*medium-0.3413193965*short,
    -0.0041960863*long-0.7034186147*medium+1.7076147010*short];
}

export const rgbToOklab=([red,green,blue])=>linearRgbToOklab([srgbToLinear(red/255),srgbToLinear(green/255),srgbToLinear(blue/255)]);
/** Out-of-gamut OKLab clips per channel; `clipped` says so rather than hiding it. */
export function oklabToRgb(lab){
  const linear=oklabToLinearRgb(lab);
  const clipped=linear.some(channel=>channel<-1e-6||channel>1+1e-6);
  return {rgb:linear.map(channel=>Math.round(clamp01(linearToSrgb(clamp01(channel)))*255)),clipped};
}

export function oklabToOklch({L,a,b}){
  const chroma=Math.hypot(a,b);
  const hue=chroma<1e-7?0:(Math.atan2(b,a)*180/Math.PI+360)%360;
  return {L,C:chroma,h:hue};
}
export const oklchToOklab=({L,C,h})=>({L,a:C*Math.cos(h*Math.PI/180),b:C*Math.sin(h*Math.PI/180)});
export const formatHex=rgb=>`#${rgb.map(channel=>Math.max(0,Math.min(255,Math.round(channel))).toString(16).padStart(2,'0')).join('')}`;

const number=(text,{percentOf=1}={})=>{
  const value=String(text).trim();
  if(COLOUR_REGEX.percent.test(value))return Number.parseFloat(value)/100*percentOf;
  if(COLOUR_REGEX.number.test(value))return Number.parseFloat(value);
  if(/^none$/i.test(value))return 0;
  return null;
};

/**
 * Parses the colour notations a brand record and a stylesheet actually use: `#rgb`/`#rgba`/`#rrggbb`/
 * `#rrggbbaa`, `oklch(L C H[/a])` and `rgb()/rgba()`. Alpha is read and reported but never compared:
 * a token's identity is its colour. Anything else - a named colour, `var()`, `color-mix()`, `calc()` -
 * returns null so the caller fails loudly instead of guessing a value.
 */
export function parseColor(input){
  const value=String(input??'').trim().replace(COLOUR_REGEX.important,'');
  if(!value)return null;
  const hex=/^#([0-9a-f]{3,8})$/i.exec(value);
  return hex?parseHexColor(hex[1],value):parseFunctionColor(value);
}

function parseHexColor(body,raw){
  if(![3,4,6,8].includes(body.length))return null;
  const pairs=body.length<=4?[...body].map(char=>char+char):body.match(/../g);
  const [red,green,blue,alpha]=pairs.map(pair=>Number.parseInt(pair,16));
  return color({notation:'hex',rgb:[red,green,blue],alpha:alpha===undefined?1:alpha/255,raw});
}

function parseFunctionColor(value){
  const call=COLOUR_REGEX.call.exec(value);
  if(!call)return null;
  const kind=call[1].toLowerCase();
  const [head,tail]=call[2].split('/');
  const parts=head.trim().split(/[\s,]+/).filter(Boolean);
  if(parts.length<3)return null;
  const alpha=tail===undefined?1:number(tail,{percentOf:1});
  return kind==='oklch'?parseOklchParts(parts,alpha,value):parseRgbParts(parts,alpha,value);
}

function parseOklchParts(parts,alpha,raw){
  const lightness=number(parts[0],{percentOf:1});
  const chroma=number(parts[1],{percentOf:0.4});
  const hue=number(parts[2]==='none'?'0':String(parts[2]).replace(/deg$/i,''));
  if([lightness,chroma,hue].includes(null))return null;
  const lab=oklchToOklab({L:lightness,C:chroma,h:hue});
  const {rgb,clipped}=oklabToRgb(lab);
  return color({notation:'oklch',rgb,alpha:alpha??1,raw,lab,clipped});
}

function parseRgbParts(parts,alpha,raw){
  const channels=parts.slice(0,3).map(part=>number(part,{percentOf:255}));
  if(channels.includes(null))return null;
  return color({notation:'rgb',rgb:channels.map(channel=>Math.round(channel)),alpha:alpha??1,raw});
}

function color({notation,rgb,alpha,raw,lab=null,clipped=false}){
  const oklab=lab??rgbToOklab(rgb);
  return {notation,raw,rgb,alpha,clipped,oklab,oklch:oklabToOklch(oklab),hex:formatHex(rgb)};
}

/** Euclidean OKLab distance on the x100 scale: black against white is 100. */
export const deltaEOk=(first,second)=>100*Math.hypot(first.oklab.L-second.oklab.L,first.oklab.a-second.oklab.a,first.oklab.b-second.oklab.b);
/** WCAG 2.x relative luminance of a parsed colour. */
const relativeLuminance=({rgb:[red,green,blue]})=>0.2126*srgbToLinear(red/255)+0.7152*srgbToLinear(green/255)+0.0722*srgbToLinear(blue/255);
/** WCAG 2.x contrast ratio: 21 for black against white, 1 for a colour against itself. */
export function contrastRatio(first,second){
  const one=relativeLuminance(first),two=relativeLuminance(second);
  return (Math.max(one,two)+0.05)/(Math.min(one,two)+0.05);
}
