import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {arrangeScenarioPanels,PHONE_SCENARIO_MEDIA} from "../web/mobile-scenario-layout.mjs";

class Node{
 constructor(kind,dataset={}){
  this.kind=kind;this.dataset=dataset;this.children=[];this.parentElement=null;
  const flags=new Set();
  this.classList={contains:v=>flags.has(v),add:v=>flags.add(v),remove:v=>flags.delete(v)};
 }
 matches(selector){return selector===".cards.scenario-single"&&this.kind==="single";}
 removeChild(node){
  const index=this.children.indexOf(node);
  if(index<0)throw Error("Missing child");
  this.children.splice(index,1);node.parentElement=null;
 }
 appendChild(node){node.parentElement?.removeChild(node);this.children.push(node);node.parentElement=this;return node;}
 insertBefore(node,sibling){
  node.parentElement?.removeChild(node);
  const index=this.children.indexOf(sibling);
  if(index<0)throw Error("Missing sibling");
  this.children.splice(index,0,node);node.parentElement=this;return node;
 }
 querySelectorAll(selector){
  const options=selector.split(",").map(v=>v.trim());
  const matches=n=>options.some(v=>{
   if(v==="[data-cola-list]")return n.kind==="list";
   if(v==="[data-cola-scenario]")return n.kind==="article";
   if(v==="[data-scenario-card]")return n.kind==="wrapper";
   if(v===".scenario-triple-viewport")return n.kind==="deck";
   if(v===".cards.scenario-single")return n.kind==="single";
   return false;
  });
  const found=[];
  const visit=n=>{for(const child of n.children){if(matches(child))found.push(child);visit(child);}};
  visit(this);
  return found;
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function fixture(comparison=true){
 const root=new Node("root"),deck=new Node(comparison?"deck":"single");
 const list=new Node("list"),panel=new Node("panel"),scienceCards={},articles={};
 const ids=comparison?["original","date-fixed","site-fixed"]:["original"];
 for(const id of ids){
  const article=new Node("article",{colaScenario:id});
  articles[id]=article;list.appendChild(article);
  if(comparison){
   const wrapper=new Node("wrapper",{scenarioCard:id}),science=new Node("science");
   scienceCards[id]=science;wrapper.appendChild(science);deck.appendChild(wrapper);
  }else{
   const science=new Node("science");scienceCards[id]=science;deck.appendChild(science);
  }
 }
 panel.appendChild(new Node("header"));panel.appendChild(list);
 root.appendChild(deck);root.appendChild(panel);
 return {root,deck,list,panel,articles,scienceCards,ids};
}
test("Desktop remains exactly unchanged, including order of science cards and separate animation list",()=>{
 const f=fixture();
 const initial=[...f.root.children],articles=[...f.list.children];
 assert.equal(arrangeScenarioPanels(f.panel,false),false);
 assert.deepEqual(f.root.children,initial);
 assert.deepEqual(f.list.children,articles);
});
test("Phone interleaves ORIGINAL, date-fixed and site-fixed graph/terrain cards with their own live animations",()=>{
 const f=fixture();
 assert.equal(arrangeScenarioPanels(f.panel,true),true);
 assert.deepEqual(f.root.children,[f.panel]);
 assert.deepEqual(f.panel.children,[...f.panel.children.slice(0,1),f.deck,f.list]);
 assert.deepEqual(f.list.children,[]);
 assert.equal(f.deck.children.length,3);
 for(const id of f.ids){
  const wrapper=f.deck.children.find(n=>n.dataset.scenarioCard===id);
  assert.deepEqual(wrapper.children,[f.scienceCards[id],f.articles[id]]);
  assert.equal(wrapper.children[1].parentElement,wrapper);
  assert.equal(f.articles[id].dataset.colaScenario,id);
 }
 // Repeated phone resize does not clone controllers or duplicate nodes.
 assert.equal(arrangeScenarioPanels(f.panel,true),false);
 assert.equal(f.panel.querySelectorAll("[data-cola-scenario]").length,3);
});
test("Rotating back to desktop restores the exact original DOM and nodes",()=>{
 const f=fixture(),originalDeck=f.root.children[0],expected=[...f.list.children];
 arrangeScenarioPanels(f.panel,true);
 assert.equal(arrangeScenarioPanels(f.panel,false),true);
 assert.deepEqual(f.root.children,[originalDeck,f.panel]);
 assert.deepEqual(f.list.children,expected);
 assert.equal(f.panel.classList.contains("phone-scenario-interleaved"),false);
});
test("Original-only simulation immediately follows its terrain and graphs on phone",()=>{
 const f=fixture(false);
 arrangeScenarioPanels(f.panel,true);
 assert.deepEqual(f.deck.children,[f.scienceCards.original,f.articles.original]);
 arrangeScenarioPanels(f.panel,false);
 assert.deepEqual(f.deck.children,[f.scienceCards.original]);
 assert.deepEqual(f.list.children,[f.articles.original]);
});
test("Only phone breakpoint changes DOM; desktop layout and JPL asynchronous updates keep working",()=>{
 const launch=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 assert.match(PHONE_SCENARIO_MEDIA,/max-width: 760px/);
 assert.match(launch,/arrangeScenarioPanels\(el,false\)/);
 assert.match(launch,/arrangeScenarioPanels\(el,Boolean\(viewport\?\.matches\)\)/);
 assert.match(launch,/phoneMedia\?\.addEventListener\?\.\("change"/);
 assert.match(launch,/for\(const article of el\.querySelectorAll\("\[data-cola-scenario\]"\)\)/);
 assert.match(css,/@media \(max-width:760px\), \(max-width:960px\) and \(pointer:coarse\)/);
 assert.match(css,/\.phone-scenario-interleaved/);
});
