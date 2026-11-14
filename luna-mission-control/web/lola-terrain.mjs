/** NASA LOLA regional elevations (coarse), not precision terrain hazards. */
const ASSET_URL=new URL("./assets/lola-south-025deg.json",import.meta.url).href;
let cached=null;

export function verifyLola(data){
  const g=data?.grid,values=data?.elevations_km;
  if(data?.schema_version!==1||g?.width!==1440||g?.height!==60||g?.step_deg!==.25||!Array.isArray(values)||values.length!==g.width*g.height)
    throw Error("NASA LOLA regional topography is invalid or unavailable");
  return data;
}
export async function loadLola(){
  if(cached)return cached;
  const response=await fetch(ASSET_URL,{cache:"default"});
  if(!response.ok)throw Error("NASA LOLA terrain cache is not published yet (HTTP "+response.status+")");
  cached=verifyLola(await response.json());
  return cached;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function elevationKm(data,latitude,longitude){
  verifyLola(data);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > -75)return null;
  const w=data.grid.width,h=data.grid.height;
  const x=(((longitude+180)%360+360)%360)/.25-.5;
  const y=(-75-latitude)/.25-.5;
  const x0=Math.floor(x),y0=Math.floor(clamp(y,0,h-1));
  const x1=x0+1,y1=Math.min(y0+1,h-1);
  const tx=x-Math.floor(x),ty=clamp(y,0,h-1)-y0;
  const v=(xx,yy)=>data.elevations_km[yy*w+((xx%w+w)%w)];
  const a=v(x0,y0),b=v(x1,y0),c=v(x0,y1),d=v(x1,y1);
  if([a,b,c,d].some(z=>z===null||!Number.isFinite(z)))return null;
  return (1-ty)*((1-tx)*a+tx*b)+ty*((1-tx)*c+tx*d);
}
export function regionalTerrain(data,latitude,longitude){
  const elev=elevationKm(data,latitude,longitude);
  return {
    elevation_km:elev===null?null:Number(elev.toFixed(3)),
    source:"NASA LOLA regional elevation (0.25° averaging)",
    resolution:"~7.6 km N–S; not local slope/rover/terrain-shadow resolution",
    coverage:elev!==null,
    latitude,longitude
  };
}
