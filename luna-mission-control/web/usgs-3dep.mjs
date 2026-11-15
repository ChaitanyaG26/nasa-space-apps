/** USGS 3DEP dynamic elevation ImageServer (bare-earth DEM, various native resolutions).
 * Source https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer
 * The browser requests a small, bounded uncompressed float32 TIFF. Some
 * configurations disable CORS, return compressed TIFF or limit exports;
 * those failures are caught by the caller, which falls back to Mapzen tiles.
 * The grid spacing is output sampling, NOT validated native DEM resolution.
 */
const SERVICE="https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage";
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function decodeFloatTiff(buffer){
 if(!(buffer instanceof ArrayBuffer))throw Error("TIFF ArrayBuffer required");
 const v=new DataView(buffer);
 if(v.byteLength<80)throw Error("Incomplete 3DEP TIFF");
 const order=String.fromCharCode(v.getUint8(0),v.getUint8(1));
 if(order!=="II"&&order!=="MM")throw Error("Invalid TIFF byte order");
 const le=order==="II";
 if(v.getUint16(2,le)!==42)throw Error("Unsupported TIFF format");
 const ifd=v.getUint32(4,le);
 if(ifd<8||ifd+2>v.byteLength)throw Error("Truncated TIFF directory");
 const number=v.getUint16(ifd,le);
 if(number>512||ifd+2+number*12>v.byteLength)throw Error("Invalid TIFF tags");
 const tags=new Map();
 for(let i=0;i<number;i++){
  const off=ifd+2+i*12,t=v.getUint16(off,le),type=v.getUint16(off+2,le);
  const count=v.getUint32(off+4,le),pointer=off+8;
  const typeSize={1:1,3:2,4:4}[type];
  if(!typeSize||!count||count>65536)continue;
  const pos=count*typeSize<=4?pointer:v.getUint32(pointer,le);
  if(pos<0||pos+count*typeSize>v.byteLength)continue;
  const values=[];
  for(let j=0;j<count;j++){
   const x=pos+j*typeSize;
   values.push(type===1?v.getUint8(x):type===3?v.getUint16(x,le):v.getUint32(x,le));
  }
  tags.set(t,values);
 }
 const first=(tag,fallback)=>tags.get(tag)?.[0]??fallback;
 const width=first(256,0),height=first(257,0),bits=first(258,0);
 const samples=first(277,1),format=first(339,1),compression=first(259,1);
 const rowsPerStrip=first(278,height);
 const strips=tags.get(273)||[],bytes=tags.get(279)||[];
 if(!Number.isInteger(width)||width<2||width>2048||height<2||height>2048)
  throw Error("Unsupported 3DEP TIFF dimensions");
 if(bits!==32||samples!==1||format!==3||compression!==1)
  throw Error("TIFF must be uncompressed single-band 32-bit floating-point elevation");
 if(!rowsPerStrip||strips.length===0)throw Error("Missing TIFF strip offsets");
 const out=new Float32Array(width*height);
 for(let k=0;k<strips.length;k++){
  const offset=strips[k],rows=Math.min(rowsPerStrip,height-k*rowsPerStrip);
  if(rows<=0)break;
  const need=rows*width*4;
  if(offset+need>v.byteLength||(bytes[k]!==undefined&&bytes[k]<need))
   throw Error("Truncated TIFF elevation strip");
  for(let j=0;j<rows*width;j++){
   const value=v.getFloat32(offset+j*4,le);
   // 3DEP NoData can be NaN or sentinel. Never treat it as valid relief.
   out[k*rowsPerStrip*width+j]=Number.isFinite(value)&&value>-12000&&value<12000?value:NaN;
  }
 }
 return {width,height,data:out};
}
export function localBbox(lat,lon,footprintM){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||!(footprintM>10&&footprintM<=2000))
  throw new RangeError("Invalid USGS terrain location or footprint");
 const dlat=footprintM/2/111320;
 const dlon=footprintM/2/(111320*Math.cos(lat*Math.PI/180));
 return [lon-dlon,lat-dlat,lon+dlon,lat+dlat];
}
export function gridFromUs3depImage(image,{siteId,footprintM=600}={}){
 const {width,height,data}=image;
 if(width!==height||data.length!==width*height)throw Error("Non-square terrain sample");
 const rows=[];
 // TIFF image rows run north to south; ENU coordinates need increasing
 // north on the first row.
 for(let j=0;j<height;j++){
  const row=[];
  for(let i=0;i<width;i++){
   const h=data[j*width+i];
   row.push({e:(i/(width-1)-.5)*footprintM,
    n:(.5-j/(height-1))*footprintM,h:Number.isFinite(h)?h:null});
  }
  rows.push(row);
 }
 const good=rows.flat().filter(p=>p.h!==null);
 const coverage=good.length/(width*height);
 return {rows,center:rows[Math.floor(height/2)][Math.floor(width/2)]?.h??null,
  siteId,footprintM,coverage,
  source:"USGS National Map 3DEP bare-earth dynamic elevation",
  resolutionM:footprintM/(width-1),sourceResolutionKnown:false,
  elevationModel:"3DEP best available (native source resolution varies)",
  sampleMethod:"uncompressed float32 GeoTIFF; grid point sampling"};
}
export async function loadUSGS3DEPGrid(siteId,site,{size=65,footprintM=600,timeoutMs=5000}={}){
 if(typeof fetch!=="function"||!site||!Number.isFinite(site.lat)||!Number.isFinite(site.lon))
  return null;
 const bbox=localBbox(site.lat,site.lon,footprintM);
 const q=new URLSearchParams({
  f:"image",bbox:bbox.map(v=>v.toFixed(9)).join(","),
  bboxSR:"4326",imageSR:"4326",size:size+","+size,
  format:"tiff",pixelType:"F32",compression:"NONE",
  interpolation:"+RSP_BilinearInterpolation"
 });
 let timer;
 const controller=new AbortController();
 try{
  timer=setTimeout(()=>controller.abort(),clamp(timeoutMs,500,15000));
  const response=await fetch(SERVICE+"?"+q.toString(),{
   mode:"cors",credentials:"omit",signal:controller.signal
  });
  if(!response.ok)throw Error("USGS ImageServer HTTP "+response.status);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>8_000_000)throw Error("Terrain export exceeded 8MB limit");
  const grid=gridFromUs3depImage(decodeFloatTiff(bytes),{siteId,footprintM});
  return grid.coverage>=.85?grid:null;
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
