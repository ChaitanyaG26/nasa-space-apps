/** Landed lunar missions with published coordinates (lat planetocentric, east-positive).
 * Landing times are UTC only when a sourced UTC time is known; date-only is
 * explicitly labelled, never inferred. LUNA intentionally does not treat
 * impactors, planned missions, or failed landings as successful touchdowns.
 */
export const LANDING_ORGANIZATIONS={
 nasa:{name:"NASA / United States",color:"#63b1f0"},
 cnsa:{name:"CNSA / China",color:"#f17b76"},
 isro:{name:"ISRO / India",color:"#efb96a"},
 im:{name:"Intuitive Machines / U.S.",color:"#59d0b5"},
 firefly:{name:"Firefly Aerospace / U.S.",color:"#c9a5f6"}
};
export const HISTORIC_LANDING_SITES=[
 {id:"apollo11",name:"Apollo 11",org:"nasa",lat:.67416,lon:23.47314,date:"1969-07-20",time:"20:17:40",place:"Mare Tranquillitatis",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"apollo12",name:"Apollo 12",org:"nasa",lat:-3.0128,lon:-23.4219,date:"1969-11-19",time:null,place:"Oceanus Procellarum",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"apollo14",name:"Apollo 14",org:"nasa",lat:-3.64589,lon:-17.47194,date:"1971-02-05",time:null,place:"Fra Mauro",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"apollo15",name:"Apollo 15",org:"nasa",lat:26.13239,lon:3.63330,date:"1971-07-30",time:null,place:"Hadley–Apennine",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"apollo16",name:"Apollo 16",org:"nasa",lat:-8.9734,lon:15.5011,date:"1972-04-21",time:null,place:"Descartes",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"apollo17",name:"Apollo 17",org:"nasa",lat:20.1911,lon:30.7655,date:"1972-12-11",time:null,place:"Taurus–Littrow",source:"https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"},
 {id:"change3",name:"Chang’e 3",org:"cnsa",lat:44.1214,lon:-19.5116,date:"2013-12-14",time:null,place:"Mare Imbrium",source:"https://cosparhq.cnes.fr/assets/uploads/2024/09/COSPAR-PPP-2024-Overview.pdf"},
 {id:"change4",name:"Chang’e 4",org:"cnsa",lat:-45.444,lon:177.599,date:"2019-01-03",time:null,place:"Von Kármán crater, far side",source:"https://cosparhq.cnes.fr/assets/uploads/2024/09/COSPAR-PPP-2024-Overview.pdf"},
 {id:"change5",name:"Chang’e 5",org:"cnsa",lat:43.0576,lon:-51.9161,date:"2020-12-01",time:null,place:"Oceanus Procellarum",source:"https://cosparhq.cnes.fr/assets/uploads/2024/09/COSPAR-PPP-2024-Overview.pdf"},
 {id:"change6",name:"Chang’e 6",org:"cnsa",lat:-41.6385,lon:-153.9852,date:"2024-06-01",time:null,place:"Apollo Basin, far side",source:"https://cosparhq.cnes.fr/assets/uploads/2024/09/COSPAR-PPP-2024-Overview.pdf"},
 {id:"chandrayaan3",name:"Chandrayaan-3 / Vikram",org:"isro",lat:-69.373,lon:32.319,date:"2023-08-23",time:"12:33",place:"Shiv Shakti Point",source:"https://www.nasa.gov/wp-content/uploads/2026/02/42-240a.pdf"},
 {id:"im1",name:"IM-1 / Odysseus",org:"im",lat:-80.1276,lon:1.4367,date:"2024-02-22",time:"23:23",place:"Near Malapert A",source:"https://ntrs.nasa.gov/api/citations/20250007036/downloads/aasimndl.pdf"},
 {id:"blueghost",name:"Blue Ghost Mission 1",org:"firefly",lat:18.562,lon:61.81,date:"2025-03-02",time:"08:34",place:"Mare Crisium",source:"https://www.nasa.gov/news-release/touchdown-carrying-nasa-science-fireflys-blue-ghost-lands-on-moon/"}
];
export function getLandingSite(id){return HISTORIC_LANDING_SITES.find(site=>site.id===id)||null;}
export function siteVector(lat,lon){
 const a=lat*Math.PI/180,b=lon*Math.PI/180;
 return [Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)];
}
export function readableLandingTime(site){
 return site.time?site.date+" "+site.time+" UTC":site.date+" · UTC time unverified";
}
