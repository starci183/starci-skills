import zlib from 'node:zlib';

/**
 * A PNG encoder that exists only so the render checks can be tested against real bytes. The runtime decodes
 * PNGs and never writes one; the tests need images whose exact colours they chose, so the encoder lives here
 * rather than in `checks/`. Like the decoder it carries no dependency: the CRC32 of the format is twenty
 * lines, and a test fixture that needed an npm package would be a test of that package.
 */
const CRC_TABLE=(()=>{
  const table=new Int32Array(256);
  for(let index=0;index<256;index+=1){
    let value=index;
    for(let bit=0;bit<8;bit+=1)value=value&1?0xedb88320^(value>>>1):value>>>1;
    table[index]=value;
  }
  return table;
})();

/** CRC32 as the PNG specification defines it: the reflected polynomial, seeded and finished with all ones. */
export function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

const chunk=(type,body)=>{
  const head=Buffer.alloc(4);
  head.writeUInt32BE(body.length,0);
  const payload=Buffer.concat([Buffer.from(type,'latin1'),body]);
  const tail=Buffer.alloc(4);
  tail.writeUInt32BE(crc32(payload),0);
  return Buffer.concat([head,payload,tail]);
};

const COLOUR_TYPE={1:0,2:4,3:2,4:6};

function paeth(left,above,upperLeft){
  const estimate=left+above-upperLeft;
  const toLeft=Math.abs(estimate-left),toAbove=Math.abs(estimate-above),toUpperLeft=Math.abs(estimate-upperLeft);
  if(toLeft<=toAbove&&toLeft<=toUpperLeft)return left;
  return toAbove<=toUpperLeft?above:upperLeft;
}

/**
 * One image as PNG bytes. `filter` is the filter type written on every scanline (0 to 4), so a test can make
 * the decoder walk each of the five reconstructions over the same picture and prove they all return it.
 */
export function encodePng({width,height,pixels,channels=4,filter=0,bitDepth=8,interlace=0,colourType=null}){
  const type=colourType??COLOUR_TYPE[channels];
  if(type===undefined)throw Error(`no PNG colour type for ${channels} channels`);
  const stride=width*channels;
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);
  header.writeUInt32BE(height,4);
  header[8]=bitDepth;
  header[9]=type;
  header[10]=0;
  header[11]=0;
  header[12]=interlace;
  const raw=Buffer.alloc((stride+1)*height);
  let prior=new Uint8Array(stride);
  for(let row=0;row<height;row+=1){
    const line=pixels.subarray(row*stride,(row+1)*stride);
    const at=row*(stride+1);
    raw[at]=filter;
    for(let index=0;index<stride;index+=1){
      const left=index>=channels?line[index-channels]:0;
      const above=prior[index];
      const upperLeft=index>=channels?prior[index-channels]:0;
      const predicted=filter===0?0:filter===1?left:filter===2?above:filter===3?(left+above)>>1:paeth(left,above,upperLeft);
      raw[at+1+index]=(line[index]-predicted)&0xff;
    }
    prior=line;
  }
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

/** `#rrggbb` or `#rgb` as `[red, green, blue]`; the fixtures write their colours the way a brand record does. */
export const rgbOf=hex=>{
  const body=String(hex).replace('#','');
  const pairs=body.length===3?[...body].map(character=>character+character):body.match(/../g);
  return pairs.slice(0,3).map(pair=>Number.parseInt(pair,16));
};

/**
 * A synthetic screen: horizontal bands of the given colours, in the proportions given, over a white page.
 * `bands` is `[{hex, rows}]`; whatever is left over stays white, which is what a real screen mostly is.
 */
export function screen({width=40,height=40,bands=[],channels=3,background='#ffffff'}={}){
  const stride=width*channels;
  const pixels=new Uint8Array(stride*height);
  const paint=(row,[red,green,blue])=>{
    for(let column=0;column<width;column+=1){
      const at=row*stride+column*channels;
      pixels[at]=red;pixels[at+1]=green;pixels[at+2]=blue;
      if(channels===4)pixels[at+3]=255;
    }
  };
  const page=rgbOf(background);
  for(let row=0;row<height;row+=1)paint(row,page);
  let row=0;
  for(const band of bands){
    const colour=rgbOf(band.hex);
    for(let drawn=0;drawn<band.rows&&row<height;drawn+=1,row+=1)paint(row,colour);
  }
  return {width,height,channels,pixels};
}
