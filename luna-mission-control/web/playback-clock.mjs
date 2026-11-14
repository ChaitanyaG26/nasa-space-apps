/** Pure UTC animation clock. Each frame is an exact UTC step; orbital positions
 * come exclusively from NASA/JPL cached samples (or explicitly selected demo mode).
 * These helpers do NOT invent observations or smooth celestial coordinates.
 */
export function formatPlaybackUtc(slot){
 if(!Number.isInteger(slot)||slot<0||slot>143)throw new RangeError("Time slot must be 0..143");
 const minutes=slot*10;
 return String(Math.floor(minutes/60)).padStart(2,"0")+":"+
  String(minutes%60).padStart(2,"0")+" UTC";
}
export function advancePlaybackUtc(date,slot,stepSlots=3){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new TypeError("Use UTC YYYY-MM-DD date");
 if(!Number.isInteger(slot)||slot<0||slot>143)throw new RangeError("Invalid UTC 10-minute slot");
 if(!Number.isInteger(stepSlots)||stepSlots<1||stepSlots>144)throw new RangeError("Invalid animation interval");
 const t=Date.parse(date+"T00:00:00Z");
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date)throw new RangeError("Invalid calendar date");
 const next=new Date(t+(slot+stepSlots)*600000);
 return {date:next.toISOString().slice(0,10),
  slot:next.getUTCHours()*6+Math.floor(next.getUTCMinutes()/10),
  iso:next.toISOString()};
}
