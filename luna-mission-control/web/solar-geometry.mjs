/** Sun geometry for LUNA educational mission renderers.
 * Earth: JPL Horizons Earth-centered ICRF Sun vector, rotated to a local
 * east/north/up (ENU) frame using UTC-based GMST. Difference UT1-UTC,
 * atmospheric refraction, nutation, topocentric correction and terrain
 * skyline occlusion are NOT modeled. Sun angle precision is therefore not
 * sufficient for operational launch-pad planning.
 * Moon: local solar angles come from the existing JPL Horizons + lunar
 * site-parallax geometry engine, not the Earth GMST calculation.
 */
const DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrap360=v=>((v%360)+360)%360;
export function greenwichSiderealDegrees(utcMs){
 if(!Number.isFinite(utcMs))throw new RangeError("Invalid UTC for sidereal calculation");
 const jd=utcMs/86400000+2440587.5,T=(jd-2451545)/36525;
 return wrap360(280.46061837+360.98564736629*(jd-2451545)+
  .000387933*T*T-T*T*T/38710000);
}
export function earthSunAngles(sun,utcMs,latDeg,lonDeg){
 if(!sun||![sun.x,sun.y,sun.z,utcMs,latDeg,lonDeg].every(Number.isFinite)||
  latDeg<-90||latDeg>90||lonDeg<-180||lonDeg>180)
  throw new RangeError("Valid JPL Sun vector, UTC and Earth site coordinates required");
 const rho=Math.hypot(sun.x,sun.y,sun.z);
 if(rho<1e8)throw new RangeError("Earth-centered Sun distance is implausible");
 const dec=Math.asin(clamp(sun.z/rho,-1,1));
 const ra=Math.atan2(sun.y,sun.x);
 const hourAngle=(greenwichSiderealDegrees(utcMs)+lonDeg)*DEG-ra;
 const lat=latDeg*DEG;
 const east=-Math.cos(dec)*Math.sin(hourAngle);
 const north=Math.cos(lat)*Math.sin(dec)-Math.sin(lat)*Math.cos(dec)*Math.cos(hourAngle);
 const up=Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(hourAngle);
 return {azimuthDeg:wrap360(Math.atan2(east,north)/DEG),
  elevationDeg:Math.asin(clamp(up,-1,1))/DEG,
  distanceKm:rho,source:"JPL Horizons geocentric Sun + UTC GMST (geometric, no refraction)"};
}
export function sunENU({azimuthDeg,elevationDeg}){
 if(!Number.isFinite(azimuthDeg)||!Number.isFinite(elevationDeg))throw new RangeError("Invalid Sun az/el");
 const a=azimuthDeg*DEG,e=elevationDeg*DEG;
 return {e:Math.sin(a)*Math.cos(e),n:Math.cos(a)*Math.cos(e),u:Math.sin(e)};
}
export function terrainNormal(corners){
 if(!Array.isArray(corners)||corners.length<4||
  corners.some(p=>!Number.isFinite(p?.h)||!Number.isFinite(p?.e)||!Number.isFinite(p?.n)))
  return {e:0,n:0,u:1};
 const [a,b,,d]=corners,de=b.e-a.e,dn=d.n-a.n;
 if(Math.abs(de)<1e-6||Math.abs(dn)<1e-6)return {e:0,n:0,u:1};
 const eSlope=(b.h-a.h)/de,nSlope=(d.h-a.h)/dn;
 const magnitude=Math.hypot(eSlope,nSlope,1);
 return {e:-eSlope/magnitude,n:-nSlope/magnitude,u:1/magnitude};
}
export function sunLight(normal,sun,{ambient=.19,diffuse=.81}={}){
 if(!sun)return .59; // unknown sunlight: neutral display fill, not fake sunshine
 const d=sunENU(sun);
 if(sun.elevationDeg<=0)return ambient;
 const dot=normal.e*d.e+normal.n*d.n+normal.u*d.u;
 return clamp(ambient+diffuse*Math.max(0,dot),ambient,1);
}
export function sunShadowOffset(heightM,sun,maxLengthM=3000){
 if(!sun||sun.elevationDeg<=0||!Number.isFinite(heightM)||heightM<=0)
  return null;
 const bearing=sun.azimuthDeg*DEG;
 const length=Math.min(maxLengthM,heightM/Math.max(.008,Math.tan(sun.elevationDeg*DEG)));
 // Shadow has horizontal length h/tan(elevation); normalize the ENU
 // horizontal projection rather than shortening it by cos(elevation).
 return {e:-Math.sin(bearing)*length,n:-Math.cos(bearing)*length,lengthM:length};
}
