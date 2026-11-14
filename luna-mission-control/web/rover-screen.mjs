/** Rover traversal screening on REAL NASA LOLA 20m site patches.
 * Algorithm: bounded 8-connected A* with per-segment slope cutoff and
 * soft terrain cost. Never proves passability of meter-scale rocks, dust,
 * craters, wheel dynamics, or live rover navigation.
 * NASA hazard planning overview: https://ntrs.nasa.gov/citations/20250000720
 */
import {localPatchXY} from "./lola-polar-detail.mjs";
const W=512,P=20,NO_DATA=-32768;
const toIndex=(x,y)=>y*W+x;
function pixel(patch,x,y){
 if(x<1||x>=W-1||y<1||y>=W-1)return null;
 const z=patch.view.getInt16(toIndex(x,y)*2,true);
 return z===NO_DATA?null:z;
}
class Heap{
 constructor(){this.items=[];}
 push(item){const a=this.items;a.push(item);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p}a[i]=item;}
 pop(){const a=this.items,head=a[0],last=a.pop();if(!a.length)return head;let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(last[0]<=a[j][0])break;a[i]=a[j];i=j;}a[i]=last;return head;}
 get size(){return this.items.length;}
}
export function roverRouteScreen(patch,lat,lon,{eastM=600,northM=200,maxSlopeDeg=15,maxSearchMeters=2200}={}){
 if(!patch)return {available:false,status:"NO 20m NASA LOLA PATCH — ROVER PATH NOT EVALUATED"};
 if(![lat,lon,eastM,northM,maxSlopeDeg,maxSearchMeters].every(Number.isFinite)||Math.abs(eastM)>3000||Math.abs(northM)>3000||maxSlopeDeg<=0||maxSlopeDeg>30)
   throw Error("Invalid rover screening target or slope assumption");
 const [east,north]=localPatchXY(patch.entry.latitude,patch.entry.longitude,lat,lon);
 const start=[Math.round((east+5120)/P-.5),Math.round((5120-north)/P-.5)];
 const end=[Math.round((east+eastM+5120)/P-.5),Math.round((5120-north-northM)/P-.5)];
 const [sx,sy]=start,[ex,ey]=end;
 const from=pixel(patch,sx,sy),to=pixel(patch,ex,ey);
 if(from===null||to===null)return {available:false,status:"START OR TARGET OUTSIDE VERIFIED 20m LOLA PATCH"};
 const minx=Math.max(1,Math.min(sx,ex)-Math.ceil(maxSearchMeters/P)),
       maxx=Math.min(W-2,Math.max(sx,ex)+Math.ceil(maxSearchMeters/P)),
       miny=Math.max(1,Math.min(sy,ey)-Math.ceil(maxSearchMeters/P)),
       maxy=Math.min(W-2,Math.max(sy,ey)+Math.ceil(maxSearchMeters/P));
 const heuristic=(x,y)=>Math.hypot(ex-x,ey-y)*P;
 const open=new Heap(),cost=new Float64Array(W*W).fill(Infinity),
       parent=new Int32Array(W*W).fill(-1),closed=new Uint8Array(W*W);
 const startI=toIndex(sx,sy),endI=toIndex(ex,ey);
 cost[startI]=0;open.push([heuristic(sx,sy),startI]);
 const edges=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 let visits=0,found=false;
 while(open.size&&visits<70000){
  const [,current]=open.pop();
  if(closed[current])continue;closed[current]=1;visits++;
  if(current===endI){found=true;break;}
  const x=current%W,y=Math.floor(current/W),z=pixel(patch,x,y);
  for(const [dx,dy] of edges){
   const xx=x+dx,yy=y+dy;
   if(xx<minx||xx>maxx||yy<miny||yy>maxy)continue;
   const zz=pixel(patch,xx,yy);if(zz===null)continue;
   const step=P*Math.hypot(dx,dy),slope=Math.atan(Math.abs(zz-z)/step)*180/Math.PI;
   if(slope>maxSlopeDeg)continue;
   // For diagonals require adjacent orthogonal cells present, avoid cutting
   // across data gaps. This does not certify rover turning clearance.
   if(dx&&dy&&(pixel(patch,x+dx,y)===null||pixel(patch,x,y+dy)===null))continue;
   const candidate=cost[current]+step*(1+2*(slope/maxSlopeDeg)**2);
   const next=toIndex(xx,yy);
   if(candidate<cost[next]){
    cost[next]=candidate;parent[next]=current;
    open.push([candidate+heuristic(xx,yy),next]);
   }
  }
 }
 if(!found)return {available:true,found:false,status:"NO ROUTE UNDER ASSUMED SLOPE SCREEN — NOT PROOF OF IMPASSABILITY",
  threshold_deg:maxSlopeDeg,checked_cells:visits};
 const route=[];let at=endI;
 while(at!==-1&&route.length<W*W){
  const x=at%W,y=Math.floor(at/W);
  route.push({east_m:(x-sx)*P,north_m:(sy-y)*P,elevation_m:pixel(patch,x,y)});
  if(at===startI)break;
  at=parent[at];
 }
 route.reverse();
 let distance=0,uphill=0,maxSlope=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],d=Math.hypot(b.east_m-a.east_m,b.north_m-a.north_m);
  const dz=b.elevation_m-a.elevation_m;
  distance+=d;uphill+=Math.max(0,dz);
  maxSlope=Math.max(maxSlope,Math.atan(Math.abs(dz)/d)*180/Math.PI);
 }
 return {available:true,found:true,status:"PROJECTED LOLA-20m SLOPE-ONLY CORRIDOR — NOT A SAFE OR VERIFIED ROVER ROUTE",
   length_m:Number(distance.toFixed(1)),elevation_gain_m:Number(uphill.toFixed(1)),
   maximum_segment_slope_deg:Number(maxSlope.toFixed(1)),threshold_deg:maxSlopeDeg,
   checked_cells:visits,cell_size_m:P,coordinates:route,
   provenance:"NASA LOLA 20m south polar DEM; 8-neighbor A* and assumed slope limit",
   limitations:"No meter-scale rocks, surface bearing strength, crater microhazards, illumination, rover specifications, or telemetry included"};
}
