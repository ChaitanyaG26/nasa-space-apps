/** Accessible, unit-scaled lunar mission plots (no fabricated interpolation).
 * Model curves join each calculated time step. Diviner observations are
 * plotted as separate discrete dots, NEVER connected across missing bins.
 */
const W=760,H=275,M={left:74,right:24,top:20,bottom:48};
const pw=W-M.left-M.right,ph=H-M.top-M.bottom;
const registry=new Map();
let counter=0;
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const pad=n=>String(n).padStart(2,"0");
export function niceStep(span,maxTicks=5){
 if(!(span>0))return 1;
 const raw=span/Math.max(1,maxTicks),power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
 const unit=fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10;
 return unit*power;
}
export function niceDomain(values,{zero=false,percent=false,threshold=null}={}){
 const v=values.filter(Number.isFinite);
 if(!v.length)return null;
 if(percent)return {min:0,max:100,ticks:[0,20,40,60,80,100]};
 let minimum=Math.min(...v),maximum=Math.max(...v);
 if(Number.isFinite(threshold)){minimum=Math.min(minimum,threshold);maximum=Math.max(maximum,threshold);}
 if(zero){minimum=Math.min(minimum,0);maximum=Math.max(maximum,0);}
 const span=maximum-minimum;
 const step=niceStep(span||Math.max(1,Math.abs(maximum)*0.2));
 let lo=Math.floor(minimum/step)*step,hi=Math.ceil(maximum/step)*step;
 if(hi<=lo)hi=lo+step;
 if(zero&&lo<0&&minimum>=0)lo=0;
 const ticks=[];
 for(let i=0;i<100;i++){const n=lo+i*step;if(n>hi+step*1e-7)break;ticks.push(Number(n.toPrecision(12)));}
 return {min:lo,max:hi,ticks};
}
export function utcTicks(startMs,endMs,count=5){
 if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)throw Error("Invalid graph UTC bounds");
 const duration=endMs-startMs;
 const hour=3600000,day=24*hour;
 const increments=[hour,2*hour,3*hour,6*hour,12*hour,day,2*day,3*day,5*day,7*day,10*day,14*day];
 const increment=increments.find(x=>duration/x<=count)||Math.ceil(duration/count/day)*day;
 const first=Math.ceil(startMs/increment)*increment,ans=[];
 for(let t=first;t<=endMs;t+=increment){
  const d=new Date(t);
  const label=duration<=2*day?
    pad(d.getUTCMonth()+1)+"/"+pad(d.getUTCDate())+" "+pad(d.getUTCHours())+":"+pad(d.getUTCMinutes()):
    (d.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}));
  ans.push({time:t,label});
  if(ans.length>30)break;
 }
 return ans;
}
const fmt=(n,unit)=>{
 if(!Number.isFinite(n))return "No data";
 const digits=(Math.abs(n)<10&&unit!=="%"?2:Math.abs(n)<100?1:0);
 return n.toLocaleString("en-US",{maximumFractionDigits:digits})+" "+unit;
};
export function chartMarkup(title,rows,key,{unit="",color="#208a88",kind="model",percent=false,zero=false,
 threshold=null,subtitle=""}={}){
 if(!Array.isArray(rows)||rows.length<2)return '<div class="chart"><p>Not enough samples</p></div>';
 const start=Date.parse(rows[0].time),end=Date.parse(rows.at(-1).time);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw Error("Invalid graph UTC timestamps");
 const points=rows.map((r,i)=>({index:i,time:Date.parse(r.time),value:typeof r[key]==="number"?r[key]:null}))
   .filter(x=>Number.isFinite(x.value)&&Number.isFinite(x.time));
 const dom=niceDomain(points.map(x=>x.value),{percent,zero,threshold});
 if(!dom)return '<div class="chart"><div class="chart-title">'+esc(title)+'</div><p class="muted">No source values for this site and time window.</p></div>';
 const x=t=>M.left+(t-start)/(end-start)*pw;
 const y=v=>M.top+(dom.max-v)/(dom.max-dom.min)*ph;
 const fmtAxis=n=>{
  if(Math.abs(n)>=1000)return (n/1000).toFixed(Number.isInteger(n/1000)?0:1)+"k";
  return Number(n.toFixed(2)).toString();
 };
 let grid='<g class="plot-grid">';
 for(const n of dom.ticks){
  const yy=y(n);grid+='<line x1="'+M.left+'" x2="'+(W-M.right)+'" y1="'+yy.toFixed(2)+'" y2="'+yy.toFixed(2)+'"/>';
  grid+='<text x="'+(M.left-10)+'" y="'+(yy+4).toFixed(2)+'" text-anchor="end">'+esc(fmtAxis(n))+'</text>';
 }
 const days=utcTicks(start,end);
 for(const t of days){
  const xx=x(t.time);
  grid+='<line x1="'+xx.toFixed(2)+'" x2="'+xx.toFixed(2)+'" y1="'+M.top+'" y2="'+(H-M.bottom)+'" class="plot-xgrid"/>';
  grid+='<text x="'+xx.toFixed(2)+'" y="'+(H-19)+'" text-anchor="middle">'+esc(t.label)+'</text>';
 }
 grid+='</g>';
 if(Number.isFinite(threshold)&&threshold>=dom.min&&threshold<=dom.max){
  const cy=y(threshold);
  grid+='<line class="plot-threshold" x1="'+M.left+'" x2="'+(W-M.right)+'" y1="'+cy+'" y2="'+cy+'"/>';
  grid+='<text x="'+(W-M.right-7)+'" y="'+(cy-5).toFixed(2)+'" class="plot-threshold-label" text-anchor="end">'+
   esc(Number(threshold.toFixed(2))+" "+unit+" target")+'</text>';
 }
 const id="luna-graph-"+(++counter);
 registry.set(id,{points,start,end,unit,title,color,key,dom});
 const minimum=points.reduce((a,b)=>b.value<a.value?b:a,points[0]);
 const maximum=points.reduce((a,b)=>b.value>a.value?b:a,points[0]);
 let series="";
 if(kind==="observed"){
  // Archive bins must remain unconnected; never infer missing NASA measurements.
  const sampled=points.length>550?points.filter((p,i)=>i%Math.ceil(points.length/550)===0):points;
  series='<g class="observed-dots">'+sampled.map(p=>'<circle cx="'+x(p.time).toFixed(2)+'" cy="'+y(p.value).toFixed(2)+'" r="2.3" fill="'+color+'"/>').join("")+'</g>';
 }else{
  // Break discontinuities and missing model samples rather than implying a valid bridge.
  // Simplify only the RENDERED path by retaining first/last and per-pixel extrema;
  // interactions and statistics still reference all original calculated samples.
  const segments=[];let run=[];
  const maxGap=(end-start)/Math.max(1,rows.length-1)*1.7;
  for(const row of rows){
   const t=Date.parse(row.time),v=typeof row[key]==="number"?row[key]:null;
   if(!Number.isFinite(t)||!Number.isFinite(v)){
    if(run.length)segments.push(run);
    run=[];continue;
   }
   if(run.length&&t-run.at(-1).time>maxGap){segments.push(run);run=[];}
   run.push({time:t,value:v});
  }
  if(run.length)segments.push(run);
  function extremaPath(segment){
   if(segment.length<2)return segment;
   const bins=new Map();
   for(const p of segment){
    const k=Math.floor((p.time-start)/(end-start)*pw);
    let group=bins.get(k);
    if(!group){group={first:p,last:p,min:p,max:p};bins.set(k,group);}
    else{group.last=p;if(p.value<group.min.value)group.min=p;if(p.value>group.max.value)group.max=p;}
   }
   const kept=[];
   for(const g of bins.values()){
    for(const p of [g.first,g.min,g.max,g.last].sort((a,b)=>a.time-b.time)){
     if(kept.at(-1)!==p)kept.push(p);
    }
   }
   return kept;
  }
  const paths=segments.map(segment=>{
   const kept=extremaPath(segment);
   return kept.map((p,i)=>(i?"L":"M")+x(p.time).toFixed(2)+","+y(p.value).toFixed(2)).join(" ");
  }).filter(Boolean);
  const background=zero&&dom.min<=0&&dom.max>=0?segments.map(segment=>{
   if(segment.length<2)return "";
   const kept=extremaPath(segment);
   return '<path d="'+kept.map((p,i)=>(i?"L":"M")+x(p.time).toFixed(2)+","+y(p.value).toFixed(2)).join(" ")+
    ' L'+x(kept.at(-1).time).toFixed(2)+','+y(0).toFixed(2)+
    ' L'+x(kept[0].time).toFixed(2)+','+y(0).toFixed(2)+' Z" fill="url(#fill-'+id+')" stroke="none"/>';
  }).join(""):"";
  series='<defs><linearGradient id="fill-'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".20"/><stop offset="100%" stop-color="'+color+'" stop-opacity=".02"/></linearGradient></defs>'+
   background+paths.map(path=>'<path d="'+path+'" fill="none" class="plot-series" stroke="'+color+'" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>').join("")+
   [minimum,maximum].map(point=>'<circle class="plot-extrema" cx="'+x(point.time).toFixed(2)+'" cy="'+y(point.value).toFixed(2)+'" r="3.7" fill="white" stroke="'+color+'" stroke-width="2"/>').join("");
 }
 const periodLabel=kind==="observed"?"Historical NASA observations · discrete bins":"Physics model · connected computed samples";
 return '<div class="chart science-plot"><div class="chart-head"><strong>'+esc(title)+'</strong><span class="chart-meta">'+esc(unit)+'</span><button type="button" class="plot-expand" aria-label="Expand '+esc(title)+'" title="Expand chart">⤢</button></div>'+
 '<div class="chart-subtitle">'+esc(subtitle||periodLabel)+'</div><div class="plot-wrap">'+
 '<svg data-plot-id="'+id+'" role="img" aria-label="'+esc(title)+' from '+new Date(start).toISOString()+' to '+new Date(end).toISOString()+
 '" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
 '<rect x="'+M.left+'" y="'+M.top+'" width="'+pw+'" height="'+ph+'" fill="#f8fbfc"/>'+
 grid+series+
 '<line class="plot-timecursor" x1="'+M.left+'" y1="'+M.top+'" x2="'+M.left+'" y2="'+(H-M.bottom)+'" visibility="hidden"/>'+ '<line class="plot-hoverline" x1="'+M.left+'" y1="'+M.top+'" x2="'+M.left+'" y2="'+(H-M.bottom)+'" visibility="hidden"/>'+
 '<circle class="plot-hoverdot" cx="'+M.left+'" cy="'+M.top+'" r="5" fill="'+color+'" stroke="white" stroke-width="2" visibility="hidden"/>'+
 '<text x="'+M.left+'" y="'+(H-2)+'" class="plot-axis-label">UTC</text></svg>'+
 '<div class="plot-tooltip" role="status" hidden></div></div>'+
 '<div class="plot-foot"><span>'+points.length.toLocaleString("en-US")+' '+(kind==="observed"?"archival bins":"computed samples")+
 '</span><span>Min '+esc(fmt(minimum.value,unit))+' · Max '+esc(fmt(maximum.value,unit))+'</span><span>UTC · '+esc(new Date(start).toISOString().slice(0,16).replace("T"," "))+
 ' to '+esc(new Date(end).toISOString().slice(0,16).replace("T"," "))+'</span></div></div>';
}
export function resetCharts(){registry.clear();counter=0;}
function nearestAt(series,t){
 const pts=series.points;
 if(!pts.length)return null;
 let l=0,r=pts.length-1;
 while(l<r){const m=(l+r)>>1;if(pts[m].time<t)l=m+1;else r=m;}
 if(l>0&&Math.abs(pts[l-1].time-t)<Math.abs(pts[l].time-t))l--;
 return pts[l];
}
export function attachChartInteractions(root){
 if(!root.dataset.lunaExpandEnabled){
  root.dataset.lunaExpandEnabled="1";
  root.addEventListener("click",event=>{
   const button=event.target.closest(".plot-expand");
   if(!button)return;
   const panel=button.closest(".science-plot");
   const on=!panel.classList.contains("chart-expanded");
   root.querySelectorAll(".chart-expanded").forEach(el=>{
    el.classList.remove("chart-expanded");
    const b=el.querySelector(".plot-expand");
    if(b){b.textContent="⤢";b.setAttribute("aria-label","Expand chart");}
   });
   if(on){panel.classList.add("chart-expanded");button.textContent="×";button.setAttribute("aria-label","Close expanded chart");}
  });
  document.addEventListener("keydown",event=>{
   if(event.key!=="Escape")return;
   root.querySelectorAll(".chart-expanded").forEach(el=>{
    el.classList.remove("chart-expanded");
    const btn=el.querySelector(".plot-expand");
    if(btn){btn.textContent="⤢";btn.setAttribute("aria-label","Expand chart");}
   });
  });
 }
 for(const svg of root.querySelectorAll("svg[data-plot-id]")){
  const plot=registry.get(svg.dataset.plotId);
  if(!plot)continue;
  const line=svg.querySelector(".plot-hoverline"),dot=svg.querySelector(".plot-hoverdot");
  const tooltip=svg.parentElement.querySelector(".plot-tooltip");
  const hide=()=>{line.setAttribute("visibility","hidden");dot.setAttribute("visibility","hidden");tooltip.hidden=true;};
  svg.addEventListener("pointerleave",hide);
  svg.addEventListener("pointermove",event=>{
   const rect=svg.getBoundingClientRect();
   if(!rect.width)return;
   const vx=(event.clientX-rect.left)/rect.width*W;
   const t=plot.start+(Math.max(M.left,Math.min(W-M.right,vx))-M.left)/pw*(plot.end-plot.start);
   const p=nearestAt(plot,t);
   if(!p)return;
   setChartsCursor(root,new Date(p.time).toISOString());
   const cx=M.left+(p.time-plot.start)/(plot.end-plot.start)*pw;
   const dom=plot.dom;
   // Read exact plotted y from nearest path value rather than interpolate
   // between archived measurements.
   const cy=M.top+(dom.max-p.value)/(dom.max-dom.min)*ph;
   line.setAttribute("x1",cx);line.setAttribute("x2",cx);line.setAttribute("visibility","visible");
   dot.setAttribute("cx",cx);dot.setAttribute("cy",cy);dot.setAttribute("visibility","visible");
   tooltip.hidden=false;
   tooltip.textContent=new Date(p.time).toISOString().slice(0,16).replace("T"," ")+" UTC · "+fmt(p.value,plot.unit);
   tooltip.style.left=Math.min(76,Math.max(8,cx/W*100))+"%";
  });
 }
}

/** Move the vertical playback reference line to the exact requested UTC.
 * This does not interpolate chart values; markers/hover use original samples.
 */
export function setChartsCursor(root,when){
 if(!root)return;
 const utc=Date.parse(when);
 for(const svg of root.querySelectorAll("svg[data-plot-id]")){
  const series=registry.get(svg.dataset.plotId),line=svg.querySelector(".plot-timecursor");
  if(!line||!series)continue;
  if(!Number.isFinite(utc)||utc<series.start||utc>series.end){
   line.setAttribute("visibility","hidden");continue;
  }
  const xx=M.left+(utc-series.start)/(series.end-series.start)*pw;
  line.setAttribute("x1",xx);line.setAttribute("x2",xx);
  line.setAttribute("visibility","visible");
 }
}
