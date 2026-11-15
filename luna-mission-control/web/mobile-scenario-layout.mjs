/**
 * Phone-only interleaving of independent lunar scenarios.
 * The actual mission card and its launch/COLA animation article are MOVED,
 * never duplicated: playback controllers, data, and event handlers survive.
 * On wide/desktop viewports the original DOM structure is restored exactly.
 */
export const PHONE_SCENARIO_MEDIA =
 "(max-width: 760px), (max-width: 960px) and (pointer: coarse)";

export function arrangeScenarioPanels(panel,mobile){
 const root=panel?.parentElement;
 const list=panel?.querySelector("[data-cola-list]");
 if(!root||!list)return false;
 const active=panel.classList.contains("phone-scenario-interleaved");
 if(!mobile){
  if(!active)return false;
  const deck=panel.querySelector(".scenario-triple-viewport, .cards.scenario-single");
  if(deck)root.insertBefore(deck,panel);
  // Moving existing articles retains running animations and selected values.
  for(const article of panel.querySelectorAll("[data-cola-scenario]"))list.appendChild(article);
  panel.classList.remove("phone-scenario-interleaved");
  return true;
 }
 if(active)return false;
 const deck=root.querySelector(".scenario-triple-viewport, .cards.scenario-single");
 if(!deck)return false;
 panel.insertBefore(deck,list);
 for(const article of [...list.querySelectorAll("[data-cola-scenario]")]){
  const id=article.dataset.colaScenario;
  const target=deck.matches(".cards.scenario-single")
   ?(id==="original"?deck:null)
   :[...deck.querySelectorAll("[data-scenario-card]")].find(node=>node.dataset.scenarioCard===id);
  if(target)target.appendChild(article);
 }
 panel.classList.add("phone-scenario-interleaved");
 return true;
}
